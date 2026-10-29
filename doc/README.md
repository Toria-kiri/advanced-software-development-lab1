# Lab1 Phase 1 — 架构设计与开发过程报告

> 本文件是课程要求的交付文档，实际仓库路径必须为 **`doc/README.md`**。`doc/requirements/phase_cli_1.md` 仅保存原始需求。本文由开发过程中的 Codex 增量维护，最终内容需由学生审查确认。
>
> 记录状态：`[待实现]`、`[已实现待人工核验]`、`[人工已核验]`。没有证据时不得标记为已核验。

## 1. 架构方案

### PR 02 架构草案（2026-10-28）

详细草案见 [architecture.md](architecture.md)（需求、类设计、流程、三张 PlantUML 源图、验收映射和 D1–D6 决策）。以下为新增拟议方案，业务类均 **[待实现]**；保留下文 PR 01 的历史事实和原人工字段，不将当时的“待设计”回写为已完成。

| 拟定目录 | 本轮明确的职责与组件 | 禁止承担的职责 |
|---|---|---|
| `src/cli/` | CliRepl、CommandParser、CommandDispatcher、CliRenderer：逐行输入、词法、构造命令、终端排版 | 写模型字段、文件访问、几何计算和历史算法 |
| `src/commands/` | Command、各具体命令、CommandExecutor、CommandHistory、EditorSession：操作编排、事务、历史、当前文档和读入路径 | 按图形类型分支、直接 fs/readline |
| `src/model/` | Document、Shape、五种叶子、Group、ShapeFactory：多态几何/属性行为、树不变量和唯一 id | 知道终端、历史或磁盘路径 |
| `src/io/` | SvgStore 接口、SvgFileStore、SvgParser、SvgSerializer：文件与 XML，返回已验证候选和警告 | 绕过 Document 直接改私有字段 |
| `src/main.ts` | 组合注入、启动 | 承担业务逻辑 |

**Command（拟定）**：每条操作构建对象，接收者为 Document/Shape。Executor 对编辑创建候选深副本，成功后提交并保存 before/after，复杂操作一个单元；失败不提交、不清空 redo。init/read/save/canvas 修改成功后清空并封锁历史，直到下一次成功编辑；canvas 查询和显示不影响历史。当前仅设计，尚无实现落地位置。

**Composite（拟定）**：Group extends Shape，move/scale 递归委派，叶子自行计算几何。普通组 set 推荐自身 SVG 样式继承；delete 对叶子/组统一由 Document 删除子树。Document 统一树写入、顺序、idIndex 和 parentIndex，拒绝循环、重复 id 和祖孙同时 group；根级 g 禁止解组遵循原文。

**拟定依赖规则及原因**：main → 全部（组合）；cli → commands、model 只读视图（隔离输入与业务）；commands → model、io 的 SvgStore 接口（复用领域行为及可注入存储）；io → model、Node fs（格式与存储适配）；model → 仅 model（保持领域独立）。所有反向依赖禁止；图形不感知历史，IO 不依赖 commands，避免循环。未来逐 PR 检查 imports 和实际写入调用，不以目录存在代替实现审查。

```plantuml
@startuml
title PR 02 拟定包依赖（业务均待实现）
component "main.ts" as Main
package "cli" as CLI
package "commands" as Commands
package "io (SvgStore + 实现)" as IO
package "model" as Model
Main --> CLI
Main --> Commands
Main --> IO
Main --> Model
CLI --> Commands
CLI --> Model : 只读视图
Commands --> IO : 仅 SvgStore 接口
Commands --> Model
IO --> Model
@enduml
```
![pic](./pics/re-1-架构.png "pic1")

当前实际依赖仍是 `src/main.ts` 无 import，`tests/smoke.test.ts` 只用 Node 标准库；上图不是当前代码组件图。详细草案中接口实现关系与这里的包依赖一致。

**变化点与取舍（拟定）**：新增图形通过 Shape 子类和 Factory，新增命令通过 Command 子类和 Dispatcher；两处名称分派显式标记待重构，后续可替换为注册机制。本轮不实现 ShapeProvider、box 或插件加载。新入口复用 commands/model/io；XML 编解码与文件存储分离便于后续格式变化，暂不做多格式框架。推荐深副本换取原子性与可审查性，接受 O(历史×文档大小) 空间；增量历史为备选，见 D1。

**修订登记**：2026-10-28 / ARCH-001（PR 待创建、commit 待创建），在 PR 01 预留四目录基础上细化职责和依赖，没有改动实际工程或配置。现为“PR 02 架构草案，已完成人工确认”可以作为架构基线。


### PR 01 工程基线（2026-10-27）

本轮无业务架构变化，仅完成工程初始化。已建立 `src/cli/`、`src/commands/`、`src/model/`、`src/io/`（各含 `.gitkeep`）、`src/main.ts` 和 `tests/smoke.test.ts`。模块目录只是初始规划；领域模型和 Command 架构尚未正式设计，最终模块职责、依赖方向及 PlantUML 图待 PR 02 确定。下面的拟定模块和未填写字段继续保留，不代表已经实现。

工程配置：`package.json` 提供 build/start/dev/typecheck/test；`tsconfig.json` 仅编译 `src/` 到 `dist/`，采用 ES2022、CommonJS、Node 模块解析、strict、esModuleInterop、skipLibCheck，并启用 noEmitOnError。`tsconfig.tests.json` 继承配置，将测试单独编译到 `dist/tests/`，避免测试位于源码 rootDir 之外的错误；typecheck 同时检查源码和测试。`package-lock.json` 锁定依赖。

环境选择：使用已安装的 Node.js 24 LTS，工程 engines 限定 24.x；本地开发依赖 TypeScript `~5.9.3` 保持要求的 CommonJS/Node 配置，`@types/node` 使用 24.x 与运行环境匹配。测试使用 Node.js 内置工具，不引入第三方测试框架或业务抽象。

### 1.1 模块划分与职责

| 模块/目录 | 职责 | 对外接口或关键类 | 状态与证据 |
|---|---|---|---|
| `src/cli/`（拟定） | REPL 输入、解析与输出 | 待设计 | [待实现] |
| `src/commands/`（拟定） | Command 执行与历史管理 | 待设计 | [待实现] |
| `src/model/`（拟定） | Document、Shape、树结构 | 待设计 | [待实现] |
| `src/io/`（拟定） | SVG 读写 | 待设计 | [待实现] |

**组件图 / 包图（PlantUML，架构确定后补充）：**

```plantuml
@startuml
' TODO(AI): 根据实际代码与依赖关系绘制，不能凭规划冒充实现
@enduml
```

**【人工核对】** 模块职责与边界是否符合你的真实设计意图？有没有上帝类、循环依赖或过度抽象？

- 审查结论：[待填写]
- 审查日期 / 对应 PR：[待填写]

### 1.2 设计模式选择及落地

- **Command 模式（必需）**：待实现；后续由 AI 填写命令接口、具体命令类、执行入口、历史管理及代码位置。
- **Composite 语义**：待实现；后续由 AI 填写叶子/容器统一操作机制及代码位置。
- **设计权衡**：待记录（包括为何不采用其他方案，以及代价）。

**【人工核对】** 是否真的通过多态与对象职责实现，而不是换个类名继续使用过程式分派？

- 审查结论：[待填写]

### 1.3 模块依赖方向规则

| 调用方 | 允许依赖 | 禁止依赖 | 理由 | 实际核查证据 |
|---|---|---|---|---|
| 待设计 | 待设计 | 待设计 | 待设计 | [待检查] |

**【人工决策】** 正式批准依赖方向后再标记为架构基线。结论：[待填写]

### 1.4 变化点假设与取舍

| 可能变化点 | 当前设计如何应对 | 代价或明确不预留的理由 | 人工确认 |
|---|---|---|---|
| 新增图形类型（后续插件化） | [待分析] | [待分析] | [待填写] |
| 新增命令入口 | [待分析] | [待分析] | [待填写] |
| 文件格式/读写策略 | [待分析] | [待分析] | [待填写] |

### 1.5 架构决策与修订记录

| 日期 / PR | 原方案 | 调整后方案 | 触发问题与理由 | 影响范围 | 人工状态 |
|---|---|---|---|---|---|
| [待记录] | | | | | [待核验] |

## 2. 过程记录

> 只记录真实且有代表性的讨论、建议、验证、反例与纠正；不要为凑字数编造“AI 曾建议”。每次会话不必强行制造设计分歧，但应记下实际改动和证据。

### 2.1 开发会话日志（按时间追加，不覆盖历史）

| 日期 / 分支 / PR | 本次目标 | 实际修改与证据（文件、提交、测试） | AI 建议及采用情况 | 问题与纠正 | 未决事项 / 人工复核 |
|---|---|---|---|---|---|
| [待执行] | | | | | |
| 2026-10-27 / `chore/INIT-001-project-setup` / INIT-001（PR 待创建） | TypeScript 工程初始化 | 新增 `package.json`、`package-lock.json`、`tsconfig.json`、`tsconfig.tests.json`、`src/main.ts`、四个模块目录的 `.gitkeep`、`tests/smoke.test.ts`；增量更新根 `README.md` 和本报告。原有未提交的 README 内容、`AGENTS.md`、任务书和报告框架保留，并作为本阶段基线纳入提交；commit 待创建，实际 hash 见会话最终汇报 | 采用独立测试编译配置和 Node 内置测试；本轮未发生代表性业务设计纠错 | 上轮环境检查未找到 Node/npm，本轮已可用；`npm --version` 遇到 npm.ps1 执行策略限制，改用 `npm.cmd`，未修改系统策略；沙箱创建分支失败，获准提升权限后成功；依赖安装请求返回 EACCES，终止重试并获准访问 registry 后安装成功 | 自动验证均通过；人工验收、个人反思待填写；业务能力待后续 PR |

本轮实际步骤：读取约束、原始任务书和已有文档 → 检查 Git 状态及原有 README diff → 创建功能分支 → 添加工程配置、入口与 smoke test → 安装依赖 → 增量更新 README → 执行验证 → 更新本报告 → 检查 diff 与暂存内容 → 验收通过后创建一次本地提交。不创建远程 PR、不推送、不创建 final tag。

### 2.2 有代表性的 AI 协作案例

**案例编号：[001-PR2中潜在循环依赖问题]**

- 工程背景/遇到的问题：AI写的架构文件中“命令覆盖与状态归属”的模块中可能有循环依赖的潜在问题。
- AI 原建议（如有，保留可追溯摘要）：architecture.md文件中的1.2节中说
```
| help / HelpCommand | CommandDispatcher 提供语法描述 | 全部语法；不改变历史 |
```
- 我发现的问题与判断理由：HelpCommand 需要显示所有命令的使用说明，但这些说明由 CommandDispatcher 提供，那么 HelpCommand 应该怎样拿到这些数据呢？

CommandDispatcher 位于 cli 模块，负责识别命令、提供命令语法说明。HelpCommand 位于 commands 模块，负责执行 help 命令。依赖规则规定 cli → commands，不允许 commands → cli。

如果直接
```
import { CommandDispatcher } from "../cli/CommandDispatcher";
```
就有可能形成CLI 要 import HelpCommand，HelpCommand 又要 import CommandDispatcher的情况，构成循环依赖。

- 如何验证与修正（文件、测试、结果）：明确规定Dispatcher 创建 HelpCommand 时直接把数据给它，这样HelpCommand 只知道自己收到了一段帮助文字，完全不知道文字由谁提供。


### 2.3 PR 02 会话记录（2026-10-28）

- 分支：`docs/ARCH-001-design`；PR 待创建；commit 待创建，本轮按用户要求不暂存、不提交、不推送、不创建 PR/tag。
- Git 证据：初始分支 `chore/INIT-001-project-setup` 工作区干净；`git log main -3 --oneline` 显示 `05d26ba Merge pull request #1` 包含 `8374cb9`；祖先检查成功。`git fetch origin` 首次因 `.git/FETCH_HEAD` 写权限失败，经自动审批提升权限后成功；fetch 后 `git rev-list --left-right --count main...origin/main` 为 `0 0`。从 main 创建目标分支，未修改 remote 配置或已有历史。
- 阅读 AGENTS、根 README、完整任务书、原报告、package/两份 tsconfig、现有源码和测试，确认业务未实现。新增 `doc/architecture.md`，增量更新本报告，未改源码、测试、配置、锁文件或原始任务书。
- AI 建议：保留四目录，分离解析/分发/执行和 XML/文件职责；采用 Command + 候选副本，模型多态 clone 及 before/after 历史，替代仅靠逆操作。考虑逆操作/局部快照可节省内存，但浮点回算和复合结构恢复增加验证成本，建议作为备选交人工决策，未宣称用户已接受。
- 实际发现：任务书根级 g 解组限制与常见编辑器习惯不同；跨父 group 的组位置/顺序、普通 g 样式 set、save-as 路径生命周期与外部 transform 范围未完全明确，草案列 D2–D5 供用户确认，没有补写为老师强制规则。
- 检查与纠正：首次 PowerShell 读取中文显示乱码，显式 UTF-8 重读；首次批量读取输出过长，分文件补读，避免凭截断内容设计。未发生用户与 AI 的代表性设计争论，不编造人工反馈。工程检查和设计检查结果见 §3.3、§4.4。
- **【人工填写】[待填写]** 请在 §2.2 或此处记录本人实际判断、是否采纳推荐及真实分歧和收获；个人反思：[待填写]。

## 3. 一致性自查

### 3.1 模块划分与方案一致性

| 计划模块 | 实际文件/目录 | 是否一致 | 差异与修订记录 | 人工确认 |
|---|---|---|---|---|
| [待检查] | | [未检查] | | [待填写] |
| PR 01 初始目录与文档 | `src/main.ts`、四个预留模块目录、`tests/smoke.test.ts`、`doc/README.md`、`doc/requirements/phase_cli_1.md` | 通过（自动检查） | 与本轮规划一致；未创建 `docs/`；业务模块仍未实现。原有 `AGENTS.md`、需求文件未改写 | 【人工核对】[待核验] |
| 工程与依赖配置 | `package.json`、`package-lock.json`、`tsconfig.json`、`tsconfig.tests.json`、`.gitignore` | 通过（自动检查） | `npm.cmd ls --depth=0` 显示 typescript 5.9.3、@types/node 24.19.2；现有忽略规则已覆盖所需产物，无需修改 `.gitignore` | 【人工核对】[待核验] |

路径检查：`rg -n 'docs/' AGENTS.md README.md doc` 只命中 README 中 PR 02 的分支名 `docs/ARCH-001-design`，其含义是 Git 分支命名，不是课程文档路径，故保留。

### 3.2 依赖方向一致性

| 规则 | 检查方式与范围 | 检查结果 | 违规证据/修复提交 | 人工确认 |
|---|---|---|---|---|
| [待确定] | [待执行] | [未检查] | | [待填写] |

PR 01：业务架构与模块依赖关系暂不适用，待后续实现。检查 `src/main.ts` 仅包含启动输出，没有 import 或业务类；测试只依赖 Node.js 标准库，通过子进程验证已编译入口。未发现本轮越界实现；不将此结论视为最终架构一致性验收。

**【人工核对】** 结论是否与实际代码相符？抽查哪些 import、调用关系？结论：[待填写]

### 3.3 PR 02 一致性自查（2026-10-28）

| 检查范围 | 结果 | 依据及限制 |
|---|---|---|
| 实际目录与改动范围 | 通过 | `rg --files --hidden` 显示四目录 .gitkeep、main 和 smoke；仅新增 architecture.md 和修改本报告。没有建立课程 `docs/` 目录，分支的 docs/ 前缀不代表文件目录 |
| 需求与命令责任覆盖 | 通过（设计检查） | architecture.md §1.2 覆盖四类文档命令、十个编辑命令、三类显示和 undo/redo；§11 按原文段落映射后续测试。不能视为功能测试通过 |
| 图文内部一致性 | 通过（源文本审阅） | 三张图对应四目录、Document/Shape、Command/Executor/History 和候选提交；组件/包图均为 commands → io 接口、io → model，无 io → commands；移动流程与快照恢复相符 |
| 业务代码依赖与封装 | 未检查（尚无实现） | 当前 main 无业务依赖；未来类图中的模型封装、树协议和 import 必须在实现后逐项验证 |
| 工程与配置未误改 | 通过 | `git diff -- src tests package.json package-lock.json tsconfig.json tsconfig.tests.json README.md AGENTS.md doc/requirements/phase_cli_1.md` 无输出 |

**【人工核对】[待核验]** 请复查 architecture.md §3/§4/§7 三图与 §9 规则、§11 需求映射，并在此填写设计内部一致性结论：[待填写]。PlantUML 渲染未运行，不把源文本检查当成布局验证。

## 4. 质量保证手段

### 4.1 验证记录

| 日期 / PR | 验证命令或测试场景 | 实际结果 | 证据（输出摘要 / 文件位置） | 已知限制 |
|---|---|---|---|---|
| [待执行] | | [未运行] | | |
| 2026-10-27 / INIT-001 | `git --version`、`node --version`、`npm.cmd --version`、`node -p "process.release.lts"` | 通过 | Git 2.54.0.windows.1；Node v24.22.1；npm 11.19.1；LTS 代号 Krypton | `npm --version` 被 PowerShell 策略阻止，使用 npm.cmd 解决 |
| 2026-10-27 / INIT-001 | `npm.cmd install --save-dev typescript@~5.9.3 @types/node@24 --cache .npm --fetch-retries=0` | 通过 | added 3 packages，audited 4 packages，0 vulnerabilities；`npm.cmd ls --depth=0` 无缺失依赖 | 先前沙箱安装尝试因 EACCES 未完成，获准访问后成功；未安装全局依赖 |
| 2026-10-27 / INIT-001 | `npm.cmd run build` | 通过，退出码 0 | 生成 `dist/main.js` | 仅最小入口 |
| 2026-10-27 / INIT-001 | `npm.cmd run typecheck` | 通过，退出码 0 | 源码及测试均无类型错误 | 尚无业务类型 |
| 2026-10-27 / INIT-001 | `npm.cmd test` | 通过，退出码 0 | Node 内置测试执行 1 项，pass 1 / fail 0；检查子进程无启动错误、退出码 0、stderr 为空和正确启动消息 | 仅启动 smoke test；业务测试尚未实现 |
| 2026-10-27 / INIT-001 | `npm.cmd start`、`npm.cmd run dev` | 均通过，退出码 0 | 均输出 `SVG Editor CLI started!` | 没有 REPL 或 SVG 编辑功能 |
| 2026-10-27 / INIT-001 | `git check-ignore -v node_modules/ dist/ .npm/ .env setup.log setup.tsbuildinfo` | 通过 | 命中现有 `.gitignore` 规则 | 源码、配置、锁文件、文档的暂存检查在提交前执行 |
| 2026-10-27 / INIT-001 | `git diff --cached --stat`、`git diff --cached --name-only`、`git status --short` | 通过 | 暂存 14 个工程与文档文件，包含原有规范和任务书；没有依赖、构建产物、日志或环境文件 | 尚未创建提交，hash 由最终汇报提供 |
| 2026-10-27 / INIT-001 | `git diff --cached --check` | 存在原始文件格式提示 | 仅提示 `doc/requirements/phase_cli_1.md:522: new blank line at EOF` | 该文件原有末尾空行保留，未为消除提示改写任务书；本轮新增工程文件无此问题 |

截至 2026-10-27，根据 [Node.js 官方发布计划](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json)，24.x LTS 支持至 2028-04-30，本轮沿用该已安装版本。`npm ci` 尚未运行；未进行 SVG 功能测试、IO 回读或最终课程验收，下面功能覆盖项继续保持 [未验证]。

### 4.2 功能与异常覆盖

| 场景 | 状态 | 测试位置 / 手工操作证据 |
|---|---|---|
| 六种图形类型 | [未验证] | |
| create / delete / move / scale / set | [未验证] | |
| group / ungroup / addto / front / back | [未验证] | |
| undo / redo 和 IO 后禁止规则 | [未验证] | |
| read / save SVG 回读 | [未验证] | |
| 唯一 id、错误原子性和非法参数 | [未验证] | |
| tree / show / help 与 REPL | [未验证] | |

### 4.3 遗留风险与最终人工验收

- 已知缺陷或未覆盖情况：[待记录]
- **【人工填写】** 你亲自运行/观察过的主要场景：[待填写]
- **【人工填写】** 你认为当前架构最值得改进之处：[待填写]
- **【人工填写】** 是否认可本阶段功能完整性与质量依据，为什么：[待填写]
- 最终签收日期、PR/Commit：[待填写]

### 4.4 PR 02 实际验证记录（2026-10-28）

| 命令 / 检查 | 结果 | 范围与限制 |
|---|---|---|
| `npm.cmd run build` | 通过，退出码 0 | 原有最小入口编译 |
| `npm.cmd run typecheck` | 通过，退出码 0 | src 与 tests 两份配置 |
| `npm.cmd test` | 通过，退出码 0；1 项 pass、0 fail | 仅原有启动 smoke，不含 SVG 业务功能 |
| `rg --files --hidden`（排除 git/依赖/产物）、读取文件与链接检查 | 通过 | 文档均在 doc，architecture.md 到报告和任务书的相对路径存在 |
| 对照原始任务书逐条检查、审阅 PlantUML 源与职责表 | 通过（设计检查） | 覆盖详见 architecture.md §11；D1–D6 未经人工确认 |
| `Get-Command plantuml, java -ErrorAction SilentlyContinue` | 无命令返回 | 未运行 PlantUML 渲染或语法工具；三图仅保存源代码和人工源文本检查 |
| `git diff --check`、新增文档空白检查 | 通过 | 完成后再次检查；未暂存文件需额外检查，不只依赖 git diff |
| 临时 Node stdin 脚本（未新增脚本文件） | 通过 | 两份文档无行尾空白；UML 起止配对，草案 3 块、报告 2 块（含原占位图）；19 个命令名及文档目标存在；仅为存在性检查，不代表语义或 UML 语法验证 |
| `git status --short`、受保护路径 diff | 仅报告修改和新增架构文档；其他路径无 diff | 没有提交或暂存；dist 为被忽略构建产物 |

本轮 `npm ci`、start/dev、业务测试、SVG 文件回读、浏览器演示、最终功能验收均 **未运行**；没有新增测试或声称测试覆盖率。既有 §4.2 功能项仍为 [未验证]。文档设计风险及后续测试计划不能代替实现结果。

## 5. 本次会话待人工处理清单

> AI 每次开发会话结束时更新这里，只保留当前仍未处理的问题；已解决事项迁移到相应章节的审查结论或记录中。不得替用户填“已审核”。

- [ ] **【人工核对】[已核验]** 对照 `package.json`、两份 tsconfig、`src/main.ts` 和 `tests/smoke.test.ts`，复核第 1 节工程基线、第 3 节一致性自查，确认目录创建没有被误写为完成业务架构。[判断]没有被误写为完成业务架构
- [ ] **【人工核对】[已核验]** 在本机用 `npm.cmd run build`、`npm.cmd run typecheck`、`npm.cmd test`、`npm.cmd start` 复现第 4.1 节结果，确认启动输出和 1 项测试；第 4.3 节保留个人验收结论。[判断]复现成功，确认启动输出和测试没问题。
- [ ] **【人工填写】[已填写]** 在第 2.2 节按真实经历填写个人判断与收获；没有实际分歧时如实注明，不补写不存在的讨论。第 4.3 节填写本人观察、质量评价及签收信息；架构相关字段待 PR 02 设计后填写。[判断]
- [ ] **【人工决策】[已填写]** 在 `doc/architecture.md` §12 D1–D6（进入 PR 03 前）逐项填写：快照历史 / 普通 g 样式 / 跨父分组 / 默认保存路径 / 外部 SVG 和 transform 范围 / 模块及树写入协议。每项已提供推荐理由与备选；将批准结论同步本报告 PR 02 架构小节。
- [ ] **【人工核对】[已核验]** 在 `doc/architecture.md` §12 核对任务书限制、两处分派及三图，建议用跨父 group 和子节点显式 fill 两个例子检验 D2/D3；本报告 §3.3 填写结论。使用 PlantUML 预览工具检查三图语法/布局，本轮尚未渲染。
- [ ] **【人工核对】[已核验]** 核验本报告 §2.3 的分支与 PR #1 合并事实、§4.4 的自动检查结果；可用 git log 和 npm 三条命令复现，确认只有两份文档改动。人工核验结果仍待本人填写。
- [ ] **【人工填写】[已填写]** 在本报告 §2.2/§2.3 补充对架构取舍的真实判断和反思；在 architecture.md §12 填写本人接受或调整的理由。§4.3 最终验收字段继续保留
