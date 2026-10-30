import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class UngroupCommand implements Command {
  readonly name = "ungroup";
  readonly effect = "edit" as const;
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.ungroup(this.#id);
    return new CommandResult(this.name, { id: this.#id });
  }
}
