import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class DeleteCommand implements Command {
  readonly name = "delete";
  readonly effect = "edit" as const;
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    const shape = document.find(this.#id).describe();
    const parentId = document.getParentId(this.#id);
    document.delete(this.#id);
    return new CommandResult(this.name, { id: this.#id, shape, parentId });
  }
}
