import { DOMParser, Element, Node } from "@xmldom/xmldom";
import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";
import { ModelValue } from "../model/ModelValue";
import { ShapeFactory } from "../model/ShapeFactory";
import { SvgNode } from "../model/SvgNode";

interface ParsedNode {
  tag: string;
  attributes: Record<string, string | number>;
  children: ParsedNode[];
  text?: string;
}

export class SvgParser {
  static readonly #namespace = "http://www.w3.org/2000/svg";
  static readonly #numeric = new Set(["x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "stroke-width"]);
  readonly #factory = new ShapeFactory();

  parse(xml: string): { document: Document; warnings: readonly string[] } {
    this.xmlCharacters(xml);
    // This is a declaration guard, not an XML structure parser. Never expand a DTD.
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new ModelError("unsupported XML DTD or entity declaration");
    if (Buffer.byteLength(xml, "utf8") > 16 * 1024 * 1024) throw new ModelError("SVG exceeds the 16 MiB input limit");
    let dom: ReturnType<DOMParser["parseFromString"]>;
    try {
      dom = new DOMParser({ onError: (level, message) => {
        // Literal U+FFFD is legal XML. File byte-decoding errors are already fatal.
        if (level === "warning" && message === "Unicode replacement character detected, source encoding issues?") return;
        throw new Error(message);
      } }).parseFromString(xml, "application/xml");
    } catch (error) { throw new ModelError(`invalid XML: ${error instanceof Error ? error.message : "parse failed"}`); }
    const root = dom.documentElement;
    if (!root || root.localName !== "svg" || (root.namespaceURI && root.namespaceURI !== SvgParser.#namespace)) {
      throw new ModelError("expected an SVG root element");
    }
    this.checkNonElements(dom);
    const rootAttributes = this.attributes(root);
    for (const key of Object.keys(rootAttributes)) {
      if (!["width", "height", "viewBox", "version"].includes(key)) throw new ModelError(`unsupported SVG root attribute: ${key}`);
    }
    const width = ModelValue.positive(rootAttributes.width ?? 800, "canvas width");
    const height = ModelValue.positive(rootAttributes.height ?? 600, "canvas height");
    if (rootAttributes.version !== undefined && !["1.0", "1.1", "2.0"].includes(String(rootAttributes.version))) {
      throw new ModelError("unsupported SVG version");
    }
    if (rootAttributes.viewBox !== undefined) this.checkViewBox(String(rootAttributes.viewBox), width, height);
    let count = 0;
    const convert = (element: Element, depth: number): ParsedNode => {
      if (depth > 256 || ++count > 100000) throw new ModelError("SVG tree exceeds depth or node limit");
      if (element.namespaceURI !== root.namespaceURI) throw new ModelError(`unsupported element namespace: ${element.tagName}`);
      const node: ParsedNode = { tag: element.localName ?? element.tagName, attributes: this.attributes(element), children: [] };
      let text = "";
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 1) node.children.push(convert(child as Element, depth + 1));
        else if (child.nodeType === 3 || child.nodeType === 4) { this.xmlCharacters(child.nodeValue ?? ""); text += child.nodeValue ?? ""; }
        else this.checkNode(child);
      }
      if (text !== "") node.text = text;
      return node;
    };
    const nodes: ParsedNode[] = [];
    for (const child of Array.from(root.childNodes)) {
      if (child.nodeType === 1) nodes.push(convert(child as Element, 1));
      else this.checkNode(child);
    }
    // Reserve every explicit id before allocating any generated id (case sensitive).
    const ids = new Set<string>();
    const visit = (items: ParsedNode[], action: (node: ParsedNode) => void): void => {
      for (const node of items) { action(node); visit(node.children, action); }
    };
    visit(nodes, node => {
      if (node.attributes.id === undefined) return;
      const id = ModelValue.id(node.attributes.id);
      if (ids.has(id)) throw new ModelError(`id already exists: ${id}`);
      ids.add(id);
    });
    const warnings: string[] = [], next = new Map<string, number>();
    visit(nodes, node => {
      if (node.attributes.id !== undefined) return;
      let index = next.get(node.tag) ?? 1;
      while (ids.has(`${node.tag}${index}`)) index++;
      const id = `${node.tag}${index}`;
      next.set(node.tag, index + 1);
      ids.add(id);
      node.attributes.id = id;
      warnings.push(`warning: assigned id ${id} to unnamed <${node.tag}>`);
    });
    const document = new Document(width, height, nodes.map(node => this.#factory.fromSvgNode(node as SvgNode, true)));
    document.validate();
    return { document, warnings: Object.freeze(warnings) };
  }

  private attributes(element: Element): Record<string, string | number> {
    const result: Record<string, string | number> = Object.create(null);
    for (const attr of Array.from(element.attributes)) {
      this.xmlCharacters(attr.value);
      if (attr.namespaceURI === "http://www.w3.org/2000/xmlns/") continue;
      if (attr.namespaceURI) throw new ModelError(`unsupported namespaced attribute: ${attr.name}`);
      if ((attr.name === "fill" || attr.name === "stroke") && /(?:url|var)\s*\(/i.test(attr.value)) {
        throw new ModelError(`unsupported paint reference: ${attr.name}`);
      }
      result[attr.name] = SvgParser.#numeric.has(attr.name) ? this.length(attr.value, attr.name) : attr.value;
    }
    return result;
  }

  private length(value: string, name: string): number {
    // Only a complete scalar or a scalar followed by px is accepted; never parseFloat.
    const token = value.trim();
    return ModelValue.number(token.endsWith("px") ? token.slice(0, -2) : token, name);
  }

  private checkViewBox(value: string, width: number, height: number): void {
    const number = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?";
    const separator = "(?:\\s*,\\s*|\\s+)";
    if (!new RegExp(`^${number}(?:${separator}${number}){3}$`).test(value.trim())) throw new ModelError("invalid viewBox");
    const values = value.trim().split(/[\s,]+/).map(n => ModelValue.number(n, "viewBox"));
    if (values[0] !== 0 || values[1] !== 0 || values[2] !== width || values[3] !== height) {
      throw new ModelError("unsupported viewBox mapping");
    }
  }

  private checkNonElements(node: Node): void {
    for (const child of Array.from(node.childNodes)) if (child.nodeType !== 1) this.checkNode(child);
  }

  private checkNode(node: Node): void {
    this.xmlCharacters(node.nodeValue ?? "");
    if (node.nodeType === 8) return; // Comments have no visual or executable effect.
    if ((node.nodeType === 3 || node.nodeType === 4) && !(node.nodeValue ?? "").trim()) return;
    if (node.nodeType === 7 && node.nodeName === "xml") {
      const declaration = node.nodeValue ?? "";
      if (/encoding\s*=\s*['"](?!utf-8['"])/i.test(declaration)) throw new ModelError("unsupported XML encoding (UTF-8 required)");
      if (/version\s*=\s*['"](?!1\.0['"])/i.test(declaration)) throw new ModelError("unsupported XML version");
      return;
    }
    throw new ModelError(`unsupported XML content: ${node.nodeName}`);
  }

  private xmlCharacters(value: string): void {
    if (!/^[\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]*$/u.test(value)) {
      throw new ModelError("invalid XML character");
    }
  }
}
