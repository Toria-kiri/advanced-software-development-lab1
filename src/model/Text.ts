import { ModelValue } from "./ModelValue";
import { Shape } from "./Shape";
import { ShapeStyle } from "./ShapeStyle";
import { SvgNode } from "./SvgNode";

export class Text extends Shape {
  #x: number;
  #y: number;
  #content: string;

  constructor(id: string, x: number, y: number, content: string, style: ShapeStyle = {}) {
    super(id, style);
    this.#x = ModelValue.number(x, "x");
    this.#y = ModelValue.number(y, "y");
    this.#content = ModelValue.text(content, "text");
  }

  get type(): string { return "text"; }
  get x(): number { return this.#x; }
  get y(): number { return this.#y; }
  get content(): string { return this.#content; }
  override getAttribute(name: string): string | number | undefined {
    return name === "text" ? this.#content : super.getAttribute(name);
  }

  clone(): Text {
    return new Text(this.id, this.#x, this.#y, this.#content, this.getStyle());
  }

  toSvgNode(): SvgNode {
    return this.makeNode({ x: this.#x, y: this.#y }, [], this.#content);
  }

  protected override setGeometryAttribute(name: string, value: unknown): void {
    if (name === "x") this.#x = ModelValue.number(value, name);
    else if (name === "y") this.#y = ModelValue.number(value, name);
    else if (name === "text") this.#content = ModelValue.text(value, name);
    else super.setGeometryAttribute(name, value);
  }

  protected geometrySummary(): string { return ` (${this.#x},${this.#y}) ${JSON.stringify(this.#content)}`; }

  protected planMove(dx: number, dy: number): () => void {
    const x = ModelValue.number(this.#x + dx, "x");
    const y = ModelValue.number(this.#y + dy, "y");
    return () => { this.#x = x; this.#y = y; };
  }

  protected planScale(factor: number): () => void {
    const x = ModelValue.number(this.#x * factor, "x");
    const y = ModelValue.number(this.#y * factor, "y");
    return () => { this.#x = x; this.#y = y; };
  }
}
