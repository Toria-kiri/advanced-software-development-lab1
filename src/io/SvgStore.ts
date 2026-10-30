import { Document } from "../model/Document";

/** File persistence boundary; implementations must not mutate the supplied document. */
export interface SvgStore {
  read(path: string): Promise<{ document: Document; warnings: readonly string[] }>;
  write(path: string, document: Document): Promise<void>;
}
