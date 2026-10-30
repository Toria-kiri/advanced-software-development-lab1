import { Document } from "../model/Document";

/** Future IO boundary only. PR04 provides no reader, writer or filesystem adapter. */
export interface SvgStore {
  read(path: string): Promise<{ document: Document; warnings: readonly string[] }>;
  write(path: string, document: Document): Promise<void>;
}
