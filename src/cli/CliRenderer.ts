import { CommandResult } from "../commands/CommandResult";
import { HelpEntry } from "../commands/HelpCommand";
import { TreeNode } from "../commands/TreeCommand";
import { ShapeDescription } from "../model/ShapeDescription";

export class CliRenderer {
  render<T>(result: CommandResult<T>, format: (data: T) => string): string {
    return [...result.warnings.map(warning => this.line(warning.startsWith("warning:") ? warning : `warning: ${warning}`)),
      format(result.data)].join("\n");
  }

  error(error: unknown): string {
    const message = this.line(error instanceof Error ? error.message : String(error));
    return `error: ${message.replace(/^(?:error:\s*)+/i, "")}`;
  }

  canvas(data: { width: number; height: number }, suffix = ""): string {
    return `canvas ${data.width}x${data.height}${suffix}`;
  }

  shape(shape: ShapeDescription): string {
    const styles = ["fill", "stroke", "stroke-width"]
      .filter(key => Object.hasOwn(shape.attributes, key))
      .map(key => `${key}=${this.line(String(shape.attributes[key]))}`);
    return [this.line(shape.summary), ...styles].join(" ");
  }

  show(data: { shape: ShapeDescription; parentId: string | null }): string {
    const { shape } = data;
    const geometry = Object.entries(shape.attributes)
      .filter(([key]) => !["id", "fill", "stroke", "stroke-width"].includes(key))
      .map(([key, value]) => `${key}=${this.line(String(value))}`);
    const styles = ["fill", "stroke", "stroke-width"].filter(key => Object.hasOwn(shape.attributes, key))
      .map(key => `${key}=${this.line(String(shape.attributes[key]))}`);
    return [`${shape.type}#${this.line(shape.id)}  parent=${this.parent(data.parentId)}`,
      ...(geometry.length ? [`  ${geometry.join(" ")}`] : []),
      ...(shape.text === undefined ? [] : [`  text=${JSON.stringify(shape.text)}`]),
      ...(styles.length ? [`  ${styles.join(" ")}`] : [])].join("\n");
  }

  tree(data: { width: number; height: number; roots: readonly TreeNode[] }, subtree = false): string {
    const lines: string[] = subtree ? [] : [`svg (${data.width}x${data.height})`];
    const visit = (node: TreeNode, prefix: string, connector: string): void => {
      lines.push(`${prefix}${connector}${this.shape(node.shape)}`);
      const childPrefix = prefix + (connector === "" ? "" : connector === "└── " ? "    " : "│   ");
      node.children.forEach((child, i) => visit(child, childPrefix, i === node.children.length - 1 ? "└── " : "├── "));
    };
    data.roots.forEach((node, i) => visit(node, "", subtree ? "" : i === data.roots.length - 1 ? "└── " : "├── "));
    return lines.join("\n");
  }

  help(data: { entries: readonly HelpEntry[] }): string {
    return data.entries.map(entry => `${entry.syntax}  ${entry.description}`).join("\n");
  }

  parent(id: string | null): string { return id === null ? "svg" : `g#${this.line(id)}`; }
  line(text: string): string { return text.replace(/[\r\n\t]+/g, " "); }
}
