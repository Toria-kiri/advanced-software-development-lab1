import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class AddToCommand implements Command {
  readonly name = "addto";
  readonly effect = "edit" as const;
  readonly #groupId: string;
  readonly #id: string;

  constructor(groupId: string, id: string) {
    this.#groupId = groupId;
    this.#id = id;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.addTo(this.#groupId, this.#id);
    return new CommandResult(this.name, { id: this.#id, parentId: document.getParentId(this.#id) });
  }
}
