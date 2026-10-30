import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";
import { SvgNode } from "../model/SvgNode";

/** XML writer for the model's neutral tree; no shape-name dispatch or filesystem. */
export class SvgSerializer {
  serialize(document: Document): string {
    document.validate();
    if (document.size > 100000) throw new ModelError("SVG tree exceeds depth or node limit");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${this.node(document.toSvgNode(), 0)}\n`;
    if (Buffer.byteLength(xml, "utf8") > 16 * 1024 * 1024) throw new ModelError("SVG exceeds the 16 MiB output limit");
    return xml;
  }

  private node(node: SvgNode, depth: number): string {
    if (depth > 256) throw new ModelError("SVG tree exceeds depth or node limit");
    const indent = "  ".repeat(depth);
    const attributes = Object.entries(node.attributes).map(([key, value]) => {
      if ((key === "fill" || key === "stroke") && /(?:url|var)\s*\(/i.test(String(value))) {
        throw new ModelError(`unsupported paint reference: ${key}`);
      }
      return ` ${key}="${this.escape(String(value), true)}"`;
    }).join("");
    const open = `${indent}<${node.tag}${attributes}`;
    if (node.text !== undefined) return `${open}>${this.escape(node.text)}</${node.tag}>`;
    if (node.children.length === 0) return `${open}/>`;
    return `${open}>\n${node.children.map(child => this.node(child, depth + 1)).join("\n")}\n${indent}</${node.tag}>`;
  }

  private escape(value: string, attribute = false): string {
    if (!/^[\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]*$/u.test(value)) {
      throw new ModelError("cannot serialize invalid XML character");
    }
    let escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (attribute) escaped = escaped.replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/\t/g, "&#9;").replace(/\n/g, "&#10;");
    return escaped.replace(/\r/g, "&#13;");
  }
}
