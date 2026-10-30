import { Circle } from "./Circle";
import { Ellipse } from "./Ellipse";
import { Group } from "./Group";
import { Line } from "./Line";
import { ModelError } from "./ModelError";
import { ModelValue } from "./ModelValue";
import { Rect } from "./Rect";
import { Shape } from "./Shape";
import { SvgNode } from "./SvgNode";
import { Text } from "./Text";

type Parameter = string | number;
interface ShapeDefinition {
  readonly geometry: readonly string[];
  readonly text?: boolean;
  readonly optionalStyle?: "fill" | "stroke";
  readonly build: (id: string, params: readonly Parameter[]) => Shape;
}

export class ShapeFactory {
  // The only shape-name dispatch point. Replace with registration in a later phase.
  readonly #definitions = new Map<string, ShapeDefinition>([
    ["rect", { geometry: ["x", "y", "width", "height"], optionalStyle: "fill",
      build: (id, p) => new Rect(id, ModelValue.number(p[0], "x"), ModelValue.number(p[1], "y"),
        ModelValue.number(p[2], "width"), ModelValue.number(p[3], "height")) }],
    ["circle", { geometry: ["cx", "cy", "r"], optionalStyle: "fill",
      build: (id, p) => new Circle(id, ModelValue.number(p[0], "cx"), ModelValue.number(p[1], "cy"), ModelValue.number(p[2], "r")) }],
    ["ellipse", { geometry: ["cx", "cy", "rx", "ry"], optionalStyle: "fill",
      build: (id, p) => new Ellipse(id, ModelValue.number(p[0], "cx"), ModelValue.number(p[1], "cy"),
        ModelValue.number(p[2], "rx"), ModelValue.number(p[3], "ry")) }],
    ["line", { geometry: ["x1", "y1", "x2", "y2"], optionalStyle: "stroke",
      build: (id, p) => new Line(id, ModelValue.number(p[0], "x1"), ModelValue.number(p[1], "y1"),
        ModelValue.number(p[2], "x2"), ModelValue.number(p[3], "y2")) }],
    ["text", { geometry: ["x", "y"], text: true,
      build: (id, p) => new Text(id, ModelValue.number(p[0], "x"), ModelValue.number(p[1], "y"), ModelValue.text(p[2], "text")) }],
    ["g", { geometry: [], build: id => new Group(id) }],
  ]);

  create(type: string, id: string, params: readonly Parameter[] = []): Shape {
    const definition = this.definition(type);
    const required = definition.geometry.length + (definition.text ? 1 : 0);
    const maximum = required + (definition.optionalStyle ? 1 : 0);
    if (params.length < required || params.length > maximum) {
      throw new ModelError(`invalid parameters for ${type}`);
    }
    const shape = definition.build(id, params);
    if (definition.optionalStyle && params.length > required) {
      shape.setAttribute(definition.optionalStyle, params[required]);
    }
    return shape;
  }

  /** Adapts already parsed nodes, not XML. Missing-id assignment belongs to IO. */
  fromSvgNode(node: SvgNode): Shape {
    return this.fromNode(node, new Set<SvgNode>());
  }

  private fromNode(node: SvgNode, visiting: Set<SvgNode>): Shape {
    if (visiting.has(node)) throw new ModelError("cyclic SVG node tree");
    visiting.add(node);
    const definition = this.definition(node.tag);
    const allowed = new Set(["id", ...definition.geometry, "fill", "stroke", "stroke-width"]);
    for (const name of Object.keys(node.attributes)) {
      if (!allowed.has(name)) throw new ModelError(`unknown attribute: ${name}`);
    }
    const id = ModelValue.id(node.attributes.id);
    const params: Parameter[] = definition.geometry.map(name => ModelValue.number(node.attributes[name], name));
    if (definition.text) params.push(ModelValue.text(node.text ?? "", "text"));
    let shape = definition.build(id, params);
    for (const name of ["fill", "stroke", "stroke-width"] as const) {
      if (Object.hasOwn(node.attributes, name)) shape.setAttribute(name, node.attributes[name]);
    }
    if (shape instanceof Group) {
      if (node.text !== undefined && node.text.trim() !== "") throw new ModelError("unexpected group text");
      shape = shape.withChildren(node.children.map(child => this.fromNode(child, visiting)));
    } else {
      if (node.children.length !== 0) throw new ModelError(`not a container: ${id}`);
      if (!definition.text && node.text !== undefined && node.text.trim() !== "") {
        throw new ModelError(`unexpected text: ${id}`);
      }
    }
    visiting.delete(node);
    return shape;
  }

  private definition(type: string): ShapeDefinition {
    const definition = this.#definitions.get(type);
    if (!definition) throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}
