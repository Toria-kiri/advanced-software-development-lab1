import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";

interface HistoryEntry {
  readonly command: string;
  readonly before: Document;
  readonly after: Document;
}

export interface HistoryStatus {
  readonly undoCount: number;
  readonly redoCount: number;
  readonly blocked: boolean;
}

/** Immutable history states: preparing a transition cannot mutate the current stacks. */
export class CommandHistory {
  readonly #undo: readonly HistoryEntry[];
  readonly #redo: readonly HistoryEntry[];
  readonly #blocked: boolean;

  private constructor(undo: readonly HistoryEntry[], redo: readonly HistoryEntry[], blocked: boolean) {
    this.#undo = Object.freeze([...undo]);
    this.#redo = Object.freeze([...redo]);
    this.#blocked = blocked;
  }

  static empty(): CommandHistory { return new CommandHistory([], [], false); }

  get status(): HistoryStatus {
    return Object.freeze({ undoCount: this.#undo.length, redoCount: this.#redo.length, blocked: this.#blocked });
  }

  record(command: string, before: Document, after: Document): CommandHistory {
    const entry = Object.freeze({ command, before: before.clone(), after: after.clone() });
    return new CommandHistory([...this.#undo, entry], [], false);
  }

  blockAndClear(): CommandHistory { return new CommandHistory([], [], true); }

  prepareUndo(): { document: Document; history: CommandHistory; command: string } {
    this.checkAllowed();
    const entry = this.#undo.at(-1);
    if (!entry) throw new ModelError("nothing to undo");
    const document = entry.before.clone();
    document.validate();
    return { document, history: new CommandHistory(this.#undo.slice(0, -1), [...this.#redo, entry], false), command: entry.command };
  }

  prepareRedo(): { document: Document; history: CommandHistory; command: string } {
    this.checkAllowed();
    const entry = this.#redo.at(-1);
    if (!entry) throw new ModelError("nothing to redo");
    const document = entry.after.clone();
    document.validate();
    return { document, history: new CommandHistory([...this.#undo, entry], this.#redo.slice(0, -1), false), command: entry.command };
  }

  private checkAllowed(): void {
    if (this.#blocked) throw new ModelError("undo not allowed after io command");
  }
}
