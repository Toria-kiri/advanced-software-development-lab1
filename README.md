# SVG Editor CLI

《高级软件开发技术》Lab1 Phase 1：基于 TypeScript 的命令行 SVG 编辑器。

> **当前状态：Phase 1 最终交付版本，249 项测试通过；用户已授权提交、合并 PR07 并创建 `final` 标签。** 实际发布结果以 GitHub PR、远程 main 与 final 标签为准。可在终端编辑、保存、读取 SVG，并继续执行 Undo/Redo。需求覆盖、证据和交付限制见 [PR07 验收矩阵](tests/doc/PR7_acceptance.md)、[课程报告](doc/README.md) 和 [架构 §16](doc/architecture.md#16-pr-06-svg-持久化与完整集成2026-10-31)。用户已反馈 PR06 的 Edge 展示检查；PR07 新示例的浏览器观察尚未单独记录，不将发布授权冒充该项验证结果。

## 1. 项目目标

开发一个通过命令行（REPL）操作的 SVG 编辑器。用户可以创建、修改、分组和查看图形，撤销或重做编辑操作，并将结果保存为 SVG 文件或从已有 SVG 文件读取。

本项目不仅关注功能实现，还关注**面向对象设计、Command（命令）模式、Composite（组合）语义、模块依赖管理、自动化验证与可追溯的 Git 开发过程**。

### 目标交互示例

当前 CLI 已支持以下任务书示例中的命令：

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
| 文档管理 | `init`、`read`、`save`、`canvas` | 已接入真实 SVG 文件读写及历史边界 |
| 图形创建与编辑 | `create`、`delete`、`move`、`scale`、`set` | 已接入 CLI |
| 分组与层级 | `group`、`ungroup`、`addto`、`front`、`back` | 已接入 CLI |
| 信息查看 | `tree`、`show`、`help` | 已实现终端结构树、属性明细与命令语法帮助 |
| 操作历史 | `undo`、`redo` | CLI 复用完整快照、历史边界和失败原子性 |
| 图形类型 | `rect`、`circle`、`ellipse`、`line`、`text`、`g` | 模型已实现 |

当前全量 **249 项测试通过，0 失败、0 跳过**，覆盖及分文件统计见 [PR07 验收矩阵](tests/doc/PR7_acceptance.md)。PR06 的基线为 242 项，PR07 补充 7 项真实入口、资源阈值、恢复故障与示例可复现测试，详见课程报告 §4.13。PR04 的 49 项历史测试说明仍见 [PR4_test.md](tests/doc/PR4_test.md)。

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
npm run cli
npm run typecheck
npm test
npm run dev
```

其中 `build` 编译源码到 `dist/`，`start` 运行已编译的交互入口，`cli` 和 `dev` 均先构建再启动 CLI，`typecheck` 检查源码和测试的类型。`test` 先构建程序，再用独立配置编译测试，最后使用 Node.js 内置测试工具执行 `tests/*.test.ts` 对应的全部测试（CLI、命令、历史、模型行为及启动 smoke test）。

Windows PowerShell 若因执行策略无法运行 `npm.ps1`，将上述 `npm` 换成 `npm.cmd`，例如 `npm.cmd test`；无需修改系统执行策略。

在根目录运行 `npm run cli`（或构建后运行 `npm start`），启动后显示：

```text
SVG Editor CLI started!
svg>
```

随后可逐行输入命令，例如：

```text
init 800 600
create g scene
create rect r1 10 20 100 50 #4a90d9 in scene
create text t1 20 40 "中文 # <&>" in scene
move scene 30 20
undo
redo
tree
show r1
save demo.svg
read demo.svg
move r1 1 2
undo
redo
save
help
```

使用 EOF 退出：Linux/macOS 在空行按 Ctrl+D；Windows 控制台通常按 Ctrl+Z 后回车。没有新增 `exit`/`quit` 命令。`help` 沿用 PR04 的严格规则，也需先初始化文档。

输入规则：命令名大小写敏感；空白分隔参数，双引号保留空格和 `#`，反斜杠按字面保留，不解释 shell 转义或 `\n`/`\"`。引号必须包裹整个参数，未闭合或与其他字符粘连会报错。**注释必须独立成行**：去除前导空白后以 `#` 开头的整行为注释，不支持行尾注释。命令中的 `#`、`#4a90d9`、`A#B`、`#tag` 均作为普通参数保留；例如 `show r1 # comment` 会因多余参数报错。create 的 `in <containerId>` 必须位于末尾，文本内容若为 `in` 应加双引号。错误写入 stderr，反馈和查询写入 stdout；失败后可继续输入。

`init` 默认 800×600；只提供宽度时高度仍为 600。`canvas` 必须无参数或同时提供宽高。各图形参数和 `set` 白名单见任务书；`help` 包含六种图形的创建语法。上述示例会在当前目录生成并覆盖 `demo.svg`，可用浏览器打开；包含空格的文件路径使用英文双引号包裹。

### SVG 文件与路径规则

- `read <file.svg>` 可在 init 前使用；成功后设置读入路径，缺失 ID 按标签名加序号自动补齐并输出 warning，避开文件中所有显式 ID。
- `save [file.svg]` 写出真实 UTF-8 SVG；无参数时只使用最近一次成功 read 的路径。显式 save-as 不改变默认读入路径，init 会清除路径；没有读入路径时需显式指定保存文件。
- init、成功 read/save、修改 canvas 都清空并封锁旧历史，下一次成功编辑后解封。失败读写保留文档、路径及历史。
- 支持六类图形、嵌套组、几何属性、显式 fill/stroke/stroke-width 和 Unicode 文本。根尺寸缺失时分别补 width=800、height=600；已提供的值必须为有限正数。几何缺省值补 0，数值允许无单位或 px；viewBox 只接受与画布一致的 `0 0 width height`。
- 不支持 transform、非默认 viewBox、path/image/script/tspan、CSS style/样式表、额外视觉属性、外部绘制引用和 DTD/自定义实体，遇到时明确报错；不声称支持完整 SVG。
- 输入/输出上限为 16 MiB，最多 100000 个图形、256 层；XML 特殊字符由 IO 层转义。保存采用同目录临时文件完整写入、sync/关闭、rename 替换；常规失败尝试清理临时文件，不先删除旧目标。文件系统与内存不共享事务，异常或进程中断下不能保证二者绝对同步，详见架构 §16。

create 的可选 fill/stroke 颜色参数会检查 HEX 格式：去除两端空白后，以 `#` 开头的颜色须为 `#RGB`、`#RGBA`、`#RRGGBB` 或 `#RRGGBBAA`，每位仅允许 `0–9`、`a–f`、`A–F`。`#12`、`#zi`、`#中文` 和单独 `#` 均报 `error: invalid hex color: ...`，不创建图形、不改变历史；加双引号也不能绕过。普通颜色名仍可使用；ID 和文本内容中的 `#` 不属于颜色参数，不套用此校验。此项为人工验收补充规则，非任务书新增原文。

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
  return result.data; // x=10、y=20；其他入口也可复用结构化结果
}
```

同一 Session 绑定一个 Executor；每次操作必须 await 完成，重叠调用会报 `error: command executor is busy`。`session.requireDocument()` 返回独立副本，修改副本不影响会话。init、read、save 和修改 canvas 成功后建立历史边界；查询不影响历史。HelpCommand 接收外部提供的只读语法列表。ReadCommand/SaveCommand 接收 SvgStore 注入，实际磁盘实现为 SvgFileStore。

可复现交付示例见 [examples/README.md](examples/README.md)，命令脚本为 `examples/phase1.cli`，实际 CLI 生成的 SVG 为 `examples/phase1.svg`。自动测试在临时目录重放脚本并与交付文件比较语义，不覆盖仓库中的示例。

## 5. 当前目录与职责

以下为当前主要目录；整体架构与实际实现范围见 [architecture.md](doc/architecture.md)，命令、CLI 与 IO 实际架构分别见其 §14/§15/§16：

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
│   ├── cli/                       # 已实现 REPL、词法解析、命令分发和结果呈现
│   ├── commands/                  # 已实现命令、会话与完整快照历史
│   ├── model/                     # 已实现文档与六类图形模型
│   ├── io/                        # SvgStore、XML 解析/序列化及真实文件存储
│   └── main.ts                    # 组装单 Session/Executor 并启动交互
├── tests/
│   ├── *.test.ts                  # CLI、模型、命令、历史、原子性和启动测试
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
| PR 05 | `feat/CLI-001-interactive-editor` | REPL、解析、分发与结果呈现，接入模型和命令系统（已合并） |
| PR 06 | `feat/IO-001-svg-persistence` | Read/Save、真实 SVG 读写与完整生命周期集成（已合并，保留人工核验记录） |
| PR 07 | `test/QA-001-phase1-acceptance` | 需求追踪、真实 CLI/IO 验收、边界回归、示例与最终文档（待本轮人工签收） |

**实施说明：** PR04 完成命令与历史，PR05 接入 CLI，PR06 完成真实文件读写及语义回读测试。原计划的编辑/结构/历史工作已提前落实；自动 XML/文件验证不代替人工浏览器显示验收，后续分支仍为建议。

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
