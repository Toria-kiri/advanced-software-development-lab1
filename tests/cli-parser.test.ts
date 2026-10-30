import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandParser } from "../src/cli/CommandParser";

const parser = new CommandParser();
const examples: [string, string[]][] = [
  ["move r1 30 20", ["move", "r1", "30", "20"]],
  [" \tmove   r1\t-0.5  +2e1  ", ["move", "r1", "-0.5", "+2e1"]],
  ['set t1 text "Hello World"', ["set", "t1", "text", "Hello World"]],
  ['set t1 text "A # B" # comment', ["set", "t1", "text", "A # B", "#", "comment"]],
  ["create rect r 0 0 1 2 #4a90d9 # comment", ["create", "rect", "r", "0", "0", "1", "2", "#4a90d9", "#", "comment"]],
  ['create text t 1 2 "中文 <&> 文本"', ["create", "text", "t", "1", "2", "中文 <&> 文本"]],
  ['set t text ""', ["set", "t", "text", ""]],
  [String.raw`set t text "C:\new\test"`, ["set", "t", "text", String.raw`C:\new\test`]],
  ["", []], [" \t ", []], ["#comment", []], ["  # comment", []],
  ["canvas #", ["canvas", "#"]],
  ["set t text A#B", ["set", "t", "text", "A#B"]],
  ["set t text #tag", ["set", "t", "text", "#tag"]],
];
for (const [input, expected] of examples) {
  test(`lexer preserves arguments: ${JSON.stringify(input)}`, () => {
    assert.deepEqual(parser.tokenize(input).map(t => t.value), expected);
  });
}

test("quoted keyword metadata is retained and token results are immutable", () => {
  const tokens = parser.tokenize('create text t 0 0 "in" in parent');
  assert.deepEqual(tokens.slice(-3), [{ value: "in", quoted: true }, { value: "in", quoted: false }, { value: "parent", quoted: false }]);
  assert.throws(() => (tokens as unknown[]).pop(), TypeError);
  assert.throws(() => { (tokens[0] as { value: string }).value = "changed"; }, TypeError);
});

for (const input of ['set t text "unterminated', 'set t text "a"b', 'set t text a"b"', "show r\0", "show r\ncanvas", "show r\x1b[0m"]) {
  test(`lexer rejects malformed input: ${JSON.stringify(input)}`, () => {
    assert.throws(() => parser.tokenize(input), /^ModelError: error:/);
    assert.deepEqual(parser.tokenize("canvas").map(t => t.value), ["canvas"]);
  });
}
