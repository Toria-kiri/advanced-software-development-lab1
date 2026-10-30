import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { ShapeDescription } from "../model/ShapeDescription";
import { Command } from "./Command";
import { CommandContext } from "./CommandContext";
import { CommandResult } from "./CommandResult";

export interface TreeNode {
  readonly shape: ShapeDescription;
  readonly parentId: string | null;
  readonly position: number;
  readonly children: readonly TreeNode[];
}

export class TreeCommand implements Command {
  readonly name = "tree";
  readonly effect = "query" as const;
  readonly #id: string | undefined;

  constructor(id?: string) { this.#id = id; }

  async execute(context: CommandContext) {
    const document = context.requireDocument();
    const visit = (shape: Shape): TreeNode => ({
      shape: shape.describe(), parentId: document.getParentId(shape.id), position: document.getPosition(shape.id),
      children: shape instanceof Group ? shape.getChildren().map(visit) : [],
    });
    const roots = this.#id === undefined ? document.getRoots() : [document.find(this.#id)];
    return new CommandResult(this.name, { width: document.width, height: document.height, roots: roots.map(visit) });
  }
}
