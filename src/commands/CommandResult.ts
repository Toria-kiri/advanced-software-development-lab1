/** A detached, deeply frozen result. Data must be plain structured-cloneable DTOs. */
export class CommandResult<T = unknown> {
  readonly #operation: string;
  readonly #data: T;
  readonly #warnings: readonly string[];

  constructor(operation: string, data: T, warnings: readonly string[] = []) {
    this.#operation = operation;
    this.#data = CommandResult.freeze(structuredClone(data));
    this.#warnings = Object.freeze([...warnings]);
  }

  get success(): true { return true; }
  get operation(): string { return this.#operation; }
  get data(): T { return this.#data; }
  get warnings(): readonly string[] { return this.#warnings; }

  private static freeze<T>(value: T, seen = new WeakSet<object>()): T {
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) return value;
      seen.add(value);
      Object.values(value).forEach(child => CommandResult.freeze(child, seen));
      Object.freeze(value);
    }
    return value;
  }
}
