import assert from "node:assert/strict";
import { test } from "node:test";
import { Document } from "../src/model/Document";
import { Rect } from "../src/model/Rect";
import { CanvasCommand } from "../src/commands/CanvasCommand";
import { Command } from "../src/commands/Command";
import { CommandHistory } from "../src/commands/CommandHistory";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { CreateCommand } from "../src/commands/CreateCommand";
import { EditorSession } from "../src/commands/EditorSession";
import { HelpCommand } from "../src/commands/HelpCommand";
import { InitCommand } from "../src/commands/InitCommand";
import { MoveCommand } from "../src/commands/MoveCommand";
import { ScaleCommand } from "../src/commands/ScaleCommand";
import { SetCommand } from "../src/commands/SetCommand";
import { ShowCommand } from "../src/commands/ShowCommand";
import { TreeCommand } from "../src/commands/TreeCommand";

function fixture() {
  const session = new EditorSession(new Document(100, 100, [new Rect("r", 0.1, 0.2, 3, 4)]), "input.svg");
  return { session, executor: new CommandExecutor(session) };
}

test("continuous undo/redo reproduces each exact full snapshot without inverse arithmetic", async () => {
  const { session, executor } = fixture();
  const snapshots = [session.requireDocument().toSvgNode()];
  for (const command of [new MoveCommand("r", 0.2, 0.3), new ScaleCommand("r", 0.3), new SetCommand("r", "fill", "red")]) {
    await executor.execute(command);
    snapshots.push(session.requireDocument().toSvgNode());
  }
  for (let i = 2; i >= 0; i--) {
    await executor.undo();
    assert.deepEqual(session.requireDocument().toSvgNode(), snapshots[i]);
  }
  assert.equal(session.requireDocument().find("r").getStyle().fill, undefined);
  for (let i = 1; i <= 3; i++) {
    await executor.redo();
    assert.deepEqual(session.requireDocument().toSvgNode(), snapshots[i]);
  }
});

test("new edit after undo clears redo; a successful no-op is still one history unit", async () => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("r", 1, 1));
  await executor.undo();
  await executor.execute(new MoveCommand("r", 0, 0));
  assert.deepEqual(session.historyStatus, { undoCount: 1, redoCount: 0, blocked: false });
  await assert.rejects(executor.redo(), { message: "error: nothing to redo" });
  await executor.undo();
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 0.1);
});

test("queries preserve pending redo and do not create history entries", async () => {
  const { session, executor } = fixture();
  await executor.execute(new SetCommand("r", "stroke", "blue"));
  await executor.undo();
  const status = session.historyStatus;
  const queries: Command[] = [new CanvasCommand(), new TreeCommand(), new ShowCommand("r"), new HelpCommand([])];
  for (const query of queries) {
    await executor.execute(query);
    assert.deepEqual(session.historyStatus, status);
  }
  await executor.redo();
  assert.equal(session.requireDocument().find("r").getStyle().stroke, "blue");
});

for (const boundary of [() => new InitCommand(200, 300), () => new CanvasCommand(200, 300)]) {
  const name = boundary().name;
  test(`${name} boundary blocks both history directions until a successful edit`, async () => {
    const { session, executor } = fixture();
    await executor.execute(new MoveCommand("r", 1, 2));
    await executor.undo();
    await executor.execute(boundary());
    const baseline = session.requireDocument().toSvgNode();
    for (const operation of [() => executor.undo(), () => executor.redo()]) {
      await assert.rejects(operation(), { message: "error: undo not allowed after io command" });
    }
    await executor.execute(new CanvasCommand());
    await executor.execute(new HelpCommand([]));
    assert.equal(session.historyStatus.blocked, true);
    await assert.rejects(executor.execute(new MoveCommand("missing", 1, 2)));
    assert.equal(session.historyStatus.blocked, true);
    await executor.execute(new CreateCommand("circle", "new", [0, 0, 1]));
    assert.deepEqual(session.historyStatus, { undoCount: 1, redoCount: 0, blocked: false });
    await executor.undo();
    assert.deepEqual(session.requireDocument().toSvgNode(), baseline);
    await assert.rejects(executor.undo(), { message: "error: nothing to undo" });
    await executor.redo();
    assert.equal(session.requireDocument().find("new").type, "circle");
  });
}

test("failed init/canvas cannot alter a blocked baseline, read path or state", async () => {
  const { session, executor } = fixture();
  await executor.execute(new CanvasCommand(200, 300));
  const baseline = session.requireDocument().toSvgNode();
  const status = session.historyStatus;
  for (const command of [new InitCommand(-1, 100), new CanvasCommand(0, 100), new CanvasCommand(100, Infinity)]) {
    await assert.rejects(executor.execute(command));
    assert.deepEqual(session.requireDocument().toSvgNode(), baseline);
    assert.deepEqual(session.historyStatus, status);
    assert.equal(session.readPath, "input.svg");
  }
});

test("empty history differs from the IO-blocked state, with unchanged counts", async () => {
  const { session, executor } = fixture();
  await assert.rejects(executor.undo(), { message: "error: nothing to undo" });
  await assert.rejects(executor.redo(), { message: "error: nothing to redo" });
  assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: false });
});

test("immutable history isolates before/after snapshots from inputs and restored documents", () => {
  const before = new Document(100, 100, [new Rect("r", 1, 2, 3, 4)]);
  const after = before.clone();
  after.find("r").move(1, 1);
  const empty = CommandHistory.empty();
  const recorded = empty.record("move", before, after);
  before.delete("r");
  after.delete("r");
  assert.deepEqual(empty.status, { undoCount: 0, redoCount: 0, blocked: false });
  const undo = recorded.prepareUndo();
  assert.equal(undo.document.find("r").getAttribute("x"), 1);
  undo.document.delete("r");
  const redo = undo.history.prepareRedo();
  assert.equal(redo.document.find("r").getAttribute("x"), 2);
  redo.document.find("r").move(99, 99);
  assert.equal(recorded.prepareUndo().document.find("r").getAttribute("x"), 1);
  assert.equal(undo.history.prepareRedo().document.find("r").getAttribute("x"), 2);
});

test("reusing a command after undo looks up current ids rather than obsolete shape references", async () => {
  const { session, executor } = fixture();
  const move = new MoveCommand("r", 3, 4);
  await executor.execute(move);
  await executor.undo();
  await executor.execute(move);
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 3.1);
  assert.equal(session.historyStatus.redoCount, 0);
});

test("session inspection copies cannot corrupt live state or later undo/redo", async () => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("r", 1, 1));
  const external = session.requireDocument();
  external.delete("r");
  external.resize(1, 1);
  await executor.undo();
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 0.1);
  await executor.redo();
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 1.1);
  assert.equal(session.requireDocument().width, 100);
});
