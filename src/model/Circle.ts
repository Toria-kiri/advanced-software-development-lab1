import { ModelValue } from "./ModelValue";
import { Shape } from "./Shape";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export class Circle extends Shape {
  #cx: number;
  #cy: number;
  #r: number;

  constructor(id: string, cx: number, cy: number, r: number, style: ShapeStyle = {}) {
    super(id, style);
    this.#cx = ModelValue.number(cx, "cx");
    this.#cy = ModelValue.number(cy, "cy");
    this.#r = ModelValue.nonNegative(r, "r");
  }

  get type(): string { return "circle"; }
  get cx(): number { return this.#cx; }
  get cy(): number { return this.#cy; }
  get r(): number { return this.#r; }

  clone(): Circle {
    return new Circle(this.id, this.#cx, this.#cy, this.#r, this.getStyle());
  }

  toSvgNode(): SvgNode {
    return this.makeNode({ cx: this.#cx, cy: this.#cy, r: this.#r });
  }

  protected override setGeometryAttribute(name: string, value: unknown): void {
    if (name === "cx") this.#cx = ModelValue.number(value, name);
    else if (name === "cy") this.#cy = ModelValue.number(value, name);
    else if (name === "r") this.#r = ModelValue.nonNegative(value, name);
    else super.setGeometryAttribute(name, value);
  }

  protected geometrySummary(): string { return ` cx=${this.#cx} cy=${this.#cy} r=${this.#r}`; }

  protected planMove(dx: number, dy: number): () => void {
    const cx = ModelValue.number(this.#cx + dx, "cx");
    const cy = ModelValue.number(this.#cy + dy, "cy");
    return () => { this.#cx = cx; this.#cy = cy; };
  }

  protected planScale(factor: number): () => void {
    const cx = ModelValue.number(this.#cx * factor, "cx");
    const cy = ModelValue.number(this.#cy * factor, "cy");
    const r = ModelValue.nonNegative(this.#r * factor, "r");
    return () => { this.#cx = cx; this.#cy = cy; this.#r = r; };
  }
}
