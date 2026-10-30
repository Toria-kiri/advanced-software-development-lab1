import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class ShowCommand implements Command {
  readonly name = "show";
  readonly effect = "query" as const;
  readonly #id: string;

  constructor(id: string) { this.#id = id; }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    return new CommandResult(this.name, {
      shape: document.find(this.#id).describe(), parentId: document.getParentId(this.#id), position: document.getPosition(this.#id),
    });
  }
}
