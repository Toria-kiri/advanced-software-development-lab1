import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class FrontCommand implements Command {
  readonly name = "front";
  readonly effect = "edit" as const;
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.bringToFront(this.#id);
    return new CommandResult(this.name, { id: this.#id, parentId: document.getParentId(this.#id), position: document.getPosition(this.#id) });
  }
}
