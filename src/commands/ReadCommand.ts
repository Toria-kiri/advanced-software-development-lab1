import { SvgStore } from "../io/SvgStore";
import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class ReadCommand implements Command {
  readonly name = "read";
  readonly effect = "boundary" as const;
  readonly requiresDocument = false;
  readonly #store: SvgStore;
  readonly #path: string;

  constructor(store: SvgStore, path: string) { this.#store = store; this.#path = path; }

  async execute(context: CommandContext) {
    const { document, warnings } = await this.#store.read(this.#path);
    context.replaceDocument(document, this.#path);
    return new CommandResult(this.name, { path: this.#path, width: document.width, height: document.height, size: document.size }, warnings);
  }
}
