import { ModelValue } from "./ModelValue";
import { Shape } from "./Shape";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export class Ellipse extends Shape {
  #cx: number;
  #cy: number;
  #rx: number;
  #ry: number;

  constructor(id: string, cx: number, cy: number, rx: number, ry: number, style: ShapeStyle = {}) {
    super(id, style);
    this.#cx = ModelValue.number(cx, "cx");
    this.#cy = ModelValue.number(cy, "cy");
    this.#rx = ModelValue.nonNegative(rx, "rx");
    this.#ry = ModelValue.nonNegative(ry, "ry");
  }

  get type(): string { return "ellipse"; }
  get cx(): number { return this.#cx; }
  get cy(): number { return this.#cy; }
  get rx(): number { return this.#rx; }
  get ry(): number { return this.#ry; }

  clone(): Ellipse {
    return new Ellipse(this.id, this.#cx, this.#cy, this.#rx, this.#ry, this.getStyle());
  }

  toSvgNode(): SvgNode {
    return this.makeNode({ cx: this.#cx, cy: this.#cy, rx: this.#rx, ry: this.#ry });
  }

  protected override setGeometryAttribute(name: string, value: unknown): void {
    if (name === "cx") this.#cx = ModelValue.number(value, name);
    else if (name === "cy") this.#cy = ModelValue.number(value, name);
    else if (name === "rx") this.#rx = ModelValue.nonNegative(value, name);
    else if (name === "ry") this.#ry = ModelValue.nonNegative(value, name);
    else super.setGeometryAttribute(name, value);
  }

  protected geometrySummary(): string { return ` cx=${this.#cx} cy=${this.#cy} rx=${this.#rx} ry=${this.#ry}`; }

  protected planMove(dx: number, dy: number): () => void {
    const cx = ModelValue.number(this.#cx + dx, "cx");
    const cy = ModelValue.number(this.#cy + dy, "cy");
    return () => { this.#cx = cx; this.#cy = cy; };
  }

  protected planScale(factor: number): () => void {
    const cx = ModelValue.number(this.#cx * factor, "cx");
    const cy = ModelValue.number(this.#cy * factor, "cy");
    const rx = ModelValue.nonNegative(this.#rx * factor, "rx");
    const ry = ModelValue.nonNegative(this.#ry * factor, "ry");
    return () => { this.#cx = cx; this.#cy = cy; this.#rx = rx; this.#ry = ry; };
  }
}
