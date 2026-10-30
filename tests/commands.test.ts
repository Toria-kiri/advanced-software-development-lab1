import assert from "node:assert/strict";
import { test } from "node:test";
import { Document } from "../src/model/Document";
import { Group } from "../src/model/Group";
import { Rect } from "../src/model/Rect";
import { AddToCommand } from "../src/commands/AddToCommand";
import { BackCommand } from "../src/commands/BackCommand";
import { CanvasCommand } from "../src/commands/CanvasCommand";
import { Command } from "../src/commands/Command";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { CreateCommand } from "../src/commands/CreateCommand";
import { DeleteCommand } from "../src/commands/DeleteCommand";
import { EditorSession } from "../src/commands/EditorSession";
import { FrontCommand } from "../src/commands/FrontCommand";
import { GroupCommand } from "../src/commands/GroupCommand";
import { HelpCommand } from "../src/commands/HelpCommand";
import { InitCommand } from "../src/commands/InitCommand";
import { MoveCommand } from "../src/commands/MoveCommand";
import { ScaleCommand } from "../src/commands/ScaleCommand";
import { SetCommand } from "../src/commands/SetCommand";
import { ShowCommand } from "../src/commands/ShowCommand";
import { TreeCommand } from "../src/commands/TreeCommand";
import { UngroupCommand } from "../src/commands/UngroupCommand";

const rect = (id: string) => new Rect(id, 1, 2, 3, 4);
function fixture() {
  const document = new Document(320, 240, [new Group("scene", [
    rect("a"), new Group("left", [rect("b")]), rect("c"), new Group("right", [rect("d")]),
  ]), rect("root")]);
  const session = new EditorSession(document, "input.svg");
  return { session, executor: new CommandExecutor(session) };
}
const children = (document: Document, id: string) => (document.find(id) as Group).getChildren().map(shape => shape.id);

const creations: [string, (string | number)[]][] = [
  ["rect", [1, 2, 3, 4, "red"]], ["circle", [1, 2, 3]], ["ellipse", [1, 2, 3, 4]],
  ["line", [1, 2, 3, 4, "blue"]], ["text", [1, 2, "中文 <&>"]], ["g", []],
];
for (const [type, params] of creations) {
  test(`CreateCommand ${type}: inserts in a container and returns detached shape/parent data`, async () => {
    const { session, executor } = fixture();
    const result = await executor.execute(new CreateCommand(type, "new", params, "left"));
    assert.equal(result.success, true);
    assert.equal(result.operation, "create");
    assert.equal(result.data.shape.type, type);
    assert.equal(result.data.parentId, "left");
    assert.equal(session.requireDocument().getParentId("new"), "left");
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(session.historyStatus, { undoCount: 1, redoCount: 0, blocked: false });
  });
}

const edits: { name: string; command: () => Command; verify: (document: Document) => void }[] = [
  { name: "create", command: () => new CreateCommand("circle", "new", [1, 2, 3]), verify: d => assert.equal(d.getParentId("new"), null) },
  { name: "delete subtree", command: () => new DeleteCommand("left"), verify: d => { assert.throws(() => d.find("left")); assert.throws(() => d.find("b")); } },
  { name: "move", command: () => new MoveCommand("left", 30, 20), verify: d => assert.deepEqual([d.find("b").getAttribute("x"), d.find("b").getAttribute("y")], [31, 22]) },
  { name: "scale", command: () => new ScaleCommand("left", 2), verify: d => assert.deepEqual(d.find("b").toSvgNode().attributes, { id: "b", x: 2, y: 4, width: 6, height: 8 }) },
  { name: "set", command: () => new SetCommand("a", "fill", "red"), verify: d => assert.equal(d.find("a").getStyle().fill, "red") },
  { name: "D3 group", command: () => new GroupCommand("pair", ["d", "b"]), verify: d => {
    assert.equal(d.getParentId("pair"), "scene");
    assert.deepEqual(children(d, "scene"), ["a", "pair", "left", "c", "right"]);
    assert.deepEqual(children(d, "pair"), ["b", "d"]);
  } },
  { name: "ungroup", command: () => new UngroupCommand("left"), verify: d => assert.deepEqual(children(d, "scene"), ["a", "b", "c", "right"]) },
  { name: "addto", command: () => new AddToCommand("right", "b"), verify: d => { assert.deepEqual(children(d, "right"), ["d", "b"]); assert.deepEqual(children(d, "left"), []); } },
  { name: "front", command: () => new FrontCommand("a"), verify: d => assert.deepEqual(children(d, "scene"), ["left", "c", "right", "a"]) },
  { name: "back", command: () => new BackCommand("right"), verify: d => assert.deepEqual(children(d, "scene"), ["right", "a", "left", "c"]) },
];
for (const edit of edits) {
  test(`${edit.name}: one history unit restores all attributes, hierarchy and order`, async () => {
    const { session, executor } = fixture();
    const before = session.requireDocument().toSvgNode();
    await executor.execute(edit.command());
    edit.verify(session.requireDocument());
    const after = session.requireDocument().toSvgNode();
    assert.equal(session.historyStatus.undoCount, 1);
    const undo = await executor.undo();
    assert.equal(undo.operation, "undo");
    assert.deepEqual(session.requireDocument().toSvgNode(), before);
    assert.equal(session.historyStatus.redoCount, 1);
    await executor.redo();
    assert.deepEqual(session.requireDocument().toSvgNode(), after);
    session.requireDocument().validate();
    assert.equal(session.readPath, "input.svg");
  });
}

test("init defaults/custom dimensions replace document and clear read path", async () => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("a", 3, 4));
  const result = await executor.execute(new InitCommand());
  assert.deepEqual(result.data, { width: 800, height: 600 });
  assert.equal(session.requireDocument().size, 0);
  assert.equal(session.readPath, undefined);
  assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
  await executor.execute(new InitCommand(100.5, 200));
  assert.equal(session.requireDocument().width, 100.5);
});

test("no-document errors apply to edits, queries, help and history without changing session", async () => {
  const session = new EditorSession();
  const executor = new CommandExecutor(session);
  const commands = [...edits.map(edit => edit.command()), new CanvasCommand(), new TreeCommand(), new ShowCommand("a"), new HelpCommand([])];
  for (const command of commands) {
    await assert.rejects(executor.execute(command), { message: "error: no document. use 'init' or 'read' first" });
  }
  await assert.rejects(executor.undo(), { message: "error: no document. use 'init' or 'read' first" });
  await assert.rejects(executor.redo(), { message: "error: no document. use 'init' or 'read' first" });
  assert.equal(session.hasDocument, false);
  assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: false });
  await executor.execute(new InitCommand());
  assert.equal(session.hasDocument, true);
});

test("tree and show provide typed structure, key geometry, raw text and parent positions", async () => {
  const { session, executor } = fixture();
  await executor.execute(new CreateCommand("text", "t", [1, 2, "中文 <&>"], "left"));
  const before = session.requireDocument().toSvgNode();
  const status = session.historyStatus;
  const all = await executor.execute(new TreeCommand());
  assert.deepEqual([all.data.width, all.data.height], [320, 240]);
  assert.deepEqual(all.data.roots.map(node => node.shape.id), ["scene", "root"]);
  const subtree = await executor.execute(new TreeCommand("left"));
  assert.equal(subtree.data.roots.length, 1);
  assert.equal(subtree.data.roots[0].parentId, "scene");
  assert.deepEqual(subtree.data.roots[0].children.map(node => node.shape.id), ["b", "t"]);
  assert.equal(subtree.data.roots[0].children[0].shape.attributes.width, 3);
  assert.equal(subtree.data.roots[0].children[1].shape.text, "中文 <&>");
  const shown = await executor.execute(new ShowCommand("t"));
  assert.equal(shown.data.parentId, "left");
  assert.equal(shown.data.position, 1);
  assert.equal(shown.data.shape.text, "中文 <&>");
  assert.deepEqual(session.historyStatus, status);
  assert.deepEqual(session.requireDocument().toSvgNode(), before);
  assert.throws(() => { (all.data.roots as unknown[]).pop(); }, TypeError);
});

test("help returns all supplied descriptions, isolates input and leaves history untouched", async () => {
  const { session, executor } = fixture();
  const entries = [{ name: "move", syntax: "move <id> <dx> <dy>", description: "平移" }, { name: "help", syntax: "help", description: "帮助" }];
  const expected = structuredClone(entries);
  const command = new HelpCommand(entries);
  entries[0].syntax = "changed";
  entries.pop();
  const before = session.historyStatus;
  const result = await executor.execute(command);
  assert.deepEqual(result.data.entries, expected);
  assert.deepEqual(session.historyStatus, before);
  assert.throws(() => { (result.data.entries as typeof entries).push(entries[0]); }, TypeError);
});

test("canvas query does not affect history; resize is a boundary and preserves read path", async () => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("a", 1, 2));
  const before = session.historyStatus;
  assert.equal(new CanvasCommand().effect, "query");
  assert.equal(new CanvasCommand(640, 480).effect, "boundary");
  assert.deepEqual((await executor.execute(new CanvasCommand())).data, { width: 320, height: 240 });
  assert.deepEqual(session.historyStatus, before);
  await executor.execute(new CanvasCommand(640, 480));
  assert.equal(session.requireDocument().width, 640);
  assert.equal(session.readPath, "input.svg");
  assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
});

test("command constructors copy array parameters rather than retaining mutable inputs", async () => {
  const { session, executor } = fixture();
  const params = [10, 20, 30, 40];
  const create = new CreateCommand("rect", "new", params);
  params[0] = 999;
  await executor.execute(create);
  assert.equal(session.requireDocument().find("new").getAttribute("x"), 10);
  const ids = ["a", "c"];
  const group = new GroupCommand("pair", ids);
  ids[0] = "missing";
  await executor.execute(group);
  assert.deepEqual(children(session.requireDocument(), "pair"), ["a", "c"]);
});

test("session copies seeded documents, protects inspection copies and rejects a second executor", () => {
  const input = new Document(100, 100, [rect("r")]);
  const session = new EditorSession(input, "file.svg");
  new CommandExecutor(session);
  input.delete("r");
  session.requireDocument().delete("r");
  assert.equal(session.requireDocument().size, 1);
  assert.throws(() => new CommandExecutor(session), { message: "error: session already has an executor" });
  assert.throws(() => new EditorSession(undefined, "invalid.svg"));
});

test("invalid editing/query/boundary commands preserve document, path and redo history", async () => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("a", 1, 2));
  await executor.undo();
  const before = session.requireDocument().toSvgNode();
  const status = session.historyStatus;
  const commands: Command[] = [
    new CreateCommand("rect", "a", [1, 2, 3, 4]), new CreateCommand("box", "box"),
    new CreateCommand("rect", "bad", [1, 2, -1, 4]), new CreateCommand("g", "bad", [], "a"),
    new MoveCommand("missing", 1, 2), new MoveCommand("a", NaN, 1), new ScaleCommand("a", 0),
    new SetCommand("a", "id", "changed"), new SetCommand("a", "width", -1), new GroupCommand("pair", ["left", "b"]),
    new GroupCommand("pair", ["a", "a"]), new AddToCommand("left", "scene"), new UngroupCommand("scene"),
    new DeleteCommand("missing"), new FrontCommand("missing"), new BackCommand("missing"),
    new TreeCommand("missing"), new ShowCommand("missing"), new InitCommand(0, 100),
    new CanvasCommand(100, -1), new CanvasCommand(100), new CanvasCommand(undefined, 100),
  ];
  for (const command of commands) {
    await assert.rejects(executor.execute(command), /^ModelError: error:/);
    assert.deepEqual(session.requireDocument().toSvgNode(), before);
    assert.deepEqual(session.historyStatus, status);
    assert.equal(session.readPath, "input.svg");
  }
  await executor.redo();
  assert.equal(session.requireDocument().find("a").getAttribute("x"), 2);
});
