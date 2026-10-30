import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export interface HelpEntry {
  readonly name: string;
  readonly syntax: string;
  readonly description: string;
}

export class HelpCommand implements Command {
  readonly name = "help";
  readonly effect = "query" as const;
  readonly #entries: readonly HelpEntry[];

  constructor(entries: readonly HelpEntry[]) {
    this.#entries = Object.freeze(entries.map(entry => Object.freeze({ ...entry })));
  }

  async execute(context: CommandContext) {
    context.requireDocument(); // Strict no-document rule from the assignment.
    return new CommandResult(this.name, { entries: this.#entries });
  }
}
