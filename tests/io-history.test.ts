import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Command } from "../src/commands/Command";
import { CommandExecutor } from "../src/commands/CommandExecutor";
import { CommandHistory } from "../src/commands/CommandHistory";
import { CommandResult } from "../src/commands/CommandResult";
import { EditorSession } from "../src/commands/EditorSession";
import { InitCommand } from "../src/commands/InitCommand";
import { MoveCommand } from "../src/commands/MoveCommand";
import { ReadCommand } from "../src/commands/ReadCommand";
import { SaveCommand } from "../src/commands/SaveCommand";
import { ShowCommand } from "../src/commands/ShowCommand";
import { SvgFileStore } from "../src/io/SvgFileStore";
import { SvgStore } from "../src/io/SvgStore";
import { Document } from "../src/model/Document";
import { complexDocument, semanticState, temporaryDirectory } from "./io-fixtures";

function fixture() {
  const session = new EditorSession(complexDocument(), "original.svg");
  return { session, executor: new CommandExecutor(session) };
}
const state = (session: EditorSession) => ({ document: semanticState(session.requireDocument()), path: session.readPath, history: session.historyStatus });

test("real read works before init, emits missing-id warnings and installs a blocked baseline", async t => {
  const directory = await temporaryDirectory(t), file = join(directory, "read.svg"), store = new SvgFileStore();
  await fs.writeFile(file, '<svg width="50" height="60"><rect width="2" height="3"/></svg>');
  const session = new EditorSession(), executor = new CommandExecutor(session);
  const result = await executor.execute(new ReadCommand(store, file));
  assert.deepEqual(result.warnings, ["warning: assigned id rect1 to unnamed <rect>"]);
  assert.equal(session.readPath, file);
  assert.equal(session.requireDocument().width, 50);
  assert.equal(session.requireDocument().find("rect1").getAttribute("width"), 2);
  assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
  await assert.rejects(executor.undo(), /undo not allowed after io command/);
  await assert.rejects(executor.redo(), /undo not allowed after io command/);
  await executor.execute(new MoveCommand("rect1", 1, 2)); await executor.undo();
  assert.equal(session.requireDocument().find("rect1").getAttribute("x"), 0);
  await assert.rejects(executor.undo(), /nothing to undo/);
});

test("D4 default save follows latest read; save-as preserves readPath and init clears it", async t => {
  const directory = await temporaryDirectory(t), first = join(directory, "first.svg"), second = join(directory, "second.svg"), as = join(directory, "save as.svg");
  const store = new SvgFileStore(), { session, executor } = fixture();
  await store.write(first, complexDocument()); await store.write(second, new Document(10, 20));
  await executor.execute(new ReadCommand(store, first));
  await executor.execute(new MoveCommand("r", 1, 2));
  const before = semanticState(session.requireDocument());
  await executor.execute(new SaveCommand(store, as));
  assert.equal(session.readPath, first);
  assert.deepEqual(semanticState(session.requireDocument()), before);
  assert.deepEqual(semanticState((await store.read(as)).document), before);
  assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
  await assert.rejects(executor.undo(), /undo not allowed after io command/);
  await assert.rejects(executor.redo(), /undo not allowed after io command/);
  await executor.execute(new MoveCommand("r", 1, 2)); await executor.undo(); await executor.redo();
  await executor.execute(new SaveCommand(store));
  assert.equal((await store.read(first)).document.find("r").getAttribute("x"), 3);
  await executor.execute(new ReadCommand(store, second));
  await executor.execute(new SaveCommand(store));
  assert.equal(session.readPath, second);
  await executor.execute(new InitCommand());
  assert.equal(session.readPath, undefined);
  const baseline = state(session);
  await assert.rejects(executor.execute(new SaveCommand(store)), /no read path/);
  assert.deepEqual(state(session), baseline);
});

test("save-as alone does not establish a default read path", async t => {
  const directory = await temporaryDirectory(t), session = new EditorSession(), executor = new CommandExecutor(session), store = new SvgFileStore();
  await executor.execute(new InitCommand());
  await executor.execute(new SaveCommand(store, join(directory, "out.svg")));
  assert.equal(session.readPath, undefined);
  await assert.rejects(executor.execute(new SaveCommand(store)), /no read path/);
});

test("real failed reads and saves preserve document, indexes, both stacks, blocked and readPath", async t => {
  const directory = await temporaryDirectory(t), bad = join(directory, "bad.svg"), store = new SvgFileStore(), { session, executor } = fixture();
  await fs.writeFile(bad, '<svg width="1" height="1"><path/></svg>');
  await executor.execute(new MoveCommand("r", 1, 2));
  await executor.execute(new MoveCommand("r", 1, 2)); await executor.undo();
  const before = state(session);
  for (const command of [new ReadCommand(store, bad), new ReadCommand(store, join(directory, "missing.svg")), new SaveCommand(store, join(directory, "missing", "out.svg"))]) {
    await assert.rejects(executor.execute(command));
    assert.deepEqual(state(session), before);
  }
  await executor.redo(); assert.equal(session.requireDocument().find("r").getAttribute("x"), 3);
  await executor.execute(new SaveCommand(store, join(directory, "baseline.svg")));
  const blocked = state(session);
  await assert.rejects(executor.execute(new ReadCommand(store, bad)));
  assert.deepEqual(state(session), blocked);
});

for (const stage of [1, 2, 3]) {
  test(`save clone preparation failure at stage ${stage} does not start an external write`, async t => {
    const { session, executor } = fixture();
    await executor.execute(new MoveCommand("r", 1, 2)); await executor.undo();
    const before = state(session); let writes = 0, calls = 0;
    const store: SvgStore = { read: async () => { throw new Error("unused"); }, write: async () => { writes++; } };
    const original = Document.prototype.clone;
    const mock = t.mock.method(Document.prototype, "clone", function(this: Document) {
      if (++calls === stage) throw new Error("injected save clone failure"); return original.call(this);
    });
    await assert.rejects(executor.execute(new SaveCommand(store, "out.svg")), /save clone failure/);
    mock.mock.restore();
    assert.equal(writes, 0); assert.deepEqual(state(session), before);
    await executor.redo(); assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
  });
}

test("save history preparation failure happens before writing disk", async t => {
  const { session, executor } = fixture(), before = state(session); let writes = 0;
  const store: SvgStore = { read: async () => { throw new Error("unused"); }, write: async () => { writes++; } };
  const mock = t.mock.method(CommandHistory.prototype, "blockAndClear", () => { throw new Error("injected history failure"); });
  await assert.rejects(executor.execute(new SaveCommand(store, "out.svg")), /history failure/);
  mock.mock.restore(); assert.equal(writes, 0); assert.deepEqual(state(session), before);
});

for (const stage of [1, 2, 3]) {
  test(`save validation failure at preparation stage ${stage} cannot start a write`, async t => {
    const { session, executor } = fixture(), before = state(session); let writes = 0, calls = 0;
    const store: SvgStore = { read: async () => { throw new Error("unused"); }, write: async () => { writes++; } };
    const original = Document.prototype.validate;
    const mock = t.mock.method(Document.prototype, "validate", function(this: Document) {
      if (++calls === stage) throw new Error("injected save validation failure"); original.call(this);
    });
    await assert.rejects(executor.execute(new SaveCommand(store, "out.svg")), /save validation failure/);
    mock.mock.restore(); assert.equal(writes, 0); assert.deepEqual(state(session), before);
  });
}

test("read result preparation failure preserves the old document, path and histories", async t => {
  const { session, executor } = fixture();
  await executor.execute(new MoveCommand("r", 1, 2)); await executor.undo();
  const before = state(session); let reads = 0;
  const store: SvgStore = { read: async () => { reads++; return { document: new Document(10, 20), warnings: [] }; }, write: async () => {} };
  const mock = t.mock.method(globalThis, "structuredClone", () => { throw new Error("injected result failure"); });
  await assert.rejects(executor.execute(new ReadCommand(store, "new.svg")), /result failure/);
  mock.mock.restore(); assert.equal(reads, 1); assert.deepEqual(state(session), before);
  await executor.redo(); assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
});

test("an invalid document returned by a store cannot install a new read baseline", async () => {
  const { session, executor } = fixture(), before = state(session);
  const candidate = new Document(10, 20);
  candidate.validate = () => { throw new Error("injected invalid read document"); };
  const store: SvgStore = { read: async () => ({ document: candidate, warnings: [] }), write: async () => {} };
  await assert.rejects(executor.execute(new ReadCommand(store, "new.svg")), /invalid read document/);
  assert.deepEqual(state(session), before);
});

test("uncloneable result after deferring a write cannot produce a disk effect", async () => {
  const { session, executor } = fixture(), before = state(session); let writes = 0;
  const command: Command = { name: "save-failure", effect: "boundary", async execute(context) {
    context.deferBeforeCommit(async () => { writes++; });
    return new CommandResult("save-failure", { uncloneable: () => 1 });
  } };
  await assert.rejects(executor.execute(command));
  assert.equal(writes, 0); assert.deepEqual(state(session), before);
});

test("external write receives a detached snapshot and cannot mutate the formal document", async () => {
  const { session, executor } = fixture(), before = semanticState(session.requireDocument());
  const store: SvgStore = { read: async () => { throw new Error("unused"); }, write: async (_path, document) => { document.delete("scene"); } };
  await executor.execute(new SaveCommand(store, "out.svg"));
  assert.deepEqual(semanticState(session.requireDocument()), before);
});

for (const kind of ["read", "save"] as const) {
  test(`pending ${kind} rejects overlapping edit/query/undo/redo and commits only after IO`, { timeout: 3000 }, async () => {
    const { session, executor } = fixture();
    await executor.execute(new MoveCommand("r", 1, 2));
    const before = state(session); let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const wait = async () => { entered(); await gate; };
    const store: SvgStore = { read: async () => { await wait(); return { document: new Document(10, 20), warnings: [] }; }, write: wait };
    const pending = executor.execute(kind === "read" ? new ReadCommand(store, "new.svg") : new SaveCommand(store, "out.svg"));
    await started;
    try {
      for (const operation of [() => executor.execute(new MoveCommand("r", 1, 2)), () => executor.execute(new ShowCommand("r")), () => executor.undo(), () => executor.redo()]) {
        await assert.rejects(operation(), /command executor is busy/);
      }
      assert.deepEqual(state(session), before);
    } finally { release(); }
    await pending;
    assert.deepEqual(session.historyStatus, { undoCount: 0, redoCount: 0, blocked: true });
    assert.equal(session.readPath, kind === "read" ? "new.svg" : "original.svg");
  });
}

test("failed async write keeps all state and releases executor for later valid edits", async () => {
  const { session, executor } = fixture(), before = state(session);
  const store: SvgStore = { read: async () => { throw new Error("unused"); }, write: async () => { await Promise.resolve(); throw new Error("injected disk failure"); } };
  await assert.rejects(executor.execute(new SaveCommand(store, "out.svg")), /disk failure/);
  assert.deepEqual(state(session), before);
  await executor.execute(new MoveCommand("r", 1, 2));
  assert.equal(session.requireDocument().find("r").getAttribute("x"), 2);
});

test("only boundary commands can defer writes and duplicate registration is rejected", async () => {
  const { session, executor } = fixture(), before = state(session); let calls = 0;
  for (const effect of ["edit", "query"] as const) {
    await assert.rejects(executor.execute({ name: "bad-effect", effect, async execute(context) {
      context.deferBeforeCommit(async () => { calls++; }); return new CommandResult("bad-effect", {});
    } }), /external writes require a boundary command/);
  }
  await assert.rejects(executor.execute({ name: "duplicate", effect: "boundary", async execute(context) {
    context.deferBeforeCommit(async () => { calls++; }); context.deferBeforeCommit(async () => { calls++; });
    return new CommandResult("duplicate", {});
  } }), /only one before-commit effect/);
  assert.equal(calls, 0); assert.deepEqual(state(session), before);
});

test("injected session commit failure after disk success exposes the non-transactional window", async t => {
  const directory = await temporaryDirectory(t), path = join(directory, "written.svg"), store = new SvgFileStore();
  const session = new EditorSession(complexDocument(), "original.svg"), before = state(session);
  const claim = session.claimController.bind(session);
  t.mock.method(session, "claimController", () => ({ ...claim(), commit: () => { throw new Error("injected commit failure"); } }));
  const executor = new CommandExecutor(session);
  await assert.rejects(executor.execute(new SaveCommand(store, path)), /commit failure/);
  assert.deepEqual(state(session), before);
  assert.deepEqual(semanticState((await store.read(path)).document), before.document);
});
