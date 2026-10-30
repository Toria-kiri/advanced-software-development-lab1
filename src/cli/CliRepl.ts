import { createInterface } from "node:readline";
import { Readable, Writable } from "node:stream";
import { CommandExecutor } from "../commands/CommandExecutor";
import { CliRenderer } from "./CliRenderer";
import { CommandDispatcher } from "./CommandDispatcher";
import { CommandParser } from "./CommandParser";

export class CliRepl {
  readonly #executor: CommandExecutor;
  readonly #parser: CommandParser;
  readonly #dispatcher: CommandDispatcher;
  readonly #renderer: CliRenderer;

  constructor(executor: CommandExecutor, parser: CommandParser, dispatcher: CommandDispatcher, renderer: CliRenderer) {
    this.#executor = executor;
    this.#parser = parser;
    this.#dispatcher = dispatcher;
    this.#renderer = renderer;
  }

  async run(input: Readable, output: Writable, errors: Writable = output): Promise<void> {
    const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
    try {
      output.write("svg> ");
      for await (const line of lines) {
        try {
          const tokens = this.#parser.tokenize(line);
          if (tokens.length) {
            const action = this.#dispatcher.create(tokens);
            output.write(`${await action.execute(this.#executor, this.#renderer)}\n`);
          }
        } catch (error) {
          errors.write(`${this.#renderer.error(error)}\n`);
        }
        output.write("svg> ");
      }
    } finally {
      lines.close();
      output.write("\n");
    }
  }
}
