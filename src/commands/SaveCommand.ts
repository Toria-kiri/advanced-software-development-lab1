import { SvgStore } from "../io/SvgStore";
import { ModelError } from "../model/ModelError";
import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class SaveCommand implements Command {
  readonly name = "save";
  readonly effect = "boundary" as const;
  readonly #store: SvgStore;
  readonly #path: string | undefined;

  constructor(store: SvgStore, path?: string) { this.#store = store; this.#path = path; }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    const path = this.#path ?? context.readPath;
    if (path === undefined) throw new ModelError("no read path. specify a save path");
    context.deferBeforeCommit(snapshot => this.#store.write(path, snapshot));
    return new CommandResult(this.name, { path, size: document.size });
  }
}
