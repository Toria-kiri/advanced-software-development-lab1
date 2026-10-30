/** XML-neutral values. Escaping and file access belong to the IO layer. */
export interface SvgNode {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly children: readonly SvgNode[];
  readonly text?: string;
}
