import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { SvgParser } from "../src/io/SvgParser";
import { SvgSerializer } from "../src/io/SvgSerializer";
import { Document } from "../src/model/Document";
import { Group } from "../src/model/Group";
import { ShapeFactory } from "../src/model/ShapeFactory";
import { Text } from "../src/model/Text";
import { complexDocument, semanticState } from "./io-fixtures";

const parser = new SvgParser(), serializer = new SvgSerializer();
const svg = (body: string, attrs = 'width="100" height="100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

test("serializer and parser preserve all six shapes, hierarchy, order, Unicode and explicit styles", () => {
  const document = complexDocument(), before = semanticState(document);
  const xml = serializer.serialize(document);
  assert.equal(xml, serializer.serialize(document));
  assert.match(xml, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(xml, /encoding="UTF-8"/);
  assert.ok(xml.includes("&lt;&amp;&gt;"));
  assert.ok(xml.includes("&quot;"));
  assert.ok(xml.includes("&#13;"));
  const result = parser.parse(xml);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(semanticState(result.document), before);
  assert.equal(result.document.find("scene").getStyle().fill, "blue");
  assert.equal(result.document.find("c").getStyle().fill, undefined);
  assert.equal(result.document.find("r").getStyle().fill, "red");
  assert.deepEqual(semanticState(document), before);
  const independent = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(xml, "application/xml");
  assert.equal(independent.documentElement?.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(independent.getElementsByTagName("circle").length, 2);
});

test("multiple serialization and parsing cycles preserve exact semantic state", () => {
  let document = complexDocument();
  const before = semanticState(document);
  for (let i = 0; i < 3; i++) {
    document = parser.parse(serializer.serialize(document)).document;
    assert.deepEqual(semanticState(document), before);
  }
});

test("parser handles empty canvas, empty group, normal and self-closing elements", () => {
  for (const xml of [svg(""), '<svg width="100" height="100"/>']) {
    assert.equal(parser.parse(xml).document.size, 0);
    assert.deepEqual(semanticState(parser.parse(serializer.serialize(parser.parse(xml).document)).document), semanticState(new Document(100, 100)));
  }
  const document = parser.parse(svg('<g id="g"><g id="empty"/></g>')).document;
  assert.deepEqual((document.find("g") as Group).getChildren().map(s => s.id), ["empty"]);
});

test("parser supports SVG namespaces, strict px lengths, entities, CDATA and comments", () => {
  const result = parser.parse('<?xml version="1.0" encoding="UTF-8"?><!-- comment --><s:svg xmlns:s="http://www.w3.org/2000/svg" width="100px" height="50px" viewBox="0,0,100,50"><s:text id="t" x="1px" y="2">A &amp; B &lt; &#x4E2D; &#128512;<![CDATA[<&>]]></s:text></s:svg>');
  assert.equal(result.document.width, 100);
  assert.equal(result.document.find("t").getAttribute("x"), 1);
  assert.equal(result.document.find("t").getAttribute("text"), "A & B < 中 😀<&>");
});

test("missing ids reserve later explicit ids and generate stable preorder warnings", () => {
  const xml = svg('<g><rect width="1" height="2"/><rect id="rect1"/><g><text>中文</text></g><rect id="Rect1"/><rect/></g>');
  const first = parser.parse(xml), second = parser.parse(xml);
  assert.deepEqual(first.warnings, ["warning: assigned id g1 to unnamed <g>", "warning: assigned id rect2 to unnamed <rect>",
    "warning: assigned id g2 to unnamed <g>", "warning: assigned id text1 to unnamed <text>", "warning: assigned id rect3 to unnamed <rect>"]);
  assert.deepEqual(second.warnings, first.warnings);
  assert.equal(first.document.getParentId("text1"), "g2");
  assert.equal(first.document.find("Rect1").id, "Rect1");
  assert.deepEqual(semanticState(second.document), semanticState(first.document));
});

test("SVG-only geometry defaults are zero; strict factory callers retain their previous contract", () => {
  const document = parser.parse(svg('<rect id="r"/><circle id="c"/><ellipse id="e"/><line id="l"/><text id="t"/>')).document;
  for (const shape of document.getRoots()) {
    for (const [key, value] of Object.entries(shape.toSvgNode().attributes)) if (key !== "id") assert.equal(value, 0);
  }
  assert.equal(document.find("t").getAttribute("text"), "");
  assert.throws(() => new ShapeFactory().fromSvgNode({ tag: "rect", attributes: { id: "r" }, children: [] }));
});

for (const attrs of ['width="0" height="100"', 'width="100" height="-1"', 'width="100%" height="100"', 'width="10cm" height="100"',
  'width="NaN" height="100"', 'width="Infinity" height="100"', 'width="1e999" height="100"', 'width="100junk" height="100"',
  'width="100" height="100" viewBox="1 0 100 100"', 'width="100" height="100" viewBox="0 0 50 100"',
  'width="100" height="100" viewBox="0,,0,100,100"']) {
  test(`parser rejects invalid canvas or unsupported viewBox: ${attrs}`, () => assert.throws(() => parser.parse(svg("", attrs)), /^ModelError: error:/));
}

const badBodies = ['<path id="p" d="M0 0"/>', '<script>alert(1)</script>', '<image href="https://example.invalid/a.svg"/>',
  '<rect id="r" transform="translate(1,2)"/>', '<g style="fill:red"/>', '<text font-size="12">x</text>', '<g onload="alert(1)"/>',
  '<rect id="r" x="1oops"/>', '<circle id="c" r="-1"/>', '<rect id="r" stroke-width="-1"/>',
  '<rect id="r"/><g><circle id="r"/></g>', '<g id=" "/>', '<g xmlns="urn:other"/>', '<g xmlns:x="urn:x" x:custom="v"/>',
  '<rect fill="url(https://example.invalid/p)"/>', '<rect fill="var(--paint)"/>', '<rect><circle/></rect>', '<g>non-whitespace</g>'];
for (const body of badBodies) test(`parser rejects unsupported or invalid SVG content: ${body}`, () => assert.throws(() => parser.parse(svg(body)), /^ModelError: error:/));

for (const xml of ["", "not XML", '<svg width="1" height="1"><g></svg>', '<svg width="1" height="1"><rect></svg>',
  '<svg width="1" width="2" height="1"/>', '<svg width="1" height="1"/><svg/>', '<svg width="1" height="1">&unknown;</svg>',
  '<!DOCTYPE svg SYSTEM "file:///never-read"><svg width="1" height="1"/>',
  '<!DOCTYPE svg [<!ENTITY x "boom">]><svg width="1" height="1">&x;</svg>',
  '<?xml-stylesheet href="https://example.invalid/style.css"?><svg width="1" height="1"/>',
  '<html/>', '<svg xmlns="urn:other" width="1" height="1"/>']) {
  test(`parser rejects malformed XML, entities or non-SVG: ${xml.slice(0, 70)}`, () => assert.throws(() => parser.parse(xml), /^ModelError: error:/));
}

test("unsupported root visual properties and text are rejected instead of silently dropped", () => {
  for (const attrs of ['width="1" height="1" transform="scale(2)"', 'width="1" height="1" style="background:red"', 'width="1" height="1" preserveAspectRatio="none"']) {
    assert.throws(() => parser.parse(svg("", attrs)));
  }
  assert.throws(() => parser.parse(svg("unexpected text")));
});

test("serializer refuses invalid XML characters and external paint references before writing", () => {
  for (const value of ["bad\0text", "bad\ud800text"]) assert.throws(() => serializer.serialize(new Document(1, 1, [new Text("t", 0, 0, value)])), /invalid XML character/);
  const document = complexDocument(); document.find("r").setAttribute("fill", "url(https://example.invalid/x)");
  assert.throws(() => serializer.serialize(document), /unsupported paint reference/);
});

test("parser bounds nesting before recursive model construction", () => {
  assert.throws(() => parser.parse(svg("<g>".repeat(257) + "</g>".repeat(257))), /depth or node limit/);
});

test("parser rejects illegal XML characters in raw text and decoded references", () => {
  for (const body of ["<text>\0</text>", "<text>\ud800</text>", "<text>&#0;</text>", "<text>&#xD800;</text>", '<g id="&#0;"/>']) {
    assert.throws(() => parser.parse(svg(body)), /invalid XML character/);
  }
  assert.equal(parser.parse(svg('<text id="t">\ufffd</text>')).document.find("t").getAttribute("text"), "\ufffd");
});

test("codec applies approved root dimension defaults and bounds oversized input and output", () => {
  for (const [attrs, width, height] of [["", 800, 600], ['width="100"', 100, 600], ['height="100"', 800, 100]] as const) {
    const document = parser.parse(svg("", attrs)).document;
    assert.deepEqual([document.width, document.height], [width, height]);
  }
  assert.throws(() => parser.parse(" ".repeat(16 * 1024 * 1024 + 1)), /16 MiB input limit/);
  assert.throws(() => serializer.serialize(new Document(1, 1, [new Text("t", 0, 0, "&".repeat(4 * 1024 * 1024))])), /16 MiB output limit/);
});
