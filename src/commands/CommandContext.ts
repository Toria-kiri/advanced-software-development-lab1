import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";

/** A command-local draft, never the live EditorSession. */
export class CommandContext {
  #document: Document | undefined;
  #readPath: string | undefined;

  constructor(document?: Document, readPath?: string) {
    this.#document = document;
    this.#readPath = readPath;
  }

  get document(): Document | undefined { return this.#document; }
  get readPath(): string | undefined { return this.#readPath; }

  requireDocument(): Document {
    if (!this.#document) throw new ModelError("no document. use 'init' or 'read' first");
    return this.#document;
  }

  replaceDocument(document: Document, readPath?: string): void {
    this.#document = document;
    this.#readPath = readPath;
  }
}
