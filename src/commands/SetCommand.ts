import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class SetCommand implements Command {
  readonly name = "set";
  readonly effect = "edit" as const;
  readonly #id: string;
  readonly #attribute: string;
  readonly #value: string | number;

  constructor(id: string, attribute: string, value: string | number) {
    this.#id = id;
    this.#attribute = attribute;
    this.#value = value;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.find(this.#id).setAttribute(this.#attribute, this.#value);
    return new CommandResult(this.name, { shape: document.find(this.#id).describe(), parentId: document.getParentId(this.#id) });
  }
}
