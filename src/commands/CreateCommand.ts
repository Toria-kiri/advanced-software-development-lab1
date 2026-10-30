import { ShapeFactory } from "../model/ShapeFactory";
import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class CreateCommand implements Command {
  readonly name = "create";
  readonly effect = "edit" as const;
  readonly #type: string;
  readonly #id: string;
  readonly #params: readonly (string | number)[];
  readonly #containerId: string | null;

  constructor(type: string, id: string, params: readonly (string | number)[] = [], containerId: string | null = null) {
    this.#type = type;
    this.#id = id;
    this.#params = Object.freeze([...params]);
    this.#containerId = containerId;
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    const shape = document.insert(new ShapeFactory().create(this.#type, this.#id, this.#params), this.#containerId);
    return new CommandResult(this.name, { shape: shape.describe(), parentId: document.getParentId(shape.id) });
  }
}
