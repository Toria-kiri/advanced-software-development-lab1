import { AddToCommand } from "../commands/AddToCommand";
import { BackCommand } from "../commands/BackCommand";
import { CanvasCommand } from "../commands/CanvasCommand";
import { Command } from "../commands/Command";
import { CommandExecutor } from "../commands/CommandExecutor";
import { CreateCommand } from "../commands/CreateCommand";
import { DeleteCommand } from "../commands/DeleteCommand";
import { FrontCommand } from "../commands/FrontCommand";
import { GroupCommand } from "../commands/GroupCommand";
import { HelpCommand, HelpEntry } from "../commands/HelpCommand";
import { InitCommand } from "../commands/InitCommand";
import { MoveCommand } from "../commands/MoveCommand";
import { ScaleCommand } from "../commands/ScaleCommand";
import { SetCommand } from "../commands/SetCommand";
import { ShowCommand } from "../commands/ShowCommand";
import { TreeCommand } from "../commands/TreeCommand";
import { UngroupCommand } from "../commands/UngroupCommand";
import { ReadCommand } from "../commands/ReadCommand";
import { SaveCommand } from "../commands/SaveCommand";
import { ModelError } from "../model/ModelError";
import { ModelValue } from "../model/ModelValue";
import { CliRenderer } from "./CliRenderer";
import { CommandToken } from "./CommandParser";

export interface CliAction {
  execute(executor: CommandExecutor, renderer: CliRenderer): Promise<string>;
}
interface CommandDefinition {
  readonly syntax: string;
  readonly description: string;
  readonly build: (args: readonly CommandToken[]) => CliAction;
}

export class CommandDispatcher {
  readonly #store: ConstructorParameters<typeof ReadCommand>[0];

  constructor(store: ConstructorParameters<typeof ReadCommand>[0]) { this.#store = store; }

  // The only command-name dispatch point, including presentation selection.
  // A future plugin phase may replace this fixed map with registration.
  readonly #definitions = new Map<string, CommandDefinition>([
    ["init", { syntax: "init [w] [h]", description: "新建画布（默认 800x600）", build: a => {
      this.count(a, 0, 2);
      return this.command(new InitCommand(a[0] ? this.number(a[0]) : undefined, a[1] ? this.number(a[1]) : undefined),
        (r, d) => r.canvas(d, " created"));
    } }],
    ["canvas", { syntax: "canvas [w] [h]", description: "查询或修改画布尺寸", build: a => {
      if (a.length !== 0 && a.length !== 2) throw new ModelError("canvas requires both width and height");
      return this.command(new CanvasCommand(a[0] ? this.number(a[0]) : undefined, a[1] ? this.number(a[1]) : undefined),
        (r, d) => r.canvas(d, a.length ? " resized" : ""));
    } }],
    ["create", { syntax: "create <type> <id> [params…] [in <containerId>]", description: [
      "创建图形；以下六种形式均可追加 in <containerId>",
      "  create rect <id> <x> <y> <w> <h> [fill]",
      "  create circle <id> <cx> <cy> <r> [fill]",
      "  create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      "  create line <id> <x1> <y1> <x2> <y2> [stroke]",
      '  create text <id> <x> <y> "content"',
      "  create g <id>",
    ].join("\n"), build: a => {
      this.count(a, 2, Infinity);
      let params = a.slice(2), parent: string | null = null;
      const keyword = params.findIndex(token => !token.quoted && token.value === "in");
      if (keyword !== -1) {
        if (keyword !== params.length - 2) throw new ModelError("create requires a single trailing 'in <containerId>' clause");
        parent = params[keyword + 1].value;
        params = params.slice(0, keyword);
      }
      // ShapeFactory owns type-specific arity, numeric geometry and style conversion.
      return this.command(new CreateCommand(a[0].value, a[1].value, params.map(t => t.value), parent),
        (r, d) => `${d.shape.type}#${r.line(d.shape.id)} created${d.parentId === null ? "" : ` in ${r.parent(d.parentId)}`}`);
    } }],
    ["delete", { syntax: "delete <id>", description: "删除图形及其子树", build: a => {
      this.count(a, 1); return this.command(new DeleteCommand(a[0].value), (r, d) => `${d.shape.type}#${r.line(d.id)} deleted`);
    } }],
    ["move", { syntax: "move <id> <dx> <dy>", description: "平移图形或容器", build: a => {
      this.count(a, 3); return this.command(new MoveCommand(a[0].value, this.number(a[1]), this.number(a[2])),
        (r, d) => `${r.shape(d.shape)} moved`);
    } }],
    ["scale", { syntax: "scale <id> <factor>", description: "按正比例缩放位置和尺寸", build: a => {
      this.count(a, 2); return this.command(new ScaleCommand(a[0].value, this.number(a[1])), (r, d) => `${r.shape(d.shape)} scaled`);
    } }],
    ["set", { syntax: "set <id> <attr> <value>", description: "设置白名单属性或文本", build: a => {
      this.count(a, 3); return this.command(new SetCommand(a[0].value, a[1].value, a[2].value), (r, d) => `${r.shape(d.shape)} updated`);
    } }],
    ["group", { syntax: "group <newGid> <id1> <id2>…", description: "按原绘制顺序收编图形", build: a => {
      this.count(a, 2, Infinity); return this.command(new GroupCommand(a[0].value, a.slice(1).map(t => t.value)),
        (r, d) => `g#${r.line(d.shape.id)} created`);
    } }],
    ["ungroup", { syntax: "ungroup <gid>", description: "解散非根级容器", build: a => {
      this.count(a, 1); return this.command(new UngroupCommand(a[0].value), (r, d) => `g#${r.line(d.id)} ungrouped`);
    } }],
    ["addto", { syntax: "addto <gid> <id>", description: "将图形移至容器末尾", build: a => {
      this.count(a, 2); return this.command(new AddToCommand(a[0].value, a[1].value),
        (r, d) => `${r.line(d.id)} added to ${r.parent(d.parentId)}`);
    } }],
    ["front", { syntax: "front <id>", description: "调整至同级最前", build: a => {
      this.count(a, 1); return this.command(new FrontCommand(a[0].value), (r, d) => `${r.line(d.id)} brought to front`);
    } }],
    ["back", { syntax: "back <id>", description: "调整至同级最后", build: a => {
      this.count(a, 1); return this.command(new BackCommand(a[0].value), (r, d) => `${r.line(d.id)} sent to back`);
    } }],
    ["tree", { syntax: "tree [id]", description: "显示全文档或子树及关键属性", build: a => {
      this.count(a, 0, 1); return this.command(new TreeCommand(a[0]?.value), (r, d) => r.tree(d, a.length > 0));
    } }],
    ["show", { syntax: "show <id>", description: "显示图形属性及父节点", build: a => {
      this.count(a, 1); return this.command(new ShowCommand(a[0].value), (r, d) => r.show(d));
    } }],
    ["help", { syntax: "help", description: "显示全部命令语法（需先 init/read）", build: a => {
      this.count(a, 0); return this.command(new HelpCommand(this.helpEntries()), (r, d) => r.help(d));
    } }],
    ["undo", { syntax: "undo", description: "撤销一次编辑", build: a => {
      this.count(a, 0); return { execute: async (e, r) => r.render(await e.undo(), d => `undid ${d.command}`) };
    } }],
    ["redo", { syntax: "redo", description: "重做一次编辑", build: a => {
      this.count(a, 0); return { execute: async (e, r) => r.render(await e.redo(), d => `redid ${d.command}`) };
    } }],
    ["read", { syntax: "read <file.svg>", description: "读取 SVG，补齐缺失 ID，建立历史边界", build: a => {
      this.count(a, 1); return this.command(new ReadCommand(this.#store, a[0].value),
        (r, d) => `read ${r.line(d.path)} (${d.size} elements, ${d.width}x${d.height})`);
    } }],
    ["save", { syntax: "save [file.svg]", description: "保存 SVG；省略路径使用最近 read 的路径", build: a => {
      this.count(a, 0, 1); return this.command(new SaveCommand(this.#store, a[0]?.value),
        (r, d) => `saved to ${r.line(d.path)} (${d.size} elements)`);
    } }],
  ]);

  create(tokens: readonly CommandToken[]): CliAction {
    if (tokens.length === 0) throw new ModelError("command is required");
    const definition = this.#definitions.get(tokens[0].value);
    if (!definition) throw new ModelError(`unknown command: ${tokens[0].value}`);
    return definition.build(tokens.slice(1));
  }

  helpEntries(): readonly HelpEntry[] {
    return Object.freeze([...this.#definitions].map(([name, d]) => Object.freeze({ name, syntax: d.syntax, description: d.description })));
  }

  private command<T>(command: Command<T>, format: (renderer: CliRenderer, data: T) => string): CliAction {
    return { execute: async (executor, renderer) => renderer.render(await executor.execute(command), data => format(renderer, data)) };
  }
  private number(token: CommandToken): number { return ModelValue.number(token.value, "argument"); }
  private count(args: readonly CommandToken[], minimum: number, maximum = minimum): void {
    if (args.length < minimum || args.length > maximum) throw new ModelError("invalid argument count");
  }
}
