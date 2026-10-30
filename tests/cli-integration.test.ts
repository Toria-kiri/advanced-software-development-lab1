import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { test } from "node:test";
import { CliRepl } from "../src/cli/CliRepl";
import { CliRenderer } from "../src/cli/CliRenderer";
import { CommandDispatcher } from "../src/cli/CommandDispatcher";
import { CommandParser } from "../src/cli/CommandParser";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { Command } from "../src/commands/Command";
import { EditorSession } from "../src/commands/EditorSession";
import { Group } from "../src/model/Group";

function fixture() {
  const session = new EditorSession(), executor = new CommandExecutor(session);
  const repl = new CliRepl(executor, new CommandParser(), new CommandDispatcher(), new CliRenderer());
  return { session, executor, repl };
}
async function runScript(text: string) {
  const f = fixture(), output = new PassThrough(), errors = new PassThrough();
  let stdout = "", stderr = "";
  output.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
  errors.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  await f.repl.run(Readable.from([text]), output, errors);
  return { ...f, stdout, stderr };
}
test("REPL init/create/move/show edits a single real document", async () => {
  const f = await runScript("init 200 100\ncreate rect r 1 2 3 4 #abc\nmove r 30 20\nshow r\n");
  assert.equal(f.stderr, "");
  const d = f.session.requireDocument();
  assert.equal(d.width, 200);
  assert.deepEqual(d.find("r").toSvgNode().attributes, { id: "r", x: 31, y: 22, width: 3, height: 4, fill: "#abc" });
  assert.match(f.stdout, /rect#r  parent=svg\n  x=31 y=22 width=3 height=4/);
  assert.equal(f.session.historyStatus.undoCount, 2);
});
test("REPL undo/redo restores a real edit and querying preserves redo", async () => {
  const f = await runScript("init\ncreate circle c 1 2 3\nmove c 10 20\nundo\ncanvas\nshow c\ntree\nhelp\nredo\n");
  assert.equal(f.stderr, "");
  assert.equal(f.session.requireDocument().find("c").getAttribute("cx"), 11);
  assert.deepEqual(f.session.historyStatus, { undoCount: 2, redoCount: 0, blocked: false });
});
test("REPL groups under a parent, renders tree, and ungroups in original child order", async () => {
  const f = await runScript("init\ncreate g scene\ncreate rect a 0 0 1 2 in scene\ncreate circle b 1 2 3 in scene\ngroup pair b a\ntree\nungroup pair\n");
  assert.equal(f.stderr, "");
  const d = f.session.requireDocument();
  assert.deepEqual((d.find("scene") as Group).getChildren().map(s => s.id), ["a", "b"]);
  assert.equal(d.getParentId("a"), "scene");
  assert.throws(() => d.find("pair"));
  assert.match(f.stdout, /g#pair\n.*rect#a/);
  d.validate();
});
test("REPL delete and undo restore an entire nested subtree", async () => {
  const f = await runScript("init\ncreate g g\ncreate text t 1 2 \"中文 <&>\" in g\ndelete g\nundo\n");
  assert.equal(f.stderr, "");
  assert.equal(f.session.requireDocument().getParentId("t"), "g");
  assert.equal(f.session.requireDocument().find("t").getAttribute("text"), "中文 <&>");
  assert.equal(f.session.historyStatus.redoCount, 1);
});
test("REPL canvas modification blocks old history until a successful new edit", async () => {
  const f = await runScript("init\ncreate rect r 1 2 3 4\ncanvas\ncanvas 320 240\nundo\nredo\nmove missing 1 2\nmove r 1 2\nundo\nundo\n");
  assert.equal(f.session.requireDocument().width, 320);
  assert.equal(f.session.requireDocument().find("r").getAttribute("x"), 1);
  assert.deepEqual(f.session.historyStatus, { undoCount: 0, redoCount: 1, blocked: false });
  assert.equal((f.stderr.match(/undo not allowed after io command/g) || []).length, 2);
  assert.match(f.stderr, /nothing to undo/);
});
test("REPL errors, malformed input, comments and unsupported IO do not stop later commands", async () => {
  const f = await runScript('#comment\n\nhelp\ninit\n# text on a separate comment line\ncreate text t 0 0 "A # B"\nset t text "unterminated\nunknown\ncreate text t 9 9 "duplicate"\nread no.svg\nsave out.svg\nset t text "中文 <&>"\n');
  assert.equal(f.session.requireDocument().size, 1);
  assert.equal(f.session.requireDocument().find("t").getAttribute("text"), "中文 <&>");
  assert.equal(f.session.historyStatus.undoCount, 2);
  assert.equal(f.stderr.trim().split("\n").length, 6);
  assert.ok(f.stderr.trim().split("\n").every(line => line.startsWith("error: ")));
  assert.doesNotMatch(f.stdout, /saved to|read from/);
});
test("only separate comment lines are ignored; inline hashes remain arguments and colors or text", async () => {
  const f = await runScript('# separate comment\ninit\n  # indented comment\ncreate rect r 1 2 3 4 #4a90d9\nmove r 10 20 # comment\nshow r # comment\ncanvas #\nundo\nredo\ncreate text t 0 0 "A # B"\nset t text #\n');
  const d = f.session.requireDocument();
  assert.equal(d.find("r").getAttribute("x"), 1);
  assert.equal(d.find("r").getAttribute("y"), 2);
  assert.equal(d.find("r").getStyle().fill, "#4a90d9");
  assert.equal(d.find("t").getAttribute("text"), "#");
  assert.deepEqual(f.session.historyStatus, { undoCount: 3, redoCount: 0, blocked: false });
  assert.equal(f.stderr.trim().split("\n").length, 3);
  assert.ok(f.stderr.trim().split("\n").every(line => line.startsWith("error: ")));
  d.validate();
});
test("REPL rejects malformed create colors, then accepts valid colors and hash text", async () => {
  const f = await runScript('init\ncreate rect bad1 0 0 1 2 #12\ncreate circle bad2 0 0 1 #zi\ncreate line bad3 0 0 1 2 #中文\ncreate ellipse bad4 0 0 1 2 #\ncreate rect good 0 0 1 2 #aBc\ncreate line edge 0 0 1 2 #AABBCC\ncreate circle alpha 0 0 1 #abcd\ncreate ellipse rgba 0 0 1 2 #AABBCC80\ncreate text t 0 0 "#中文"\ncreate text #id 0 0 "#12"\n');
  const d = f.session.requireDocument();
  assert.equal(d.size, 6);
  for (const id of ["bad1", "bad2", "bad3", "bad4"]) assert.throws(() => d.find(id));
  assert.equal(d.find("good").getStyle().fill, "#aBc");
  assert.equal(d.find("edge").getStyle().stroke, "#AABBCC");
  assert.equal(d.find("alpha").getStyle().fill, "#abcd");
  assert.equal(d.find("rgba").getStyle().fill, "#AABBCC80");
  assert.equal(d.find("t").getAttribute("text"), "#中文");
  assert.equal(d.find("#id").getAttribute("text"), "#12");
  assert.deepEqual(f.session.historyStatus, { undoCount: 6, redoCount: 0, blocked: false });
  assert.equal(f.stderr.trim().split("\n").length, 4);
  assert.ok(f.stderr.trim().split("\n").every(line => line.startsWith("error: invalid hex color:")));
  d.validate();
});
test("REPL creates all six shapes and supports scale/set/addto/front/back", async () => {
  const f = await runScript('init\ncreate g g\ncreate rect r 1 2 3 4\ncreate circle c 1 2 3 in g\ncreate ellipse e 1 2 3 4 in g\ncreate line l 1 2 3 4 #abc in g\ncreate text t 1 2 "in" in g\naddto g r\nfront c\nback r\nscale g 2\nset g fill blue\nset r fill red\n');
  assert.equal(f.stderr, "");
  const d = f.session.requireDocument();
  assert.equal(d.size, 6);
  assert.deepEqual((d.find("g") as Group).getChildren().map(s => s.id), ["r", "e", "l", "t", "c"]);
  assert.equal(d.find("r").getAttribute("width"), 6);
  assert.equal(d.find("g").getStyle().fill, "blue");
  assert.equal(d.find("r").getStyle().fill, "red");
  assert.equal(d.find("e").getStyle().fill, undefined);
  assert.equal(d.find("t").getAttribute("text"), "in");
});
test("buffered lines and EOF wait for a delayed executor before processing the next edit", { timeout: 3000 }, async t => {
  const f = fixture(), input = new PassThrough(), output = new PassThrough();
  let text = "";
  output.setEncoding("utf8").on("data", chunk => { text += chunk; });
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = f.executor.execute.bind(f.executor);
  let calls = 0;
  t.mock.method(f.executor, "execute", async <T>(command: Command<T>) => {
    if (++calls === 2) { entered(); await gate; }
    return original(command);
  });
  const running = f.repl.run(input, output);
  input.end("init\ncreate rect r 1 2 3 4\nmove r 10 20\n");
  await started;
  try {
    assert.equal(calls, 2);
    assert.equal(f.session.requireDocument().size, 0);
  } finally { release(); }
  await running;
  assert.equal(calls, 3);
  assert.equal(f.session.requireDocument().find("r").getAttribute("x"), 11);
  assert.equal(f.session.historyStatus.undoCount, 2);
  assert.doesNotMatch(text, /busy|error:/);
});
test("empty EOF leaves session uninitialized and returns promptly", async () => {
  const f = await runScript("");
  assert.equal(f.stdout, "svg> \n");
  assert.equal(f.stderr, "");
  assert.equal(f.session.hasDocument, false);
});
test("input stream failures reject the run promise and can be handled by the caller", { timeout: 3000 }, async () => {
  const f = fixture(), input = new PassThrough(), output = new PassThrough();
  output.resume();
  const running = f.repl.run(input, output);
  const rejected = assert.rejects(running, /injected input failure/);
  input.destroy(new Error("injected input failure"));
  await rejected;
  assert.equal(f.session.hasDocument, false);
});
test("compiled entry processes CRLF, final line without newline and exits on EOF", () => {
  const result = spawnSync(process.execPath, [resolve(__dirname, "../../main.js")], {
    input: 'init\r\ncreate text t 1 2 "中文 # <&>"\r\nmove t 3 4\r\nundo\r\nredo\r\nshow t',
    encoding: "utf8", timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /text#t  parent=svg\n  x=4 y=6\n  text="中文 # <&>"/);
  assert.doesNotMatch(result.stdout, /busy|UnhandledPromiseRejection/);
});
