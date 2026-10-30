import assert from "node:assert/strict";
import { test } from "node:test";
import { Group } from "../src/model/Group";
import { ShapeFactory } from "../src/model/ShapeFactory";
import { SvgNode } from "../src/model/SvgNode";

const factory = new ShapeFactory();
const examples: [string, (string | number)[]][] = [
  ["rect", [1, 2, 3, 4, "red"]], ["circle", [1, 2, 3]], ["ellipse", [1, 2, 3, 4]],
  ["line", [1, 2, 3, 4, "black"]], ["text", [1, 2, '中文 <&> "text"']], ["g", []],
];

for (const [type, params] of examples) {
  test(`factory creates ${type} and rebuilds its neutral SVG values`, () => {
    const shape = factory.create(type, type + "1", params);
    assert.equal(shape.type, type);
    assert.equal(shape.id, type + "1");
    const node = shape.toSvgNode();
    assert.deepEqual(factory.fromSvgNode(node).toSvgNode(), node);
    if (type === "rect") assert.equal(shape.getStyle().fill, "red");
    if (type === "line") assert.equal(shape.getStyle().stroke, "black");
    if (type === "circle") assert.equal(Object.hasOwn(node.attributes, "fill"), false);
  });
}

test("factory rejects unsupported type names, bad arity, invalid values and missing ids", () => {
  for (const name of ["box", "hexagon", "Rect", "__proto__", "constructor"]) {
    assert.throws(() => factory.create(name, "id"), { message: `error: unknown shape type: ${name} (is the plugin loaded?)` });
  }
  assert.throws(() => factory.create("rect", "r", [1, 2, 3]));
  assert.throws(() => factory.create("rect", "r", [1, 2, 3, 4, "red", "extra"]));
  assert.throws(() => factory.create("g", "g", ["extra"]));
  assert.throws(() => factory.create("text", "t", [1, 2, 3]));
  assert.throws(() => factory.create("circle", "", [1, 2, 3]));
  assert.throws(() => factory.create("circle", "c", [1, 2, -1]));
  assert.throws(() => factory.create("circle", "c", ["oops", 2, 3]));
});

test("factory accepts decimal/exponent tokens without adding default styles", () => {
  const shape = factory.create("rect", "r", ["-.5", "+2", "3e1", "0"]);
  assert.deepEqual(shape.toSvgNode().attributes, { id: "r", x: -0.5, y: 2, width: 30, height: 0 });
});

test("neutral nested SVG adapter preserves raw text, order and group-level styles", () => {
  const node: SvgNode = { tag: "g", attributes: { id: "g", fill: "blue", "stroke-width": "2" }, children: [
    { tag: "text", attributes: { id: "t", x: "1", y: "2", fill: "red" }, children: [], text: "<中文>&" },
    { tag: "g", attributes: { id: "nested" }, children: [] },
  ] };
  const shape = factory.fromSvgNode(node) as Group;
  assert.deepEqual(shape.getChildren().map(child => child.id), ["t", "nested"]);
  assert.deepEqual(shape.getStyle(), { fill: "blue", "stroke-width": 2 });
  assert.equal(shape.toSvgNode().children[0].text, "<中文>&");
  assert.equal(shape.getChildren()[0].getStyle().fill, "red");
  assert.equal(shape.getChildren()[1].getStyle().fill, undefined);
});

test("adapter rejects unsupported visual attributes and malformed neutral nodes without changing input", () => {
  const base: SvgNode = { tag: "rect", attributes: { id: "r", x: 1, y: 2, width: 3, height: 4 }, children: [] };
  const before = JSON.stringify(base);
  assert.throws(() => factory.fromSvgNode({ ...base, attributes: { ...base.attributes, transform: "translate(1,2)" } }), { message: "error: unknown attribute: transform" });
  assert.throws(() => factory.fromSvgNode({ ...base, children: [base] }), { message: "error: not a container: r" });
  assert.throws(() => factory.fromSvgNode({ ...base, attributes: { x: 1, y: 2, width: 3, height: 4 } }));
  assert.throws(() => factory.fromSvgNode({ tag: "g", attributes: { id: "g" }, children: [base, base] }));
  assert.throws(() => factory.fromSvgNode({ ...base, text: "unhandled" }));
  assert.equal(JSON.stringify(base), before);
});

test("adapter rejects cyclic neutral input instead of recursing indefinitely", () => {
  const children: SvgNode[] = [];
  const cyclic: SvgNode = { tag: "g", attributes: { id: "g" }, children };
  children.push(cyclic);
  assert.throws(() => factory.fromSvgNode(cyclic), { message: "error: cyclic SVG node tree" });
  assert.equal(factory.create("g", "valid").id, "valid");
});
