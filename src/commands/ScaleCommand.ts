import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class ScaleCommand implements Command {
  readonly name = "scale";
  readonly effect = "edit" as const;
  readonly #id: string;
  readonly #factor: number;

  constructor(id: string, factor: number) {
    this.#id = id;
    this.#factor = factor;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.find(this.#id).scale(this.#factor);
    return new CommandResult(this.name, { shape: document.find(this.#id).describe(), parentId: document.getParentId(this.#id) });
  }
}
