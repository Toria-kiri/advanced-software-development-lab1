export interface ShapeDescription {
  readonly id: string;
  readonly type: string;
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly summary: string;
  readonly text?: string;
}
