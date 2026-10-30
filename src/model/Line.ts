import { ModelValue } from "./ModelValue";
import { Shape } from "./Shape";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export class Line extends Shape {
  #x1: number;
  #y1: number;
  #x2: number;
  #y2: number;

  constructor(id: string, x1: number, y1: number, x2: number, y2: number, style: ShapeStyle = {}) {
    super(id, style);
    this.#x1 = ModelValue.number(x1, "x1");
    this.#y1 = ModelValue.number(y1, "y1");
    this.#x2 = ModelValue.number(x2, "x2");
    this.#y2 = ModelValue.number(y2, "y2");
  }

  get type(): string { return "line"; }
  get x1(): number { return this.#x1; }
  get y1(): number { return this.#y1; }
  get x2(): number { return this.#x2; }
  get y2(): number { return this.#y2; }

  clone(): Line {
    return new Line(this.id, this.#x1, this.#y1, this.#x2, this.#y2, this.getStyle());
  }

  toSvgNode(): SvgNode {
    return this.makeNode({ x1: this.#x1, y1: this.#y1, x2: this.#x2, y2: this.#y2 });
  }

  protected override setGeometryAttribute(name: string, value: unknown): void {
    if (name === "x1") this.#x1 = ModelValue.number(value, name);
    else if (name === "y1") this.#y1 = ModelValue.number(value, name);
    else if (name === "x2") this.#x2 = ModelValue.number(value, name);
    else if (name === "y2") this.#y2 = ModelValue.number(value, name);
    else super.setGeometryAttribute(name, value);
  }

  protected geometrySummary(): string { return ` (${this.#x1},${this.#y1}) -> (${this.#x2},${this.#y2})`; }

  protected planMove(dx: number, dy: number): () => void {
    const x1 = ModelValue.number(this.#x1 + dx, "x1");
    const y1 = ModelValue.number(this.#y1 + dy, "y1");
    const x2 = ModelValue.number(this.#x2 + dx, "x2");
    const y2 = ModelValue.number(this.#y2 + dy, "y2");
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }

  protected planScale(factor: number): () => void {
    const x1 = ModelValue.number(this.#x1 * factor, "x1");
    const y1 = ModelValue.number(this.#y1 * factor, "y1");
    const x2 = ModelValue.number(this.#x2 * factor, "x2");
    const y2 = ModelValue.number(this.#y2 * factor, "y2");
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }
}
