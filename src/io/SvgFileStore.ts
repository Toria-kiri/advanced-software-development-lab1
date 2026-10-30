import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";
import { SvgParser } from "./SvgParser";
import { SvgSerializer } from "./SvgSerializer";
import { SvgStore } from "./SvgStore";

export class SvgFileStore implements SvgStore {
  readonly #parser: SvgParser;
  readonly #serializer: SvgSerializer;

  constructor(parser = new SvgParser(), serializer = new SvgSerializer()) {
    this.#parser = parser;
    this.#serializer = serializer;
  }

  async read(path: string): ReturnType<SvgStore["read"]> {
    let content: Buffer;
    try {
      this.checkPath(path);
      content = await this.readBytes(path);
    } catch (error) {
      const detail = error instanceof ModelError ? ` (${error.message.slice("error: ".length)})` : "";
      throw new ModelError(`cannot read file: ${path}${detail}`);
    }
    let xml: string;
    try { xml = new TextDecoder("utf-8", { fatal: true }).decode(content); }
    catch { throw new ModelError(`cannot read file: ${path} (invalid UTF-8)`); }
    return this.#parser.parse(xml);
  }

  async write(path: string, document: Document): Promise<void> {
    // Finish all serialization and path validation before creating a temporary file.
    const xml = this.#serializer.serialize(document);
    let temporary: string | undefined;
    let owned = false;
    let handle: fs.FileHandle | undefined;
    try {
      this.checkPath(path);
      const target = resolve(path);
      temporary = join(dirname(target), `.svg-editor-${randomUUID()}.tmp`);
      handle = await fs.open(temporary, "wx", 0o600);
      owned = true;
      await handle.writeFile(xml, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      // Same-directory replacement; never delete the old target as a fallback.
      await fs.rename(temporary, target);
      owned = false;
    } catch { throw new ModelError(`cannot write file: ${path}`); }
    finally {
      if (handle) { try { await handle.close(); } catch { /* Still attempt cleanup. */ } }
      if (owned && temporary) {
        try { await fs.unlink(temporary); }
        catch { throw new ModelError(`cannot write file: ${path} (temporary cleanup failed: ${temporary})`); }
      }
    }
  }

  private checkPath(path: string): void {
    if (typeof path !== "string" || path.trim() === "" || path.includes("\0")) throw new ModelError("invalid file path");
  }

  private async readBytes(path: string): Promise<Buffer> {
    const handle = await fs.open(path, "r");
    try {
      const chunks: Buffer[] = [];
      const limit = 16 * 1024 * 1024;
      let size = 0;
      for (;;) {
        const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1 - size));
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
        if (bytesRead === 0) break;
        size += bytesRead;
        if (size > limit) throw new ModelError("SVG exceeds the 16 MiB input limit");
        chunks.push(chunk.subarray(0, bytesRead));
      }
      return Buffer.concat(chunks, size);
    } finally { await handle.close(); }
  }
}
