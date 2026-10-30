import { ModelError } from "../model/ModelError";
import { Command, CommandEffect } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export class CanvasCommand implements Command {
  readonly name = "canvas";
  readonly #width: number | undefined;
  readonly #height: number | undefined;

  constructor(width?: number, height?: number) { this.#width = width; this.#height = height; }

  get effect(): CommandEffect {
    return this.#width === undefined && this.#height === undefined ? "query" : "boundary";
  }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    if (this.effect === "boundary") {
      if (this.#width === undefined || this.#height === undefined) throw new ModelError("canvas requires both width and height");
      document.resize(this.#width, this.#height);
    }
    return new CommandResult(this.name, { width: document.width, height: document.height });
  }
}
