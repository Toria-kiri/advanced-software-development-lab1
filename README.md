# SVG Editor CLI

《高级软件开发技术》Lab1 Phase 1：基于 TypeScript 的命令行 SVG 编辑器。

> **当前状态：PR 04 Command 系统与完整快照 Undo/Redo 已实现，课程报告已记录人工验收结论。** PR 03 已合并；现在可用 TypeScript 构造命令，由执行器统一完成编辑、查询和历史操作。终端 REPL、解析分发和实际 SVG 文件读写尚未实现，`npm start` 仍只输出启动消息。实现与验收记录见 [课程报告](doc/README.md)。

## 1. 项目目标

开发一个通过命令行（REPL）操作的 SVG 编辑器。用户可以创建、修改、分组和查看图形，撤销或重做编辑操作，并将结果保存为 SVG 文件或从已有 SVG 文件读取。

本项目不仅关注功能实现，还关注**面向对象设计、Command（命令）模式、Composite（组合）语义、模块依赖管理、自动化验证与可追溯的 Git 开发过程**。

### 目标交互示例

以下为任务书中的**目标使用方式**，不表示当前版本已经支持：

```text
svg> init 800 600
svg> create rect r1 10 20 100 50 red
svg> create circle c1 200 100 30 blue
svg> move r1 50 0
svg> tree
svg> undo
svg> redo
svg> save demo.svg
```

生成的 `.svg` 文件可用浏览器直接打开预览。

## 2. 技术栈与约束

- **语言：** TypeScript，采用面向对象设计，使用类、接口、封装与多态。
- **运行环境：** Node.js；使用 npm 管理依赖与工程脚本。
- **核心设计：** 必须采用 Command 模式；容器 `<g>` 与普通图形支持统一编辑操作（Composite 语义）。
- **协作方式：** 使用 Git 进行分阶段版本管理，使用 Codex 等 AI 智能体辅助开发、审查与测试。
- **架构要求：** 避免把命令解析、业务逻辑、图形状态和文件 IO 集中在单一模块；避免以公共数据袋加过程式 `switch` 代替面向对象设计。

完整要求以 [`doc/requirements/phase_cli_1.md`](doc/requirements/phase_cli_1.md) 为准；AI 开发约束见 [`AGENTS.md`](AGENTS.md)。

## 3. Phase 1 功能范围

| 类别 | 命令或能力 | 当前进度 |
| --- | --- | --- |
| 文档管理 | `init`、`read`、`save`、`canvas` | Init/Canvas 命令 API 已实现；Read/Save 待实现 |
| 图形创建与编辑 | `create`、`delete`、`move`、`scale`、`set` | 模型与命令 API 已实现 |
| 分组与层级 | `group`、`ungroup`、`addto`、`front`、`back` | 模型与命令 API 已实现 |
| 信息查看 | `tree`、`show`、`help` | 结构化结果 API 已实现；终端呈现待实现 |
| 操作历史 | `undo`、`redo` | 完整快照、历史边界和失败原子性已实现 |
| 图形类型 | `rect`、`circle`、`ellipse`、`line`、`text`、`g` | 模型已实现 |

以上命令尚未接入终端 REPL。课程报告 §4.6 记录全量 89 项测试通过，其中 PR04 新增 49 项；逐项说明见 [PR4_test.md](tests/doc/PR4_test.md)。

重要行为约定：

- 每个图形及容器使用唯一、大小写敏感的 `id` 定位。
- 一条编辑命令作为一个撤销单元；撤销后执行新编辑会清空重做历史。
- 命令失败时输出以 `error:` 开头的信息，且不得改变文档状态。
- 支持图形嵌套、容器整体操作和 SVG 文件读写。
- **`box` 复合图形属于后续插件化阶段目标，不在 Phase 1 的必做范围内。**

详细参数、边界条件和错误语义请参阅原始任务书。

## 4. 本地开发

### 环境要求

安装 Git、Node.js 24 LTS（本工程使用 24.x）和 npm。TypeScript 5.9 与 Node.js 24 类型声明作为项目本地开发依赖安装，无需全局安装 TypeScript。

### 安装与运行

在仓库根目录执行（已有锁文件，推荐使用 `npm ci` 还原依赖）：

```bash
npm ci
npm run build
npm start
npm run typecheck
npm test
npm run dev
```

其中 `build` 编译源码到 `dist/`，`start` 运行已编译入口，`dev` 构建后运行，`typecheck` 检查源码和测试的类型。`test` 先构建程序，再用独立配置编译测试，最后使用 Node.js 内置测试工具执行 `tests/*.test.ts` 对应的全部测试（命令、历史、模型行为及启动 smoke test）。

Windows PowerShell 若因执行策略无法运行 `npm.ps1`，将上述 `npm` 换成 `npm.cmd`，例如 `npm.cmd test`；无需修改系统执行策略。

在工程初始化的最小验证阶段，`npm start` 预期先输出：

```text
SVG Editor CLI started!
```

这只是环境自检，不代表完整 CLI 已经实现。

### 当前可用的 TypeScript 命令 API

以下示例供源码调用方参考，不是新的终端入口：

```typescript
import { EditorSession } from "./src/commands/EditorSession";
import { CommandExecutor } from "./src/commands/CommandExecutor";
import { InitCommand } from "./src/commands/InitCommand";
import { CreateCommand } from "./src/commands/CreateCommand";
import { MoveCommand } from "./src/commands/MoveCommand";
import { ShowCommand } from "./src/commands/ShowCommand";

async function example() {
  const session = new EditorSession();
  const executor = new CommandExecutor(session);
  await executor.execute(new InitCommand());
  await executor.execute(new CreateCommand("rect", "r1", [10, 20, 100, 50, "red"]));
  await executor.execute(new MoveCommand("r1", 30, 20));
  await executor.undo();
  const result = await executor.execute(new ShowCommand("r1"));
  return result.data; // x=10、y=20；结构化数据交给未来 Renderer 展示
}
```

同一 Session 绑定一个 Executor；每次操作必须 await 完成，重叠调用会报 `error: command executor is busy`。`session.requireDocument()` 返回独立副本，修改副本不影响会话。init 和修改 canvas 会清空并封锁历史，下一次成功编辑后重新解禁；查询不影响历史。HelpCommand 接收外部提供的只读语法列表。ReadCommand/SaveCommand 尚未实现，`src/io/SvgStore.ts` 仅定义未来 IO 契约。

## 5. 当前目录与职责

以下为当前主要目录；整体架构与实际实现范围见 [architecture.md](doc/architecture.md)，PR04 实际架构见其 §14：

```text
.
├── AGENTS.md                      # AI 协作与开发规范
├── README.md                      # 项目入口文档（本文件）
├── doc/
│   ├── README.md                  # 课程要求的架构与过程文档
│   ├── architecture.md            # 已确认决策与各阶段实现说明
│   ├── pics/                      # 架构配图
│   └── requirements/
│       └── phase_cli_1.md         # 原始任务书
├── src/
│   ├── cli/                       # 预留；REPL、解析和呈现待实现
│   ├── commands/                  # 已实现命令、会话与完整快照历史
│   ├── model/                     # 已实现文档与六类图形模型
│   ├── io/                        # 仅 SvgStore 接口，实际读写待实现
│   └── main.ts                    # 仅启动消息，尚未接入命令系统
├── tests/
│   ├── *.test.ts                  # 模型、命令、历史、原子性和启动测试
│   └── doc/                       # PR3_test.md、PR4_test.md 测试说明
├── package.json
├── package-lock.json
├── tsconfig.json                  # 仅编译 src/
└── tsconfig.tests.json            # 编译 tests/ 到 dist/tests/
```

编译产物 `dist/` 与依赖目录 `node_modules/` 不应提交到 Git。

## 6. 开发与 PR 规划

遵循**一个 PR 对应一个独立、可验证的工程目标**。下表为建议顺序，可根据实际依赖和架构评审调整，**不是已完成记录**。

| 顺序 | 分支建议 | 目标 |
| --- | --- | --- |
| PR 01 | `chore/INIT-001-project-setup` | 初始化 TypeScript 工程、基础目录及构建验证 |
| PR 02 | `docs/ARCH-001-design` | 明确模块职责、依赖方向、Command / Composite 设计 |
| PR 03 | `feat/MODEL-001-shape-document` | 实现图形类、文档模型、层级与 ID 管理 |
| PR 04 | `feat/CMD-001-command-execution` | Command、会话、编辑/查询命令及完整快照 Undo/Redo（已实现，课程报告已记录人工验收） |
| PR 05 | `feat/CLI-001-command-infrastructure` | 后续拟实现 REPL、解析、分发与结果呈现 |
| PR 06 | `feat/EDIT-002-group-operations` | 原计划的结构操作已在模型/命令实现，后续验证 CLI 集成，具体 PR 待确认 |
| PR 07 | `feat/HISTORY-001-undo-redo` | 原计划的核心历史已在 PR04 实现，后续完善 CLI/IO 集成验证，具体 PR 待确认 |
| PR 08 | `feat/IO-001-svg-persistence` | 完善文档命令及 SVG 读写 |
| PR 09 | `test/QA-001-final-validation` | 集成测试、架构一致性自查与最终文档 |

**实施说明：** 本轮按用户要求将命令和完整快照历史集中在 PR04 完成，REPL 留给 PR05。表中后续分支仍为建议，执行范围以具体任务为准；完整文件 IO 语义留待后续阶段验证，不把内存命令测试当作 SVG 文件验收。

### 每个 PR 的基本流程

1. 从最新 `main` 创建功能分支。
2. 明确范围与验收标准；必要时先更新架构说明。
3. 分步修改并运行相应测试，提交有意义的 Commit。
4. 推送分支、创建 PR，记录变更内容和实际验证结果。
5. 审核通过后合并；如实现偏离设计，同步记录修订原因。

遵循 Conventional Commits，例如 `chore: initialize TypeScript project`、`feat: implement shape hierarchy`、`test: cover undo redo`。不伪造测试、评审、讨论或提交历史。

## 7. 课程交付文档

课程要求的详细文档统一写在 [`doc/README.md`](doc/README.md)，应包含：

- **架构方案：** 模块划分与职责、PlantUML 组件图或包图、设计模式、依赖方向规则、变化点假设。
- **过程记录：** 与 AI 协作中关键且真实的发现、讨论、纠错和迭代。
- **一致性自查：** 实际目录与设计是否一致、依赖方向是否被违反。
- **质量保证手段：** 功能完整性、测试与代码质量的证据。

本根目录 README 仅作为项目概览和开发入口，不替代上述课程交付文档。

## 8. 最终验收与版本标记

按照原始任务书的命令与典型会话进行功能验证，检查异常命令是否保持状态不变，验证撤销重做、分组嵌套、SVG 保存与读回，并核查架构及依赖关系。

完成全部功能、测试和文档后，在**截止时间之前**于最终提交创建并推送名为 `final` 的 Git tag。不要在初始化阶段提前创建该标签。

## 9. AI 协作与课程文档同步机制

所有开发阶段遵循 [`AGENTS.md`](AGENTS.md) 的工作规范：Codex 在每轮产生仓库改动的开发任务结束前，须根据**实际修改和验证结果**同步更新课程报告 [`doc/README.md`](doc/README.md)，分别维护架构方案、过程记录、一致性自查与质量保证手段。

报告为**增量维护**：自动记录事实与测试证据；重要设计决策、与 AI 协作的个人判断、人工验收结论保留 `【人工核对】` / `【人工填写】` 字段。未经本人审核不得把这些字段改为“通过”。文档应与本轮代码改动放在同一 PR 内，确保提交历史可追溯。`doc/requirements/phase_cli_1.md` 为原始任务书，**课程报告使用单数目录 `doc/README.md`**。
