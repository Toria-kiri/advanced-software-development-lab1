import assert from "node:assert/strict";
import { test } from "node:test";
import { CliRenderer } from "../src/cli/CliRenderer";
import { CommandResult } from "../src/commands/CommandResult";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { EditorSession } from "../src/commands/EditorSession";
import { ShowCommand } from "../src/commands/ShowCommand";
import { TreeCommand } from "../src/commands/TreeCommand";
import { Document } from "../src/model/Document";
import { Group } from "../src/model/Group";
import { ModelError } from "../src/model/ModelError";
import { Rect } from "../src/model/Rect";
import { Text } from "../src/model/Text";

const renderer = new CliRenderer();
function fixture() {
  const session = new EditorSession(new Document(800, 600, [new Rect("bg", 0, 0, 800, 600, { fill: "#ffffff" }),
    new Group("scene", [new Text("t", 10, 20, "中文 <&>"), new Group("empty", [], { stroke: "blue" })], { fill: "red" })]));
  return { session, executor: new CommandExecutor(session) };
}
test("renderer formats tree connectors and geometry with explicit styles only", async () => {
  const { session, executor } = fixture();
  const before = session.requireDocument().toSvgNode(), status = session.historyStatus;
  const result = await executor.execute(new TreeCommand());
  assert.equal(renderer.render(result, d => renderer.tree(d)), ["svg (800x600)", "├── rect#bg x=0 y=0 w=800 h=600 fill=#ffffff",
    "└── g#scene fill=red", '    ├── text#t (10,20) "中文 <&>"', "    └── g#empty stroke=blue"].join("\n"));
  assert.deepEqual(session.requireDocument().toSvgNode(), before);
  assert.deepEqual(session.historyStatus, status);
});
test("renderer shows only the requested subtree without a canvas wrapper", async () => {
  const { executor } = fixture();
  const result = await executor.execute(new TreeCommand("scene"));
  assert.equal(renderer.tree(result.data, true), ['g#scene fill=red', '├── text#t (10,20) "中文 <&>"', "└── g#empty stroke=blue"].join("\n"));
});
test("renderer show includes parent, geometry, raw Chinese text and no implicit fill", async () => {
  const { executor } = fixture();
  const result = await executor.execute(new ShowCommand("t"));
  assert.equal(renderer.show(result.data), 'text#t  parent=g#scene\n  x=10 y=20\n  text="中文 <&>"');
  const root = await executor.execute(new ShowCommand("bg"));
  assert.equal(renderer.show(root.data), "rect#bg  parent=svg\n  x=0 y=0 width=800 height=600\n  fill=#ffffff");
});
test("renderer uses supplied success formatter and normalizes warning lines", () => {
  const result = new CommandResult("init", { width: 10, height: 20 }, ["assigned id r", "warning: example\nsecond"]);
  assert.equal(renderer.render(result, d => renderer.canvas(d, " created")), "warning: assigned id r\nwarning: example second\ncanvas 10x20 created");
});
test("renderer outputs injected help syntax without selecting by command name", () => {
  assert.equal(renderer.help({ entries: [{ name: "move", syntax: "move <id> <dx> <dy>", description: "平移" }] }), "move <id> <dx> <dy>  平移");
});
test("renderer emits one error prefix on one line for domain and ordinary errors", () => {
  for (const value of [new ModelError("bad\ninput"), new Error("error: error: bad\r\ninput"), "bad\tinput"]) {
    assert.equal(renderer.error(value), "error: bad input");
  }
});
