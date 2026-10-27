import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

test("compiled CLI exits successfully and prints the startup message", () => {
  const result = spawnSync(process.execPath, [resolve(__dirname, "../../main.js")], {
    encoding: "utf8",
    timeout: 5000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim(), "SVG Editor CLI started!");
});
