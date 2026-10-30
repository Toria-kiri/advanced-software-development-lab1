import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class GroupCommand implements Command {
  readonly name = "group";
  readonly effect = "edit" as const;
  readonly #id: string;
  readonly #ids: readonly string[];

  constructor(id: string, ids: readonly string[]) {
    this.#id = id;
    this.#ids = Object.freeze([...ids]);
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    const shape = document.group(this.#id, this.#ids);
    return new CommandResult(this.name, { shape: shape.describe(), parentId: document.getParentId(shape.id) });
  }
}
