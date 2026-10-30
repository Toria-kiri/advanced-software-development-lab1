import { ModelError } from "./ModelError";
import { ModelValue } from "./ModelValue";
import { ShapeDescription } from "./ShapeDescription";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export abstract class Shape {
  readonly #id: string;
  #style: ShapeStyle;

  protected constructor(id: string, style: ShapeStyle = {}) {
    this.#id = ModelValue.id(id);
    // Reject unsupported keys rather than silently discarding imported styles.
    this.#style = {};
    for (const [name, value] of Object.entries(style)) {
      if (name !== "fill" && name !== "stroke" && name !== "stroke-width") {
        throw new ModelError(`unknown attribute: ${name}`);
      }
      this.setAttribute(name, value);
    }
  }

  get id(): string { return this.#id; }
  abstract get type(): string;
  getStyle(): ShapeStyle { return Object.freeze({ ...this.#style }); }

  getAttribute(name: string): string | number | undefined {
    const attrs = this.toSvgNode().attributes;
    return Object.hasOwn(attrs, name) ? attrs[name] : undefined;
  }

  move(dx: number, dy: number): void {
    const apply = this.planMove(ModelValue.number(dx, "dx"), ModelValue.number(dy, "dy"));
    apply();
  }

  scale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new ModelError("scale factor must be positive");
    }
    this.planScale(factor)();
  }

  setAttribute(name: string, value: unknown): void {
    if (name === "fill" || name === "stroke") {
      this.#style = { ...this.#style, [name]: ModelValue.text(value, name) };
    } else if (name === "stroke-width") {
      this.#style = { ...this.#style, [name]: ModelValue.nonNegative(value, name) };
    } else {
      this.setGeometryAttribute(name, value);
    }
  }

  describe(): ShapeDescription {
    const node = this.toSvgNode();
    return Object.freeze({
      id: this.id, type: this.type, attributes: node.attributes,
      summary: `${this.type}#${this.id}${this.geometrySummary()}`,
      ...(node.text === undefined ? {} : { text: node.text }),
    });
  }

  abstract clone(): Shape;
  abstract toSvgNode(): SvgNode;
  protected abstract planMove(dx: number, dy: number): () => void;
  protected abstract planScale(factor: number): () => void;
  protected abstract geometrySummary(): string;

  protected setGeometryAttribute(name: string, _value: unknown): void {
    throw new ModelError(`unknown attribute: ${name}`);
  }

  protected makeNode(geometry: Record<string, number> = {}, children: readonly SvgNode[] = [], text?: string): SvgNode {
    return Object.freeze({
      tag: this.type,
      attributes: Object.freeze({ id: this.id, ...geometry, ...this.#style }),
      children: Object.freeze([...children]),
      ...(text === undefined ? {} : { text }),
    });
  }

  // A Group can prepare every descendant before committing any coordinate.
  protected static childMove(child: Shape, dx: number, dy: number): () => void {
    return child.planMove(dx, dy);
  }
  protected static childScale(child: Shape, factor: number): () => void {
    return child.planScale(factor);
  }
}
