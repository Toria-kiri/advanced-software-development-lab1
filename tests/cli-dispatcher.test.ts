import assert from "node:assert/strict";
import { test } from "node:test";
import { CliRenderer } from "../src/cli/CliRenderer";
import { CommandDispatcher } from "../src/cli/CommandDispatcher";
import { CommandParser } from "../src/cli/CommandParser";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { EditorSession } from "../src/commands/EditorSession";
import { Document } from "../src/model/Document";
import { Group } from "../src/model/Group";
import { Rect } from "../src/model/Rect";
import { Text } from "../src/model/Text";
import { ModelError } from "../src/model/ModelError";

const parser = new CommandParser(), renderer = new CliRenderer();
function fixture() {
  const session = new EditorSession(new Document(100, 100, [new Group("scene", [
    new Group("inner", [new Rect("r", 1, 2, 3, 4)]), new Rect("other", 5, 6, 7, 8), new Text("t", 1, 2, "old"),
  ])]), "input.svg");
  const executor = new CommandExecutor(session), dispatcher = new CommandDispatcher({
    async read(path: string): Promise<never> { throw new ModelError(`cannot read file: ${path}`); },
    async write(path: string): Promise<never> { throw new ModelError(`cannot write file: ${path}`); },
  });
  return { session, dispatcher, run: (line: string) => dispatcher.create(parser.tokenize(line)).execute(executor, renderer) };
}
const members = (d: Document, id: string) => (d.find(id) as Group).getChildren().map(s => s.id);
const edits: [string, (d: Document) => void][] = [
  ["create circle c .5 2e1 0 in inner", d => assert.deepEqual(d.find("c").toSvgNode().attributes, { id: "c", cx: .5, cy: 20, r: 0 })],
  ["delete inner", d => { assert.throws(() => d.find("inner")); assert.throws(() => d.find("r")); }],
  ["move inner +.5 -2e0", d => assert.equal(d.find("r").getAttribute("x"), 1.5)],
  ["scale inner 2", d => assert.deepEqual(d.find("r").toSvgNode().attributes, { id: "r", x: 2, y: 4, width: 6, height: 8 })],
  ['set t text "123 中文 # <&>"', d => assert.equal(d.find("t").getAttribute("text"), "123 中文 # <&>")],
  ["group pair other r", d => { assert.equal(d.getParentId("pair"), "scene"); assert.deepEqual(members(d, "pair"), ["r", "other"]); }],
  ["ungroup inner", d => { assert.throws(() => d.find("inner")); assert.equal(d.getParentId("r"), "scene"); }],
  ["addto inner other", d => assert.deepEqual(members(d, "inner"), ["r", "other"])],
  ["front inner", d => assert.deepEqual(members(d, "scene"), ["other", "t", "inner"])],
  ["back t", d => assert.deepEqual(members(d, "scene"), ["t", "inner", "other"])],
];
for (const [line, verify] of edits) {
  test(`dispatcher executes and restores real edit: ${line}`, async () => {
    const { session, run } = fixture();
    const before = session.requireDocument().toSvgNode();
    await run(line);
    verify(session.requireDocument());
    assert.deepEqual(session.historyStatus, { undoCount: 1, redoCount: 0, blocked: false });
    const after = session.requireDocument().toSvgNode();
    assert.match(await run("undo"), /^undid /);
    assert.deepEqual(session.requireDocument().toSvgNode(), before);
    assert.match(await run("redo"), /^redid /);
    assert.deepEqual(session.requireDocument().toSvgNode(), after);
  });
}

test("dispatcher init supports zero, one and two dimensions using Command defaults", async () => {
  const { session, run } = fixture();
  for (const [line, width, height] of [["init", 800, 600], ["init 123", 123, 600], ["init 10.5 20", 10.5, 20]] as const) {
    await run(line);
    const d = session.requireDocument();
    assert.deepEqual([d.width, d.height, d.size, session.readPath], [width, height, 0, undefined]);
    assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
  }
});

test("dispatcher canvas distinguishes querying from a successful history boundary", async () => {
  const { session, run } = fixture();
  await run("move r 1 2"); await run("undo");
  const status = session.historyStatus;
  assert.equal(await run("canvas"), "canvas 100x100");
  assert.deepEqual(session.historyStatus, status);
  await run("canvas 200 300");
  assert.equal(session.requireDocument().height, 300);
  assert.equal(session.readPath, "input.svg");
  await assert.rejects(run("redo"), /undo not allowed after io command/);
});

test("tree/show/help route through query Commands and preserve pending redo", async () => {
  const { session, dispatcher, run } = fixture();
  await run("move r 1 2"); await run("undo");
  const before = session.historyStatus;
  assert.match(await run("tree"), /^svg \(100x100\)/);
  assert.match(await run("tree inner"), /^g#inner\n└── rect#r/);
  assert.match(await run("show r"), /^rect#r  parent=g#inner/);
  const help = await run("help");
  assert.equal(dispatcher.helpEntries().length, 19);
  for (const entry of dispatcher.helpEntries()) assert.ok(help.includes(entry.syntax));
  assert.ok(help.includes('create text <id> <x> <y> "content"'));
  assert.ok(help.includes("create rect <id> <x> <y> <w> <h> [fill]"));
  assert.match(help, /读取 SVG/);
  assert.match(help, /最近 read 的路径/);
  assert.deepEqual(session.historyStatus, before);
  await run("redo");
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
});

test("create delegates all six type grammars to Factory and preserves quoted in", async () => {
  const { session, run } = fixture();
  for (const line of ["create rect R 0 0 1 2 #4a90d9", "create ellipse e 1 2 3 4", "create line l 1 2 3 4 #abc",
    'create text txt 1 2 "in" in scene', "create g empty in scene"]) await run(line);
  const d = session.requireDocument();
  assert.equal(d.find("R").getStyle().fill, "#4a90d9");
  assert.equal(d.find("l").getStyle().stroke, "#abc");
  assert.equal(d.find("e").type, "ellipse");
  assert.equal(d.find("txt").getAttribute("text"), "in");
  assert.equal(d.getParentId("empty"), "scene");
  await run('set t text "123"');
  assert.equal(session.requireDocument().find("t").getAttribute("text"), "123");
  await run("set r width 1e1");
  assert.equal(session.requireDocument().find("r").getAttribute("width"), 10);
});

test("invalid dispatch and domain arguments preserve document, path, redo and blocked", async () => {
  const { session, run } = fixture();
  await run("move r 1 2"); await run("undo");
  const node = session.requireDocument().toSvgNode(), status = session.historyStatus;
  const invalid = ["unknown", "exit", "quit", "Move r 1 2", "__proto__", "init 1 2 3", "canvas 100", "canvas 1 2 3", "delete", "delete r extra",
    "move r 1", "move r 1oops 2", 'move r "" 2', "move r 0x10 2", "move r Infinity 2", "move r 1e999 2", "scale r NaN",
    "set r x 2px", "set r fill red blue", "group", "group pair", "group pair r r", "ungroup", "addto inner", "front r extra",
    "back", "tree inner extra", "show", "help extra", "undo extra", "redo extra", "create", "create g a extra", "create box x",
    "create rect r 0 0 1 1", "create rect a 0 0 1 1 in", "create rect a 0 0 1 1 in inner in scene", "create rect a 0 0 1bad 1",
    "create circle a 1 2 -1", "set r id changed", "addto inner scene", "ungroup scene", "init -1 1", "canvas 1 0",
    "move r 1 2 # comment", "show r # comment", "canvas #", "create rect a 0 0 1 2 #abc # comment"];
  for (const line of invalid) {
    await assert.rejects(async () => run(line), /^ModelError: error:/, line);
    assert.deepEqual(session.requireDocument().toSvgNode(), node, line);
    assert.deepEqual(session.historyStatus, status, line);
    assert.equal(session.readPath, "input.svg");
    session.requireDocument().validate();
  }
  await run("redo");
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
});

test("read/save store failures preserve document and history", async () => {
  const { session, run } = fixture();
  const node = session.requireDocument().toSvgNode(), status = session.historyStatus;
  for (const [line, message] of [['read "some file.svg"', "error: cannot read file: some file.svg"],
    ["save", "error: cannot write file: input.svg"], ["save output.svg", "error: cannot write file: output.svg"]]) {
    await assert.rejects(async () => run(line), { message });
    assert.deepEqual(session.requireDocument().toSvgNode(), node);
    assert.deepEqual(session.historyStatus, status);
  }
});

test("invalid create hash colors preserve document, indexes, path, redo and blocked", async () => {
  const { session, run } = fixture();
  await run("move r 1 2"); await run("undo");
  for (const boundary of [false, true]) {
    if (boundary) await run("canvas 200 300");
    const before = session.requireDocument().toSvgNode(), status = session.historyStatus;
    for (const [type, geometry] of [["rect", "0 0 1 2"], ["circle", "1 2 3"], ["ellipse", "1 2 3 4"], ["line", "0 0 1 2"]]) {
      for (const color of ["#12", "#zi", "#中文", "#", '"#12"', '" #12 "', '"#abc comment"']) {
        await assert.rejects(async () => run(`create ${type} rejected ${geometry} ${color} in inner`), /error: invalid hex color:/);
        const d = session.requireDocument();
        assert.deepEqual(d.toSvgNode(), before);
        assert.deepEqual(session.historyStatus, status);
        assert.equal(session.readPath, "input.svg");
        assert.throws(() => d.find("rejected"));
        assert.equal(d.getParentId("r"), "inner");
        assert.equal(d.getPosition("r"), 0);
        d.validate();
      }
    }
    if (!boundary) {
      await run("redo");
      assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
    }
  }
});
