import { Document } from "../model/Document";
import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class InitCommand implements Command {
  readonly name = "init";
  readonly effect = "boundary" as const;
  readonly requiresDocument = false;
  readonly #width: number;
  readonly #height: number;

  constructor(width = 800, height = 600) {
    this.#width = width;
    this.#height = height;
  }

  async execute(context: CommandContext) {
    const document = new Document(this.#width, this.#height);
    context.replaceDocument(document); // init clears the previous read path (D4).
    return new CommandResult(this.name, { width: document.width, height: document.height });
  }
}
