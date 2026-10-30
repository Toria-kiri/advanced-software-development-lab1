import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { test } from "node:test";
import { CliRepl } from "../src/cli/CliRepl";
import { CliRenderer } from "../src/cli/CliRenderer";
import { CommandDispatcher } from "../src/cli/CommandDispatcher";
import { CommandParser } from "../src/cli/CommandParser";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { EditorSession } from "../src/commands/EditorSession";
import { SvgFileStore } from "../src/io/SvgFileStore";
import { Group } from "../src/model/Group";
import { semanticState, temporaryDirectory } from "./io-fixtures";

async function run(lines: string[]) {
  const store = new SvgFileStore(), session = new EditorSession(), executor = new CommandExecutor(session);
  const repl = new CliRepl(executor, new CommandParser(), new CommandDispatcher(store), new CliRenderer());
  const output = new PassThrough(), errors = new PassThrough(); let stdout = "", stderr = "";
  output.setEncoding("utf8").on("data", value => { stdout += value; });
  errors.setEncoding("utf8").on("data", value => { stderr += value; });
  await repl.run(Readable.from([lines.join("\n") + "\n"]), output, errors);
  return { store, session, stdout, stderr };
}

test("real CLI lifecycle saves, reads, preserves all six shapes and continues undo/redo", async t => {
  const directory = await temporaryDirectory(t), first = join(directory, "首次 保存.svg"), second = join(directory, "second.svg");
  const result = await run(["init 800 600", "create g scene", "set scene fill blue", "create rect r 10 20 30 40 red in scene",
    "create circle c 50 60 7 in scene", "create ellipse e 10 20 3 4 in scene", "create line l 0 0 1 2 #abc in scene",
    'create text t 1 2 "中文 <&> # 空格" in scene', "move r 30 20", "group pair c r", `save "${first}"`,
    `read "${first}"`, "tree", "show r", 'set t text "编辑后 <&>"', "undo", "redo", `save "${second}"`]);
  assert.equal(result.stderr, "");
  const document = result.session.requireDocument();
  assert.equal(document.size, 7);
  assert.equal(document.find("r").getAttribute("x"), 40);
  assert.equal(document.getParentId("r"), "pair");
  assert.deepEqual((document.find("pair") as Group).getChildren().map(s => s.id), ["r", "c"]);
  assert.equal(document.find("t").getAttribute("text"), "编辑后 <&>");
  assert.equal(document.find("scene").getStyle().fill, "blue");
  assert.equal(document.find("r").getStyle().fill, "red");
  assert.equal(document.find("c").getStyle().fill, undefined);
  assert.equal(result.session.readPath, first);
  assert.deepEqual(result.session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
  assert.deepEqual(semanticState((await result.store.read(second)).document), semanticState(document));
  assert.equal((await result.store.read(first)).document.find("t").getAttribute("text"), "中文 <&> # 空格");
  assert.match(result.stdout, /undid set/); assert.match(result.stdout, /redid set/);
  assert.match(await fs.readFile(second, "utf8"), /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
});

test("real CLI read failure keeps the document and later valid commands can save", async t => {
  const directory = await temporaryDirectory(t), bad = join(directory, "bad.svg"), out = join(directory, "recovered.svg");
  await fs.writeFile(bad, '<svg width="100" height="100"><rect transform="translate(10,0)"/></svg>');
  const result = await run(["init", "create rect r 1 2 3 4", `read "${bad}"`, "move r 20 30", `save "${out}"`, "show r"]);
  assert.match(result.stderr, /unknown attribute: transform/);
  assert.doesNotMatch(result.stdout, /warning: assigned id/);
  assert.equal(result.stderr.trim().split("\n").length, 1);
  assert.equal(result.session.requireDocument().find("r").getAttribute("x"), 21);
  assert.equal(result.session.readPath, undefined);
  assert.equal((await result.store.read(out)).document.find("r").getAttribute("y"), 32);
});

test("real CLI missing-id warnings appear only after successful read and generated ids are editable", async t => {
  const directory = await temporaryDirectory(t), file = join(directory, "external # file.svg"), out = join(directory, "out.svg");
  await fs.writeFile(file, '<svg width="100" height="100"><g><rect id="rect1"/><rect width="3" height="4"/><text>中文 &amp; &quot;实体&quot;</text></g></svg>');
  const result = await run([`read "${file}"`, "move rect2 10 20", "tree", "show text1", `save "${out}"`]);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /warning: assigned id rect2 to unnamed <rect>/);
  assert.match(result.stdout, /warning: assigned id text1 to unnamed <text>/);
  const saved = (await result.store.read(out)).document;
  assert.equal(saved.find("rect2").getAttribute("x"), 10);
  assert.equal(saved.find("text1").getAttribute("text"), '中文 & "实体"');
  assert.equal(saved.getParentId("text1"), "g1");
});

test("compiled CLI uses actual filesystem with quoted paths, XML escaping and clean EOF", async t => {
  const directory = await temporaryDirectory(t), file = join(directory, "child file.svg");
  const result = spawnSync(process.execPath, [resolve(__dirname, "../../main.js")], {
    input: ["init 200 100", "create rect r 1 2 3 4 #aBc", 'create text t 5 6 "中文 <&> #"', `save "${file}"`, "undo",
      `read "${file}"`, "move r 10 20", "undo", "redo", "save", "show r"].join("\r\n"), encoding: "utf8", timeout: 7000,
  });
  assert.ifError(result.error); assert.equal(result.status, 0);
  assert.equal(result.stderr.trim(), "error: undo not allowed after io command");
  assert.match(result.stdout, /x=11 y=22 width=3 height=4/);
  const document = (await new SvgFileStore().read(file)).document;
  assert.equal(document.find("r").getAttribute("x"), 11);
  assert.equal(document.find("t").getAttribute("text"), "中文 <&> #");
  assert.deepEqual(await fs.readdir(directory), ["child file.svg"]);
});
