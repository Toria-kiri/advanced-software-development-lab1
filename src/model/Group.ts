import { ModelError } from "./ModelError";
import { Shape } from "./Shape";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export class Group extends Shape {
  readonly #children: readonly Shape[];

  constructor(id: string, children: readonly Shape[] = [], style: ShapeStyle = {}) {
    super(id, style);
    const ids = new Set<string>();
    const visit = (shape: Shape): void => {
      if (ids.has(shape.id)) throw new ModelError(`id already exists: ${shape.id}`);
      ids.add(shape.id);
      if (shape instanceof Group) shape.getChildren().forEach(visit);
    };
    ids.add(this.id);
    children.forEach(visit);
    this.#children = Object.freeze([...children]);
  }

  get type(): string { return "g"; }
  getChildren(): readonly Shape[] { return this.#children; }

  /** Builds a detached value; never changes this group's child membership. */
  withChildren(children: readonly Shape[]): Group {
    return new Group(this.id, children, this.getStyle());
  }

  clone(): Group { return this.withChildren(this.#children.map(child => child.clone())); }
  toSvgNode(): SvgNode { return this.makeNode({}, this.#children.map(child => child.toSvgNode())); }
  protected geometrySummary(): string { return ""; }

  protected planMove(dx: number, dy: number): () => void {
    const updates = this.#children.map(child => Shape.childMove(child, dx, dy));
    return () => updates.forEach(apply => apply());
  }

  protected planScale(factor: number): () => void {
    const updates = this.#children.map(child => Shape.childScale(child, factor));
    return () => updates.forEach(apply => apply());
  }
}
