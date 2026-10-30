import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class MoveCommand implements Command {
  readonly name = "move";
  readonly effect = "edit" as const;
  readonly #id: string;
  readonly #dx: number;
  readonly #dy: number;

  constructor(id: string, dx: number, dy: number) {
    this.#id = id;
    this.#dx = dx;
    this.#dy = dy;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    document.find(this.#id).move(this.#dx, this.#dy);
    return new CommandResult(this.name, { shape: document.find(this.#id).describe(), parentId: document.getParentId(this.#id) });
  }
}
