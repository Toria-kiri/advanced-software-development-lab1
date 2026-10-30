import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export type CommandEffect = "edit" | "boundary" | "query";

export interface Command<T = unknown> {
  readonly name: string;
  readonly effect: CommandEffect;
  /** Only commands that can create a document may opt out. */
  readonly requiresDocument?: boolean;
  execute(context: CommandContext): Promise<CommandResult<T>>;
}
