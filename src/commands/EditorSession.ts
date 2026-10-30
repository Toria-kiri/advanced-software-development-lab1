import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";
import { CommandHistory, HistoryStatus } from "./CommandHistory";

interface SessionState {
  readonly document: Document | undefined;
  readonly readPath: string | undefined;
  readonly history: CommandHistory;
}

export class EditorSession {
  #state: SessionState;
  #claimed = false;

  constructor(document?: Document, readPath?: string) {
    if (readPath !== undefined && !document) throw new ModelError("read path requires a document");
    document?.validate();
    this.#state = Object.freeze({ document: document?.clone(), readPath, history: CommandHistory.empty() });
  }

  get hasDocument(): boolean { return this.#state.document !== undefined; }
  get readPath(): string | undefined { return this.#state.readPath; }
  get historyStatus(): HistoryStatus { return this.#state.history.status; }

  /** Callers receive a copy, so they cannot edit a live document outside the executor. */
  requireDocument(): Document {
    if (!this.#state.document) throw new ModelError("no document. use 'init' or 'read' first");
    return this.#state.document.clone();
  }

  /** @internal One-time binding; its capabilities are held only by CommandExecutor. */
  claimController(): {
    read: () => SessionState;
    commit: (prepared: SessionState) => void;
  } {
    if (this.#claimed) throw new ModelError("session already has an executor");
    this.#claimed = true;
    return Object.freeze({
      read: () => this.#state,
      // No allocation, validation, user callbacks or IO during this single assignment.
      commit: (prepared: SessionState): void => { this.#state = prepared; },
    });
  }
}
