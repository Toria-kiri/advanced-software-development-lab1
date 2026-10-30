import { ModelError } from "../model/ModelError";
import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";
import { EditorSession } from "./EditorSession";

export class CommandExecutor {
  readonly #controller: ReturnType<EditorSession["claimController"]>;
  #busy = false;

  constructor(session: EditorSession) { this.#controller = session.claimController(); }

  async execute<T>(command: Command<T>): Promise<CommandResult<T>> {
    return this.exclusive(async () => {
      const state = this.#controller.read();
      const effect = command.effect;
      if (effect !== "edit" && effect !== "boundary" && effect !== "query") {
        throw new ModelError("invalid command effect");
      }
      if (!state.document && (command.requiresDocument !== false || effect === "edit")) {
        throw new ModelError("no document. use 'init' or 'read' first");
      }
      const context = new CommandContext(state.document?.clone(), state.readPath);
      const raw = await command.execute(context);
      // Result materialization may also fail; it must finish before committing state.
      const result = new CommandResult(raw.operation, raw.data, raw.warnings);
      if (context.hasBeforeCommit && effect !== "boundary") {
        throw new ModelError("external writes require a boundary command");
      }
      if (effect === "query") return result;
      const candidate = context.requireDocument();
      candidate.validate();
      if (effect === "edit" && context.readPath !== state.readPath) {
        throw new ModelError("edit command cannot change read path");
      }
      // Isolate the live document from references retained by a command/context.
      const document = candidate.clone();
      document.validate();
      const history = effect === "edit"
        ? state.history.record(command.name, state.document!, document)
        : state.history.blockAndClear();
      const prepared = Object.freeze({ document, readPath: context.readPath, history });
      // Prepare the write's isolated input too, before touching the filesystem.
      const beforeCommit = context.prepareBeforeCommit(document);
      if (beforeCommit) await beforeCommit();
      this.#controller.commit(prepared);
      return result;
    });
  }

  async undo(): Promise<CommandResult<{ command: string }>> {
    return this.restore(false);
  }

  async redo(): Promise<CommandResult<{ command: string }>> {
    return this.restore(true);
  }

  private async restore(redo: boolean): Promise<CommandResult<{ command: string }>> {
    return this.exclusive(async () => {
      const state = this.#controller.read();
      if (!state.document) throw new ModelError("no document. use 'init' or 'read' first");
      const transition = redo ? state.history.prepareRedo() : state.history.prepareUndo();
      const result = new CommandResult(redo ? "redo" : "undo", { command: transition.command });
      const prepared = Object.freeze({ document: transition.document, readPath: state.readPath, history: transition.history });
      this.#controller.commit(prepared);
      return result;
    });
  }

  /** Overlapping calls reject immediately. Await each operation before the next. */
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#busy) throw new ModelError("command executor is busy");
    this.#busy = true;
    try { return await operation(); }
    catch (error) {
      if (error instanceof ModelError) throw error;
      throw new ModelError(error instanceof Error ? error.message : "command failed");
    }
    finally { this.#busy = false; }
  }
}
