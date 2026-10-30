import assert from "node:assert/strict";
import { test } from "node:test";
import { Document } from "../src/model/Document";
import { Rect } from "../src/model/Rect";
import { CanvasCommand } from "../src/commands/CanvasCommand";
import { Command } from "../src/commands/Command";
import { CommandContext } from "../src/commands/CommandContext";
import { CommandHistory } from "../src/commands/CommandHistory";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { CommandResult } from "../src/commands/CommandResult";
import { EditorSession } from "../src/commands/EditorSession";
import { InitCommand } from "../src/commands/InitCommand";
import { MoveCommand } from "../src/commands/MoveCommand";

function fixture() {
  const session = new EditorSession(new Document(100, 100, [new Rect("r", 1, 2, 3, 4)]), "input.svg");
  return { session, executor: new CommandExecutor(session) };
}
function snapshot(session: EditorSession) {
  const document = session.requireDocument();
  document.validate();
  return { node: document.toSvgNode(), size: document.size, parent: document.getParentId("r"), position: document.getPosition("r"), path: session.readPath, history: session.historyStatus };
}

test("partial draft changes followed by an exception preserve live state, redo and error prefix", async () => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("r", 10, 10));
  await executor.undo();
  const before = snapshot(session);
  const command: Command = { name: "failing", effect: "edit", async execute(context) {
    context.requireDocument().find("r").move(100, 100);
    await Promise.resolve();
    throw new Error("injected execution failure\nsecond line");
  } };
  await assert.rejects(executor.execute(command), { message: "error: injected execution failure second line" });
  assert.deepEqual(snapshot(session), before);
  await executor.redo();
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 11);
});

test("candidate validation failure happens before session and history commit", async () => {
  const { session, executor } = fixture();
  const before = snapshot(session);
  const command: Command = { name: "invalid", effect: "edit", async execute(context) {
    const document = context.requireDocument();
    document.find("r").move(1, 2);
    document.validate = () => { throw new Error("injected validation failure"); };
    return new CommandResult("invalid", {});
  } };
  await assert.rejects(executor.execute(command), { message: "error: injected validation failure" });
  assert.deepEqual(snapshot(session), before);
});

for (const stage of [1, 2, 3, 4]) {
  test(`clone failure at edit preparation stage ${stage} leaves all state unchanged`, async t => {
    const { session, executor } = fixture();
    await executor.execute(new MoveCommand("r", 1, 2));
    await executor.undo();
    const before = snapshot(session);
    const original = Document.prototype.clone;
    let calls = 0;
    const clone = t.mock.method(Document.prototype, "clone", function(this: Document) {
      if (++calls === stage) throw new Error("injected clone failure");
      return original.call(this);
    });
    await assert.rejects(executor.execute(new MoveCommand("r", 100, 100)), { message: "error: injected clone failure" });
    clone.mock.restore();
    assert.equal(calls, stage);
    assert.deepEqual(snapshot(session), before);
    await executor.redo();
    assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
  });
}

test("history recording failure after snapshot preparation cannot partially commit", async t => {
  const { session, executor } = fixture();
  const before = snapshot(session);
  const original = CommandHistory.prototype.record;
  const record = t.mock.method(CommandHistory.prototype, "record", function(this: CommandHistory, ...args: Parameters<CommandHistory["record"]>) {
    original.apply(this, args);
    throw new Error("injected history failure");
  });
  await assert.rejects(executor.execute(new MoveCommand("r", 4, 5)), { message: "error: injected history failure" });
  record.mock.restore();
  assert.deepEqual(snapshot(session), before);
});

test("boundary history preparation failure cannot replace the document or clear read path", async t => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("r", 1, 2));
  const before = snapshot(session);
  const boundary = t.mock.method(CommandHistory.prototype, "blockAndClear", () => { throw new Error("injected boundary failure"); });
  await assert.rejects(executor.execute(new InitCommand(200, 300)), { message: "error: injected boundary failure" });
  boundary.mock.restore();
  assert.deepEqual(snapshot(session), before);
});

test("result preparation failure cannot commit an edited candidate", async () => {
  const { session, executor } = fixture();
  const before = snapshot(session);
  const command: Command = { name: "bad-result", effect: "edit", async execute(context) {
    context.requireDocument().find("r").move(4, 5);
    return new CommandResult("bad-result", { uncloneable: () => 1 });
  } };
  await assert.rejects(executor.execute(command), /^ModelError: error:/);
  assert.deepEqual(snapshot(session), before);
});

test("undo and redo clone failures leave their stack positions and live document unchanged", async t => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("r", 1, 2));
  for (const operation of [() => executor.undo(), () => executor.redo()]) {
    const before = snapshot(session);
    const clone = t.mock.method(Document.prototype, "clone", () => { throw new Error("injected restore failure"); });
    await assert.rejects(operation(), { message: "error: injected restore failure" });
    clone.mock.restore();
    assert.deepEqual(snapshot(session), before);
    await operation();
  }
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
});

test("a retained draft cannot mutate the committed document or saved history", async () => {
  const { session, executor } = fixture();
  let retained: CommandContext | undefined;
  const command: Command = { name: "retaining", effect: "edit", async execute(context) {
    retained = context;
    context.requireDocument().find("r").move(1, 2);
    return new CommandResult("retaining", { value: 1 }, ["example warning"]);
  } };
  const result = await executor.execute(command);
  assert.deepEqual(result.warnings, ["example warning"]);
  retained!.requireDocument().delete("r");
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
  await executor.undo();
  await executor.redo();
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
});

test("query drafts cannot mutate live state, read path or history", async () => {
  const { session, executor } = fixture();
  const before = snapshot(session);
  const command: Command = { name: "mutating-query", effect: "query", async execute(context) {
    context.replaceDocument(new Document(1, 1), "wrong.svg");
    return new CommandResult("mutating-query", {});
  } };
  await executor.execute(command);
  assert.deepEqual(snapshot(session), before);
});

test("an edit cannot change the read path through its draft context", async () => {
  const { session, executor } = fixture();
  const before = snapshot(session);
  const command: Command = { name: "path-edit", effect: "edit", async execute(context) {
    context.replaceDocument(context.requireDocument(), "wrong.svg");
    return new CommandResult("path-edit", {});
  } };
  await assert.rejects(executor.execute(command), { message: "error: edit command cannot change read path" });
  assert.deepEqual(snapshot(session), before);
});

test("overlapping edit/query/undo/redo calls reject; awaited calls cannot overwrite each other", async () => {
  const { session, executor } = fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const before = snapshot(session);
  const slow: Command = { name: "slow", effect: "edit", async execute(context) {
    context.requireDocument().find("r").move(10, 20);
    await gate;
    return new CommandResult("slow", {});
  } };
  const pending = executor.execute(slow);
  for (const operation of [() => executor.execute(new MoveCommand("r", 100, 100)), () => executor.execute(new CanvasCommand()), () => executor.undo(), () => executor.redo()]) {
    await assert.rejects(operation(), { message: "error: command executor is busy" });
  }
  assert.deepEqual(snapshot(session), before);
  release();
  await pending;
  await executor.execute(new MoveCommand("r", 1, 2));
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 12);
  assert.equal(session.historyStatus.undoCount, 2);
});

test("independent sessions run concurrently and a failed async command releases its executor", async () => {
  const first = fixture(), second = fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = first.executor.execute({ name: "async-failure", effect: "edit", async execute() {
    await gate;
    throw new Error("later failure");
  } });
  const rejected = assert.rejects(pending, { message: "error: later failure" });
  await second.executor.execute(new MoveCommand("r", 50, 0));
  assert.equal(second.session.requireDocument().find("r").getAttribute("x"), 51);
  release();
  await rejected;
  await first.executor.execute(new MoveCommand("r", 1, 0));
  assert.equal(first.session.requireDocument().find("r").getAttribute("x"), 2);
});
