import { ModelValue } from "./ModelValue";
import { Shape } from "./Shape";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export class Rect extends Shape {
  #x: number;
  #y: number;
  #width: number;
  #height: number;

  constructor(id: string, x: number, y: number, width: number, height: number, style: ShapeStyle = {}) {
    super(id, style);
    this.#x = ModelValue.number(x, "x");
    this.#y = ModelValue.number(y, "y");
    this.#width = ModelValue.nonNegative(width, "width");
    this.#height = ModelValue.nonNegative(height, "height");
  }

  get type(): string { return "rect"; }
  get x(): number { return this.#x; }
  get y(): number { return this.#y; }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }

  clone(): Rect {
    return new Rect(this.id, this.#x, this.#y, this.#width, this.#height, this.getStyle());
  }

  toSvgNode(): SvgNode {
    return this.makeNode({ x: this.#x, y: this.#y, width: this.#width, height: this.#height });
  }

  protected override setGeometryAttribute(name: string, value: unknown): void {
    if (name === "x") this.#x = ModelValue.number(value, name);
    else if (name === "y") this.#y = ModelValue.number(value, name);
    else if (name === "width") this.#width = ModelValue.nonNegative(value, name);
    else if (name === "height") this.#height = ModelValue.nonNegative(value, name);
    else super.setGeometryAttribute(name, value);
  }

  protected geometrySummary(): string { return ` x=${this.#x} y=${this.#y} w=${this.#width} h=${this.#height}`; }

  protected planMove(dx: number, dy: number): () => void {
    const x = ModelValue.number(this.#x + dx, "x");
    const y = ModelValue.number(this.#y + dy, "y");
    return () => { this.#x = x; this.#y = y; };
  }

  protected planScale(factor: number): () => void {
    const x = ModelValue.number(this.#x * factor, "x");
    const y = ModelValue.number(this.#y * factor, "y");
    const width = ModelValue.nonNegative(this.#width * factor, "width");
    const height = ModelValue.nonNegative(this.#height * factor, "height");
    return () => { this.#x = x; this.#y = y; this.#width = width; this.#height = height; };
  }
}
