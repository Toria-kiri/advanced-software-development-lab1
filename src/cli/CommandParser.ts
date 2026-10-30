import { ModelError } from "../model/ModelError";

export interface CommandToken {
  readonly value: string;
  readonly quoted: boolean;
}

/** Line lexer only; no shell escapes, command construction or model access. */
export class CommandParser {
  tokenize(line: string): readonly CommandToken[] {
    if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(line)) throw new ModelError("invalid control character in input");
    if (line.trimStart().startsWith("#")) return Object.freeze([]);
    const tokens: CommandToken[] = [];
    let i = 0;
    while (i < line.length) {
      if (/\s/.test(line[i])) { i++; continue; }
      const quoted = line[i] === '"';
      const start = quoted ? ++i : i;
      if (quoted) {
        while (i < line.length && line[i] !== '"') i++;
        if (i === line.length) throw new ModelError("unclosed double quote");
        tokens.push(Object.freeze({ value: line.slice(start, i++), quoted }));
        if (i < line.length && !/\s/.test(line[i])) throw new ModelError("expected whitespace after quoted argument");
      } else {
        while (i < line.length && !/\s/.test(line[i])) {
          if (line[i] === '"') throw new ModelError("double quote must start an argument");
          i++;
        }
        tokens.push(Object.freeze({ value: line.slice(start, i), quoted }));
      }
    }
    return Object.freeze(tokens);
  }
}
