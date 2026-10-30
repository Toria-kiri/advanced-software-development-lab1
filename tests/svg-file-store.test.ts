import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { SvgFileStore } from "../src/io/SvgFileStore";
import { SvgParser } from "../src/io/SvgParser";
import { SvgSerializer } from "../src/io/SvgSerializer";
import { complexDocument, semanticState, temporaryDirectory } from "./io-fixtures";

test("file store writes UTF-8 in a spaced path, reads back, overwrites and leaves no temporary files", async t => {
  const directory = await temporaryDirectory(t), file = join(directory, "中文 file.svg"), store = new SvgFileStore();
  const document = complexDocument();
  await store.write(file, document);
  assert.deepEqual(semanticState((await store.read(file)).document), semanticState(document));
  assert.match(await fs.readFile(file, "utf8"), /中文/);
  document.find("r").move(10, 20);
  await store.write(file, document);
  assert.equal((await store.read(file)).document.find("r").getAttribute("x"), 11);
  assert.deepEqual(await fs.readdir(directory), ["中文 file.svg"]);
});

test("file store reports missing, empty, malformed, non-UTF8 and unsupported SVG files", async t => {
  const directory = await temporaryDirectory(t), store = new SvgFileStore();
  await assert.rejects(store.read(join(directory, "missing.svg")), /cannot read file:/);
  for (const [name, content] of [["empty.svg", ""], ["bad.svg", "<svg>"], ["html.svg", "<html/>"],
    ["unsupported.svg", '<svg width="1" height="1"><path/></svg>'], ["utf8.svg", Buffer.from([0xff, 0xfe, 0x61])]] as const) {
    const file = join(directory, name); await fs.writeFile(file, content);
    await assert.rejects(store.read(file), /^ModelError: error:/);
  }
  for (const path of ["", "  ", "a\0.svg"]) {
    await assert.rejects(store.read(path), /cannot read file:/);
    await assert.rejects(store.write(path, complexDocument()), /cannot write file:/);
  }
});

test("read permissions can be deterministically denied without relying on Windows ACLs", async t => {
  const read = t.mock.method(fs, "open", async () => { throw new Error("injected EACCES"); });
  await assert.rejects(new SvgFileStore().read("denied.svg"), { message: "error: cannot read file: denied.svg" });
  assert.equal(read.mock.callCount(), 1);
});

for (const stage of ["open", "writeFile", "sync", "close", "rename"] as const) {
  test(`failed ${stage} preserves the original target and cleans its own temporary file`, async t => {
    const directory = await temporaryDirectory(t), target = join(directory, "target.svg");
    await fs.writeFile(target, "original bytes");
    if (stage === "open" || stage === "rename") t.mock.method(fs, stage, async () => { throw new Error(`injected ${stage} failure`); });
    else {
      const open = fs.open;
      t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        const handle = await open(...args);
        const originalClose = handle.close.bind(handle);
        let attempts = 0;
        if (stage === "close") t.mock.method(handle, "close", async () => {
          if (++attempts === 1) throw new Error("injected close failure");
          return originalClose();
        });
        else t.mock.method(handle, stage, async () => { throw new Error(`injected ${stage} failure`); });
        return handle;
      });
    }
    await assert.rejects(new SvgFileStore().write(target, complexDocument()), /cannot write file:/);
    assert.equal(await fs.readFile(target, "utf8"), "original bytes");
    assert.deepEqual(await fs.readdir(directory), ["target.svg"]);
  });
}

test("replacing a directory fails safely and cleanup never removes the existing target", async t => {
  const directory = await temporaryDirectory(t), target = join(directory, "existing");
  await fs.mkdir(target);
  await assert.rejects(new SvgFileStore().write(target, complexDocument()), /cannot write file:/);
  assert.ok((await fs.stat(target)).isDirectory());
  assert.deepEqual(await fs.readdir(directory), ["existing"]);
});

test("serialization failure occurs before opening or replacing any file", async t => {
  const directory = await temporaryDirectory(t), target = join(directory, "target.svg");
  await fs.writeFile(target, "original bytes");
  const serializer = new SvgSerializer();
  t.mock.method(serializer, "serialize", () => { throw new Error("injected serialization failure"); });
  await assert.rejects(new SvgFileStore(new SvgParser(), serializer).write(target, complexDocument()), /serialization failure/);
  assert.equal(await fs.readFile(target, "utf8"), "original bytes");
  assert.deepEqual(await fs.readdir(directory), ["target.svg"]);
});

test("oversized files are rejected by bounded reading and the handle is closed", async t => {
  const directory = await temporaryDirectory(t), file = join(directory, "large.svg");
  const handle = await fs.open(file, "w");
  await handle.truncate(16 * 1024 * 1024 + 1); await handle.close();
  await assert.rejects(new SvgFileStore().read(file), /16 MiB input limit/);
  await fs.unlink(file);
  assert.deepEqual(await fs.readdir(directory), []);
});
