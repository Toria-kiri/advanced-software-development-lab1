/** Only explicitly supplied styles are stored; SVG defaults remain implicit. */
export interface ShapeStyle {
  readonly fill?: string;
  readonly stroke?: string;
  readonly "stroke-width"?: number;
}
