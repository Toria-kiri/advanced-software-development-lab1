import assert from "node:assert/strict";
import { test } from "node:test";
import { Circle } from "../src/model/Circle";
import { Document } from "../src/model/Document";
import { Group } from "../src/model/Group";
import { Rect } from "../src/model/Rect";
import { Shape } from "../src/model/Shape";

const rect = (id: string): Rect => new Rect(id, 1, 2, 3, 4);
const ids = (shapes: readonly Shape[]): string[] => shapes.map(shape => shape.id);
const children = (doc: Document, id: string): string[] => ids((doc.find(id) as Group).getChildren());

function snapshot(doc: Document): unknown {
  const index: unknown[] = [];
  const visit = (shapes: readonly Shape[]): void => shapes.forEach(shape => {
    assert.equal(doc.find(shape.id), shape);
    index.push([shape.id, doc.getParentId(shape.id), doc.getPosition(shape.id)]);
    if (shape instanceof Group) visit(shape.getChildren());
  });
  visit(doc.getRoots());
  doc.validate();
  return { node: doc.toSvgNode(), size: doc.size, index };
}

function unchanged(doc: Document, action: () => void, message?: string): void {
  const before = snapshot(doc);
  const refs = [...doc.getRoots()];
  if (message) assert.throws(action, { message });
  else assert.throws(action);
  assert.deepEqual(snapshot(doc), before);
  assert.deepEqual([...doc.getRoots()], refs);
  refs.forEach((shape, i) => assert.equal(doc.getRoots()[i], shape));
}

test("canvas defaults, positive dimensions and atomic resize", () => {
  const doc = new Document();
  assert.equal(doc.width, 800);
  assert.equal(doc.height, 600);
  doc.resize(320.5, 240);
  assert.equal(doc.width, 320.5);
  for (const bad of [0, -1, NaN, Infinity]) {
    unchanged(doc, () => doc.resize(100, bad));
    assert.throws(() => new Document(bad, 100));
  }
  assert.equal(doc.toSvgNode().attributes.viewBox, "0 0 320.5 240");
});

test("insert owns a deep copy; nested lookup, parent/position indexes, case-sensitive ids", () => {
  const doc = new Document();
  const input = new Group("g", [rect("r"), new Group("inner", [rect("R")])]);
  const owned = doc.insert(input);
  assert.notEqual(owned, input);
  input.move(100, 100);
  assert.equal(doc.find("r").getAttribute("x"), 1);
  assert.equal(doc.getParentId("R"), "inner");
  assert.equal(doc.getParentId("g"), null);
  assert.equal(doc.getPosition("inner"), 1);
  assert.equal(doc.size, 4);
  doc.insert(new Circle("c", 0, 0, 1), "inner");
  assert.deepEqual(children(doc, "inner"), ["R", "c"]);
  assert.equal(doc.getPosition("c"), 1);
  doc.validate();
  unchanged(doc, () => doc.insert(rect("r")), "error: id already exists: r");
  unchanged(doc, () => doc.insert(new Group("other", [rect("R")])), "error: id already exists: R");
  unchanged(doc, () => doc.insert(rect("new"), "missing"), "error: no such container: missing");
  unchanged(doc, () => doc.insert(rect("new"), "r"), "error: not a container: r");
  assert.throws(() => doc.find("missing"), { message: "error: no such shape: missing" });
});

test("delete removes a whole subtree and repairs remaining sibling positions", () => {
  const doc = new Document(100, 100, [new Group("g", [rect("a"), new Group("inner", [rect("b")]), rect("c")]), rect("z")]);
  doc.delete("inner");
  assert.deepEqual(children(doc, "g"), ["a", "c"]);
  assert.equal(doc.getPosition("c"), 1);
  assert.throws(() => doc.find("b"));
  assert.throws(() => doc.find("inner"));
  assert.equal(doc.size, 4);
  doc.delete("g");
  assert.deepEqual(ids(doc.getRoots()), ["z"]);
  assert.equal(doc.size, 1);
  assert.equal(doc.getPosition("z"), 0);
  unchanged(doc, () => doc.delete("missing"));
});

test("group same-parent selections use original order and earliest selected slot", () => {
  const doc = new Document(100, 100, [new Group("parent", [rect("a"), rect("b"), rect("c"), rect("d")])]);
  doc.group("new", ["d", "b"]);
  assert.deepEqual(children(doc, "parent"), ["a", "new", "c"]);
  assert.deepEqual(children(doc, "new"), ["b", "d"]);
  assert.equal(doc.getParentId("new"), "parent");
  assert.equal(doc.getParentId("b"), "new");
  doc.ungroup("new");
  assert.deepEqual(children(doc, "parent"), ["a", "b", "d", "c"]);
  assert.equal(doc.getPosition("d"), 2);
  assert.throws(() => doc.find("new"));
  doc.validate();
});

test("D3 cross-parent grouping uses nested lowest common ancestor and pre-edit DFS order", () => {
  const doc = new Document(800, 600, [rect("before"), new Group("scene", [
    rect("first"), new Group("left", [rect("a"), rect("keep")]), rect("middle"),
    new Group("right", [new Group("deep", [rect("b")])]), rect("last"),
  ]), rect("after")]);
  doc.group("pair", ["b", "a"]);
  assert.deepEqual(ids(doc.getRoots()), ["before", "scene", "after"]);
  assert.deepEqual(children(doc, "scene"), ["first", "pair", "left", "middle", "right", "last"]);
  assert.deepEqual(children(doc, "pair"), ["a", "b"]);
  assert.deepEqual(children(doc, "left"), ["keep"]);
  assert.deepEqual(children(doc, "deep"), []);
  assert.equal(doc.getParentId("pair"), "scene");
  assert.equal(doc.getParentId("b"), "pair");
  assert.equal(doc.find("a").getAttribute("x"), 1);
  doc.validate();
});

test("D3 handles root LCA and anchor that is itself selected", () => {
  const doc = new Document(800, 600, [rect("first"), new Group("parent", [rect("nested")]), rect("last")]);
  doc.group("pair", ["nested", "first"]);
  assert.deepEqual(ids(doc.getRoots()), ["pair", "parent", "last"]);
  assert.deepEqual(children(doc, "pair"), ["first", "nested"]);
  assert.deepEqual(children(doc, "parent"), []);
  unchanged(doc, () => doc.ungroup("pair"), "error: cannot ungroup top-level container: pair");
});

test("one-element group and empty nested ungroup are supported", () => {
  const doc = new Document(100, 100, [new Group("parent", [rect("r"), new Group("empty")])]);
  doc.group("single", ["r"]);
  assert.deepEqual(children(doc, "single"), ["r"]);
  doc.ungroup("empty");
  assert.deepEqual(children(doc, "parent"), ["single"]);
  doc.validate();
});

test("group rejects missing/duplicate ids and ancestor-descendant combinations atomically", () => {
  const doc = new Document(100, 100, [new Group("g", [rect("r"), new Group("nested", [rect("child")])]), rect("outside")]);
  unchanged(doc, () => doc.group("new", []));
  unchanged(doc, () => doc.group("new", ["r", "r"]));
  unchanged(doc, () => doc.group("new", ["r", "missing"]));
  unchanged(doc, () => doc.group("g", ["r"]), "error: id already exists: g");
  unchanged(doc, () => doc.group("new", ["child", "g"]), "error: cannot group a container into its own descendant: g");
  unchanged(doc, () => doc.group("new", ["g", "nested"]));
});

test("addTo appends, supports reordering in the same parent and rejects cycles", () => {
  const doc = new Document(100, 100, [new Group("g", [rect("a"), rect("b"), new Group("nested")]), rect("r")]);
  doc.addTo("g", "r");
  assert.deepEqual(ids(doc.getRoots()), ["g"]);
  assert.deepEqual(children(doc, "g"), ["a", "b", "nested", "r"]);
  doc.addTo("g", "a");
  assert.deepEqual(children(doc, "g"), ["b", "nested", "r", "a"]);
  doc.addTo("nested", "a");
  assert.deepEqual(children(doc, "nested"), ["a"]);
  assert.equal(doc.getParentId("a"), "nested");
  unchanged(doc, () => doc.addTo("nested", "g"));
  unchanged(doc, () => doc.addTo("g", "g"));
  unchanged(doc, () => doc.addTo("a", "r"), "error: not a container: a");
  unchanged(doc, () => doc.addTo("missing", "r"), "error: no such container: missing");
  unchanged(doc, () => doc.addTo("g", "missing"), "error: no such shape: missing");
});

test("front/back change only sibling drawing order, including group targets", () => {
  const doc = new Document(100, 100, [rect("root"), new Group("g", [rect("a"), new Group("nested", [rect("child")]), rect("b")]), rect("last")]);
  doc.bringToFront("a");
  assert.deepEqual(children(doc, "g"), ["nested", "b", "a"]);
  doc.sendToBack("b");
  assert.deepEqual(children(doc, "g"), ["b", "nested", "a"]);
  doc.bringToFront("g");
  assert.deepEqual(ids(doc.getRoots()), ["root", "last", "g"]);
  doc.sendToBack("g");
  assert.deepEqual(ids(doc.getRoots()), ["g", "root", "last"]);
  assert.deepEqual(children(doc, "nested"), ["child"]);
  assert.equal(doc.getParentId("child"), "nested");
  unchanged(doc, () => doc.bringToFront("missing"));
  unchanged(doc, () => doc.sendToBack("missing"));
});

test("document clone is independent in geometry, styles, indexes, hierarchy and canvas", () => {
  const doc = new Document(100, 100, [new Group("g", [rect("a"), new Group("nested", [rect("b")])], { fill: "red" })]);
  const before = snapshot(doc);
  const copy = doc.clone();
  assert.deepEqual(snapshot(copy), before);
  assert.notEqual(copy.find("b"), doc.find("b"));
  copy.find("g").move(3, 4);
  copy.find("g").setAttribute("fill", "blue");
  copy.addTo("nested", "a");
  copy.delete("b");
  copy.resize(200, 300);
  assert.deepEqual(snapshot(doc), before);
  doc.find("a").setAttribute("x", 99);
  assert.equal(copy.find("a").getAttribute("x"), 4);
  copy.validate();
});

test("external arrays, detached groups and duplicate subtree inputs cannot corrupt membership", () => {
  const input = [rect("r")];
  const doc = new Document(100, 100, input);
  input.length = 0;
  assert.equal(doc.size, 1);
  assert.throws(() => (doc.getRoots() as Shape[]).push(rect("x")), TypeError);
  assert.throws(() => new Document(100, 100, [rect("r"), rect("r")]));
  assert.throws(() => new Group("g", [rect("g")]));
  assert.throws(() => new Group("g", [rect("r"), new Group("inner", [rect("r")])]));
  doc.insert(new Group("g"));
  const detached = (doc.find("g") as Group).withChildren([rect("new")]);
  assert.deepEqual(children(doc, "g"), []);
  unchanged(doc, () => doc.insert(detached));
});

test("late geometric failure through a document-owned group leaves content and indexes unchanged", () => {
  const doc = new Document(100, 100, [new Group("g", [rect("ok"), new Circle("huge", Number.MAX_VALUE, 0, 1)])]);
  unchanged(doc, () => doc.find("g").scale(2));
});
