import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";

/** A command-local draft, never the live EditorSession. */
export class CommandContext {
  #document: Document | undefined;
  #readPath: string | undefined;
  #beforeCommit: ((document: Document) => Promise<void>) | undefined;

  constructor(document?: Document, readPath?: string) {
    this.#document = document;
    this.#readPath = readPath;
  }

  get document(): Document | undefined { return this.#document; }
  get readPath(): string | undefined { return this.#readPath; }
  get hasBeforeCommit(): boolean { return this.#beforeCommit !== undefined; }

  requireDocument(): Document {
    if (!this.#document) throw new ModelError("no document. use 'init' or 'read' first");
    return this.#document;
  }

  replaceDocument(document: Document, readPath?: string): void {
    this.#document = document;
    this.#readPath = readPath;
  }

  /** Boundary commands may defer one external write until memory preparation succeeds. */
  deferBeforeCommit(effect: (document: Document) => Promise<void>): void {
    if (this.#beforeCommit) throw new ModelError("only one before-commit effect is allowed");
    this.#beforeCommit = effect;
  }

  prepareBeforeCommit(document: Document): (() => Promise<void>) | undefined {
    const effect = this.#beforeCommit;
    if (!effect) return undefined;
    const detached = document.clone();
    detached.validate();
    return () => effect(detached);
  }
}
