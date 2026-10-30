import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class BackCommand implements Command {
  readonly name = "back";
  readonly effect = "edit" as const;
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.sendToBack(this.#id);
    return new CommandResult(this.name, { id: this.#id, parentId: document.getParentId(this.#id), position: document.getPosition(this.#id) });
  }
}
