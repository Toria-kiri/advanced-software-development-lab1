import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { EditorSession } from "../src/commands/EditorSession";
import { MoveCommand } from "../src/commands/MoveCommand";
import { SaveCommand } from "../src/commands/SaveCommand";
import { SvgFileStore } from "../src/io/SvgFileStore";
import { SvgParser } from "../src/io/SvgParser";
import { SvgSerializer } from "../src/io/SvgSerializer";
import { Document } from "../src/model/Document";
import { Group } from "../src/model/Group";
import { complexDocument, semanticState, temporaryDirectory } from "./io-fixtures";

const state = (session: EditorSession) => ({
  document: semanticState(session.requireDocument()), path: session.readPath, history: session.historyStatus,
});
const children = (document: Document, id: string) => (document.find(id) as Group).getChildren().map(child => child.id);

test("acceptance: committed SVG example is reproducible through the real CLI", { timeout: 10000 }, async t => {
  const directory = await temporaryDirectory(t);
  await fs.mkdir(join(directory, "examples"));
  const repository = resolve(__dirname, "../../..");
  const result = spawnSync(process.execPath, [resolve(__dirname, "../../main.js")], {
    input: await fs.readFile(join(repository, "examples/phase1.cli")), cwd: directory, encoding: "utf8", timeout: 7000,
  });
  assert.ifError(result.error); assert.equal(result.status, 0); assert.equal(result.stderr, "");
  const store = new SvgFileStore();
  const actual = (await store.read(join(directory, "examples/phase1.svg"))).document;
  const expected = (await store.read(join(repository, "examples/phase1.svg"))).document;
  assert.deepEqual(semanticState(actual), semanticState(expected));
  assert.equal(actual.size, 10);
  assert.equal(actual.find("end").getAttribute("cy"), 160);
  assert.equal(actual.find("start").getStyle().fill, undefined);
  assert.equal(actual.find("scene").getStyle().fill, "#4a90d9");
  assert.equal(actual.find("start-label").getAttribute("text"), "开始 <&> # Phase 1");
});

test("acceptance: compiled CLI transforms every leaf, saves, reads and continues editing", { timeout: 15000 }, async t => {
  const directory = await temporaryDirectory(t), first = join(directory, "first.svg"), last = join(directory, "last.svg");
  const lines = ["init 400 300", "create g scene", "set scene fill blue",
    "create rect r 1 2 3 4 red in scene", "create circle c 1 2 3 in scene", "create ellipse e 1 2 3 4 in scene",
    "create line l 1 2 3 4 #abc in scene", 'create text t 1 2 "中文 # <&> 空格" in scene'];
  for (const id of ["r", "c", "e", "l", "t"]) lines.push(`show ${id}`, `move ${id} 10 20`, `scale ${id} 2`, `set ${id} stroke-width 3`);
  lines.push("tree", `save "${first}"`, `read "${first}"`, "move scene 1 2", "undo", "redo", `save "${last}"`, "help");
  const result = spawnSync(process.execPath, [resolve(__dirname, "../../main.js")], {
    input: lines.join("\n"), encoding: "utf8", timeout: 12000,
  });
  assert.ifError(result.error); assert.equal(result.status, 0); assert.equal(result.stderr, "");
  for (const id of ["r", "c", "e", "l", "t"]) assert.ok(result.stdout.includes(`#${id}  parent=g#scene`));
  assert.match(result.stdout, /svg \(400x300\)/); assert.match(result.stdout, /undid move/); assert.match(result.stdout, /redid move/);
  assert.match(result.stdout, /save \[file.svg\]/);
  const store = new SvgFileStore(), before = (await store.read(first)).document, after = (await store.read(last)).document;
  const expected: Record<string, Record<string, string | number>> = {
    r: { id: "r", x: 22, y: 44, width: 6, height: 8, fill: "red", "stroke-width": 3 },
    c: { id: "c", cx: 22, cy: 44, r: 6, "stroke-width": 3 },
    e: { id: "e", cx: 22, cy: 44, rx: 6, ry: 8, "stroke-width": 3 },
    l: { id: "l", x1: 22, y1: 44, x2: 26, y2: 48, stroke: "#abc", "stroke-width": 3 },
    t: { id: "t", x: 22, y: 44, "stroke-width": 3 },
  };
  for (const [id, attributes] of Object.entries(expected)) {
    assert.deepEqual(before.find(id).toSvgNode().attributes, attributes);
    assert.equal(after.getParentId(id), "scene");
  }
  assert.deepEqual(after.find("l").toSvgNode().attributes, { ...expected.l, x1: 23, y1: 46, x2: 27, y2: 50 });
  assert.equal(after.find("r").getAttribute("x"), 23);
  assert.equal(after.find("c").getAttribute("cy"), 46);
  assert.equal(after.find("e").getAttribute("rx"), 6);
  assert.equal(after.find("t").getAttribute("text"), "中文 # <&> 空格");
  assert.equal(after.find("t").getStyle().fill, undefined);
  assert.equal(after.find("scene").getStyle().fill, "blue");
  assert.deepEqual(children(after, "scene"), ["r", "c", "e", "l", "t"]);
  semanticState(after);
});

test("acceptance: compiled CLI D3, whole-group composition, order and subtree undo survive file checkpoints", { timeout: 15000 }, async t => {
  const directory = await temporaryDirectory(t), file = (name: string) => join(directory, name + ".svg");
  const result = spawnSync(process.execPath, [resolve(__dirname, "../../main.js")], {
    input: ["init", "create g scene", "create g left in scene", "create rect a 1 2 3 4 red in left",
      "create rect keep 5 6 7 8 in left", "create g right in scene", "create circle b 10 20 3 in right",
      "group pair b a", `save "${file("d3")}"`, "move pair 10 20", "scale pair 2", "set pair fill blue",
      "ungroup scene", "group illegal pair a", "addto left scene", "ungroup pair", "addto right a", "front left", "back right",
      "group both left right", "delete both", "undo", `save "${file("restored")}"`,
      `read "${file("restored")}"`, "delete both", "undo", "redo", "undo", "tree", `save "${file("final")}"`].join("\n"),
    encoding: "utf8", timeout: 12000,
  });
  assert.ifError(result.error); assert.equal(result.status, 0);
  assert.deepEqual(result.stderr.trim().split(/\r?\n/), ["error: cannot ungroup top-level container: scene",
    "error: cannot group a container into its own descendant: pair", "error: cannot add a container into its own descendant: scene"]);
  const store = new SvgFileStore(), d3 = (await store.read(file("d3"))).document;
  assert.deepEqual(children(d3, "scene"), ["pair", "left", "right"]);
  assert.deepEqual(children(d3, "pair"), ["a", "b"]);
  assert.deepEqual(children(d3, "left"), ["keep"]);
  assert.deepEqual(children(d3, "right"), []);
  const restored = (await store.read(file("restored"))).document, final = (await store.read(file("final"))).document;
  assert.deepEqual(children(final, "scene"), ["both", "b"]);
  assert.deepEqual(children(final, "both"), ["right", "left"]);
  assert.deepEqual(children(final, "right"), ["a"]);
  assert.deepEqual(children(final, "left"), ["keep"]);
  assert.deepEqual(final.find("a").toSvgNode().attributes, { id: "a", x: 22, y: 44, width: 6, height: 8, fill: "red" });
  assert.deepEqual(final.find("b").toSvgNode().attributes, { id: "b", cx: 40, cy: 80, r: 6 });
  assert.equal(final.find("keep").getAttribute("x"), 5);
  assert.deepEqual(semanticState(final), semanticState(restored));
  assert.match(result.stdout, /undid delete/); assert.match(result.stdout, /redid delete/);
});

test("acceptance: undo and redo validation failures preserve full state and allow retry", async t => {
  const session = new EditorSession(complexDocument(), "read.svg"), executor = new CommandExecutor(session);
  await executor.execute(new MoveCommand("r", 1, 2));
  await executor.execute(new MoveCommand("r", 3, 4));
  for (const operation of [() => executor.undo(), () => executor.redo()]) {
    const before = state(session);
    const mock = t.mock.method(Document.prototype, "validate", () => { throw new Error("injected restore validation failure"); });
    await assert.rejects(operation(), { message: "error: injected restore validation failure" });
    assert.equal(mock.mock.callCount(), 1); mock.mock.restore();
    assert.deepEqual(state(session), before);
    await operation();
  }
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 5);
});

test("acceptance: serialization and rename failures preserve session stacks, old file and cleanup", async t => {
  const directory = await temporaryDirectory(t), file = join(directory, "old.svg"), store = new SvgFileStore();
  await fs.writeFile(file, "old bytes");
  const session = new EditorSession(complexDocument(), file), executor = new CommandExecutor(session);
  await executor.execute(new MoveCommand("r", 1, 2)); await executor.execute(new MoveCommand("r", 3, 4)); await executor.undo();
  const before = state(session);
  const original = SvgSerializer.prototype.serialize;
  const serialization = t.mock.method(SvgSerializer.prototype, "serialize", () => { throw new Error("injected serializer failure"); });
  await assert.rejects(executor.execute(new SaveCommand(store)), { message: "error: injected serializer failure" });
  serialization.mock.restore(); assert.equal(SvgSerializer.prototype.serialize, original);
  assert.deepEqual(state(session), before); assert.equal(await fs.readFile(file, "utf8"), "old bytes");
  const rename = t.mock.method(fs, "rename", async () => { throw new Error("injected rename failure"); });
  await assert.rejects(executor.execute(new SaveCommand(store)), { message: `error: cannot write file: ${file}` });
  assert.equal(rename.mock.callCount(), 1); rename.mock.restore();
  assert.deepEqual(state(session), before); assert.equal(await fs.readFile(file, "utf8"), "old bytes");
  assert.deepEqual(await fs.readdir(directory), ["old.svg"]);
  await executor.redo(); assert.equal(session.requireDocument().find("r").getAttribute("x"), 5);
});

test("acceptance: codec accepts 100000 nodes and rejects 100001 nodes", { timeout: 30000 }, () => {
  const parser = new SvgParser(), serializer = new SvgSerializer();
  const body = Array.from({ length: 100000 }, (_, i) => `<g id="g${i}"/>`).join("");
  const document = parser.parse(`<svg>${body}</svg>`).document;
  assert.equal(document.size, 100000); assert.equal(document.getPosition("g99999"), 99999);
  assert.equal(parser.parse(serializer.serialize(document)).document.size, 100000);
  assert.throws(() => parser.parse(`<svg>${body}<g id="extra"/></svg>`), { message: "error: SVG tree exceeds depth or node limit" });
  document.insert(new Group("extra"));
  assert.throws(() => serializer.serialize(document), { message: "error: SVG tree exceeds depth or node limit" });
});

test("acceptance: codec accepts depth 256 and rejects output depth 257", { timeout: 10000 }, () => {
  let root = new Group("leaf");
  for (let i = 0; i < 255; i++) root = new Group(`g${i}`, [root]);
  const serializer = new SvgSerializer(), document = new Document(1, 1, [root]);
  const reread = new SvgParser().parse(serializer.serialize(document)).document;
  assert.deepEqual(semanticState(reread), semanticState(document));
  const tooDeep = new Document(1, 1, [new Group("outer", [root])]);
  assert.throws(() => serializer.serialize(tooDeep), { message: "error: SVG tree exceeds depth or node limit" });
});
