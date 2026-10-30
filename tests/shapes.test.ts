import assert from "node:assert/strict";
import { test } from "node:test";
import { Circle } from "../src/model/Circle";
import { Ellipse } from "../src/model/Ellipse";
import { Group } from "../src/model/Group";
import { Line } from "../src/model/Line";
import { Rect } from "../src/model/Rect";
import { Shape } from "../src/model/Shape";
import { Text } from "../src/model/Text";

const cases: { make: () => Shape; before: Record<string, number>; moved: Record<string, number>; scaled: Record<string, number> }[] = [
  { make: () => new Rect("r", 1, 2, 3, 4), before: { x: 1, y: 2, width: 3, height: 4 }, moved: { x: 11, y: -3, width: 3, height: 4 }, scaled: { x: 2, y: 4, width: 6, height: 8 } },
  { make: () => new Circle("c", 1, 2, 3), before: { cx: 1, cy: 2, r: 3 }, moved: { cx: 11, cy: -3, r: 3 }, scaled: { cx: 2, cy: 4, r: 6 } },
  { make: () => new Ellipse("e", 1, 2, 3, 4), before: { cx: 1, cy: 2, rx: 3, ry: 4 }, moved: { cx: 11, cy: -3, rx: 3, ry: 4 }, scaled: { cx: 2, cy: 4, rx: 6, ry: 8 } },
  { make: () => new Line("l", 1, 2, 3, 4), before: { x1: 1, y1: 2, x2: 3, y2: 4 }, moved: { x1: 11, y1: -3, x2: 13, y2: -1 }, scaled: { x1: 2, y1: 4, x2: 6, y2: 8 } },
  { make: () => new Text("t", 1, 2, "文字 <&>"), before: { x: 1, y: 2 }, moved: { x: 11, y: -3 }, scaled: { x: 2, y: 4 } },
];

for (const item of cases) {
  const type = item.make().type;
  test(`${type}: attributes, description, move, scale and independent clone`, () => {
    const shape = item.make();
    assert.deepEqual(shape.toSvgNode().attributes, { id: shape.id, ...item.before });
    for (const [key, value] of Object.entries(item.before)) assert.equal(shape.getAttribute(key), value);
    assert.equal(shape.getAttribute("__proto__"), undefined);
    assert.equal(shape.describe().type, type);
    assert.match(shape.describe().summary, new RegExp(`^${type}#`));
    const copy = shape.clone();
    shape.move(10, -5);
    assert.deepEqual(shape.toSvgNode().attributes, { id: shape.id, ...item.moved });
    copy.scale(2);
    assert.deepEqual(copy.toSvgNode().attributes, { id: shape.id, ...item.scaled });
    if (copy instanceof Text) assert.equal(copy.content, "文字 <&>");
  });

  test(`${type}: own geometry whitelist, style preservation and atomic errors`, () => {
    const shape = item.make();
    for (const name of Object.keys(item.before)) {
      shape.setAttribute(name, "0.5");
      assert.equal(shape.getAttribute(name), 0.5);
    }
    shape.setAttribute("fill", "red");
    shape.setAttribute("stroke", "#123456");
    shape.setAttribute("stroke-width", "0");
    assert.deepEqual(shape.getStyle(), { fill: "red", stroke: "#123456", "stroke-width": 0 });
    const copy = shape.clone();
    copy.setAttribute("fill", "blue");
    assert.equal(shape.getStyle().fill, "red");
    const before = shape.toSvgNode();
    for (const name of ["id", "transform", "label", "font-size", "__proto__"]) {
      assert.throws(() => shape.setAttribute(name, "x"), { message: `error: unknown attribute: ${name}` });
    }
    for (const bad of [NaN, Infinity, -Infinity, "", " ", "1oops", "0x10"]) {
      assert.throws(() => shape.setAttribute(Object.keys(item.before)[0], bad));
    }
    assert.throws(() => shape.setAttribute("stroke-width", -1));
    assert.throws(() => shape.move(NaN, 1));
    assert.throws(() => shape.move(1, Infinity));
    for (const factor of [0, -1, NaN, Infinity, -Infinity]) {
      assert.throws(() => shape.scale(factor), { message: "error: scale factor must be positive" });
    }
    assert.deepEqual(shape.toSvgNode(), before);
    assert.throws(() => { (shape as unknown as { id: string }).id = "changed"; }, TypeError);
    assert.equal(shape.id, before.attributes.id);
  });
}

test("zero dimensions are accepted; negative dimensions and non-finite coordinates rejected", () => {
  new Rect("r", -1, -2, 0, 0);
  new Circle("c", 0, 0, 0);
  new Ellipse("e", 0, 0, 0, 0);
  assert.throws(() => new Rect("r", 1, 2, -1, 4));
  assert.throws(() => new Circle("c", 1, 2, -1));
  assert.throws(() => new Ellipse("e", 1, 2, 3, -1));
  assert.throws(() => new Line("l", 1, 2, Infinity, 4));
  assert.throws(() => new Text("t", NaN, 2, "t"));
  assert.throws(() => new Group(""));
  for (const item of [new Rect("r", 1, 2, 3, 4), new Circle("c", 1, 2, 3), new Ellipse("e", 1, 2, 3, 4)]) {
    const before = item.toSvgNode();
    const name = item instanceof Rect ? "width" : item instanceof Circle ? "r" : "ry";
    assert.throws(() => item.setAttribute(name, -1));
    assert.deepEqual(item.toSvgNode(), before);
  }
});

test("group recursively transforms each descendant once, with SVG style inheritance", () => {
  const group = new Group("outer", [new Group("inner", [new Rect("r", 1, 2, 3, 4, { fill: "red" })]), new Text("t", 5, 6, "内容")]);
  group.setAttribute("fill", "blue");
  group.setAttribute("stroke-width", 2);
  group.move(10, 20);
  group.scale(0.5);
  const node = group.toSvgNode();
  assert.deepEqual(node.attributes, { id: "outer", fill: "blue", "stroke-width": 2 });
  assert.deepEqual(node.children[0].children[0].attributes, { id: "r", x: 5.5, y: 11, width: 1.5, height: 2, fill: "red" });
  assert.deepEqual(node.children[1].attributes, { id: "t", x: 7.5, y: 13 });
  assert.equal(node.children[1].text, "内容");
  assert.throws(() => group.setAttribute("x", 1), { message: "error: unknown attribute: x" });
  const clone = group.clone();
  clone.move(2, 3);
  clone.setAttribute("fill", "green");
  assert.deepEqual(group.toSvgNode(), node);
});

test("leaf and nested group transformations preflight overflow before changing anything", () => {
  const rect = new Rect("r", 1, Number.MAX_VALUE, 2, 3);
  const before = rect.toSvgNode();
  assert.throws(() => rect.move(10, Number.MAX_VALUE));
  assert.deepEqual(rect.toSvgNode(), before);
  const group = new Group("g", [new Circle("c", 1, 2, 3), new Group("nested", [rect])]);
  const groupBefore = group.toSvgNode();
  assert.throws(() => group.scale(2));
  assert.deepEqual(group.toSvgNode(), groupBefore);
  assert.throws(() => group.move(1, Number.MAX_VALUE));
  assert.deepEqual(group.toSvgNode(), groupBefore);
});

test("read views and group membership cannot mutate live state", () => {
  const input: Shape[] = [new Circle("c", 1, 2, 3)];
  const group = new Group("g", input);
  input.length = 0;
  assert.equal(group.getChildren().length, 1);
  assert.throws(() => (group.getChildren() as Shape[]).push(new Group("bad")), TypeError);
  const detached = group.withChildren([]);
  assert.equal(detached.getChildren().length, 0);
  assert.equal(group.getChildren().length, 1);
  const node = group.toSvgNode();
  assert.throws(() => { (node.attributes as Record<string, string>).id = "bad"; }, TypeError);
  assert.throws(() => { (group.getStyle() as { fill?: string }).fill = "bad"; }, TypeError);
});

test("text content stays raw and only Text accepts the text attribute", () => {
  const text = new Text("t", 0, 0, "");
  text.setAttribute("text", '中文 <tag> & "quote"\nline');
  assert.equal(text.toSvgNode().text, '中文 <tag> & "quote"\nline');
  assert.equal(text.getAttribute("text"), text.content);
  assert.equal(text.clone().content, text.content);
  assert.throws(() => new Rect("r", 0, 0, 1, 1).setAttribute("text", "x"));
  assert.throws(() => text.setAttribute("text", 1));
});
