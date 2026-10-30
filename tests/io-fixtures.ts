import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { TestContext } from "node:test";
import { Circle } from "../src/model/Circle";
import { Document } from "../src/model/Document";
import { Ellipse } from "../src/model/Ellipse";
import { Group } from "../src/model/Group";
import { Line } from "../src/model/Line";
import { Rect } from "../src/model/Rect";
import { Shape } from "../src/model/Shape";
import { Text } from "../src/model/Text";

export async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await fs.mkdtemp(join(tmpdir(), "svg-editor-pr06-"));
  // Check the resolved cleanup target before any recursive removal on Windows.
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  assert.ok(directory.includes("svg-editor-pr06-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

export function complexDocument(): Document {
  return new Document(320.5, 240, [new Rect("bg", 0, 0, 320.5, 240, { fill: "#fff" }), new Group("scene", [
    new Rect("r", 1, 2, 3, 4, { fill: "red", "stroke-width": 0 }),
    new Group("inner", [new Text('t<&"', -1.5, 20, '中文 🧪 <&> "双引号" \'单引号\'\r\n\t末尾  '),
      new Line("l", 0, 0, 100, 50, { stroke: "#AbC", "stroke-width": 1.5 })], { stroke: "blue" }),
    new Circle("c", 10, 20, 3), new Circle("C", 20, 30, 0), new Ellipse("e", 5, 6, 7, 8), new Group("empty"),
  ], { fill: "blue" })]);
}

export function semanticState(document: Document): unknown {
  const index: unknown[] = [];
  const visit = (shapes: readonly Shape[]): void => {
    for (const shape of shapes) {
      assert.equal(document.find(shape.id), shape);
      index.push([shape.id, document.getParentId(shape.id), document.getPosition(shape.id)]);
      if (shape instanceof Group) visit(shape.getChildren());
    }
  };
  document.validate(); visit(document.getRoots());
  return { svg: document.toSvgNode(), size: document.size, index };
}
