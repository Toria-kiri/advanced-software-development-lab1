import { ModelError } from "./ModelError";

/** Shared scalar validation, without any shape-type dispatch. */
export class ModelValue {
  static number(value: unknown, name: string): number {
    if ((typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) {
      throw new ModelError(`invalid number: ${name}`);
    }
    const result = Number(value);
    if (!Number.isFinite(result)) throw new ModelError(`invalid number: ${name}`);
    return result;
  }

  static nonNegative(value: unknown, name: string): number {
    const result = this.number(value, name);
    if (result < 0) throw new ModelError(`${name} must be non-negative`);
    return result;
  }

  static positive(value: unknown, name: string): number {
    const result = this.number(value, name);
    if (result <= 0) throw new ModelError(`${name} must be positive`);
    return result;
  }

  static text(value: unknown, name: string): string {
    if (typeof value !== "string") throw new ModelError(`invalid text: ${name}`);
    return value;
  }

  static id(value: unknown): string {
    const result = this.text(value, "id");
    if (result.trim().length === 0) throw new ModelError("id is required");
    return result;
  }
}
