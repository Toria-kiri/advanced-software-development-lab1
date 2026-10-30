# PR07 Phase 1 需求追踪与验收

基线：`97de984`（Merge pull request #6），分支 `test/QA-001-phase1-acceptance`，2026-10-31。权威依据为 [任务书](../../doc/requirements/phase_cli_1.md)，人工决策见 [架构 §12](../../doc/architecture.md#12-在进入-pr-03-编码前必须由用户确认的架构决策)。本矩阵在修改业务代码前建立；初次状态来自源码/测试审查，运行结果另行补录，不以 README 宣称代替执行证据。

状态：A=已实现且有自动测试；B=已实现但缺针对性测试；C=部分实现；D=未实现；H=人工确认规则；X=任务书未要求的扩展。A 不代表浏览器或人工签收。

## 1. 需求追踪矩阵

源码路径除特别标明外均相对 `src/`；测试位置为 `tests/`，名称是可搜索的实际测试标题或参数化标题前缀。测试可运行 `npm.cmd test`，单文件先完成编译再运行 `node --test dist/tests/tests/<文件>.test.js`。

| 编号 | 任务书位置 | 具体要求 | 实现文件 / 方法 | 测试文件：名称 | 验证方法 / 初次状态 / 限制 |
|---|---|---|---|---|---|
| F01 | §3 文档 | init 默认/指定画布 | commands/InitCommand.execute；model/Document.constructor | commands.test.ts：init defaults/custom dimensions | A；实际尺寸、空树、路径与历史 |
| F02 | §2、§3 | read、缺 ID 警告 | commands/ReadCommand.execute；io/SvgParser.parse | io-history.test.ts：real read works before init；svg-codec.test.ts：missing ids reserve later explicit ids | A；真实文件、预留 ID、警告、blocked |
| F03 | §3 | save 显式/读入路径 | commands/SaveCommand.execute；io/SvgFileStore.write | io-history.test.ts：D4 default save follows latest read | A；真实回读，save-as 不改变 readPath 属 H/D4 |
| F04 | §3、§4.3 | canvas 查询/修改 | commands/CanvasCommand.effect/execute | command-history.test.ts：canvas boundary blocks both history directions；commands.test.ts：canvas query does not affect history | A；查询不变，修改建立边界 |
| F05 | §3、§4.1 | create 六类及 in | commands/CreateCommand.execute；model/ShapeFactory.create | commands.test.ts：CreateCommand；cli-dispatcher.test.ts：create delegates all six type grammars | A；检查真实父关系和类型 |
| F06 | §3 | delete 子树 | model/Document.delete；commands/DeleteCommand.execute | commands.test.ts：delete subtree: one history unit；document.test.ts：delete removes a whole subtree | A；索引移除及完整恢复 |
| F07 | §3 | move 增量 | model/Shape.move；五叶子 planMove；Group.planMove | shapes.test.ts：attributes, description, move, scale and independent clone | A；全部几何属性、溢出和递归 |
| F08 | §3、§4.2 | scale 正数、位置尺寸同缩 | model/Shape.scale；五叶子/Group.planScale | shapes.test.ts：own geometry whitelist；group recursively transforms each descendant once | A；笔宽和文本内容不缩放 |
| F09 | §4.1 | set 白名单 | model/Shape.setAttribute；叶子 setGeometryAttribute | shapes.test.ts：own geometry whitelist, style preservation and atomic errors | A；每类属性、非法 id/transform、失败不变 |
| F10 | §3、§4.2 | group 收编与祖孙拒绝 | model/Document.group | document.test.ts：group same-parent selections；D3 cross-parent grouping；group rejects missing/duplicate ids | A；原顺序、跨父规则另见 H03 |
| F11 | §3、§4.2 | ungroup 原槽位、禁止根级组 | model/Document.ungroup | document.test.ts：group same-parent selections；D3 handles root LCA | A；根级限制按任务书，不将根 svg 当可编辑组 |
| F12 | §3 | addto 追加末尾、禁止环 | model/Document.addTo | document.test.ts：addTo appends, supports reordering in the same parent and rejects cycles | A；不是按原兄弟顺序插入目标组 |
| F13 | §3 | front 同级视觉最前 | model/Document.bringToFront/reorder | document.test.ts：front/back change only sibling drawing order | A；末尾绘制、保留内部树 |
| F14 | §3 | back 同级视觉最后 | model/Document.sendToBack/reorder | 同 F13 | A；开头绘制 |
| F15 | §3、§5.1 | tree 全树/子树、内联几何 | commands/TreeCommand.execute；cli/CliRenderer.tree | cli-renderer.test.ts；commands.test.ts：tree and show provide typed structure | A；Unicode 排版与真实结构分别检查 |
| F16 | §3、§5.2 | show 属性与 parent | commands/ShowCommand.execute；cli/CliRenderer.show | cli-renderer.test.ts；cli-dispatcher.test.ts：tree/show/help route through query Commands | A；显式属性，不伪造继承值 |
| F17 | §3 | help 全命令语法 | cli/CommandDispatcher.helpEntries；commands/HelpCommand.execute | cli-dispatcher.test.ts：tree/show/help route through query Commands | A；19 名称和六类语法，无文档时严格报错 |
| F18 | §4.3 | undo 完整一个编辑单元 | commands/CommandExecutor.undo；CommandHistory.prepareUndo | commands.test.ts：one history unit restores all attributes；command-history.test.ts：continuous undo/redo | A；实际全树比较，不仅计数 |
| F19 | §4.3 | redo、分叉清空 | commands/CommandExecutor.redo；CommandHistory.record/prepareRedo | command-history.test.ts：new edit after undo clears redo | A；失败/查询不清 redo |
| F20 | §4.3 | init/read/save/canvas 历史边界 | CommandExecutor.execute；CommandHistory.blockAndClear | command-history.test.ts：boundary blocks both history directions；io-history.test.ts：D4 default save | A；新编辑只撤销到边界基点 |
| F21 | §2、§4.2 | 失败不变、一行 error | CommandExecutor.exclusive/execute；cli/CliRenderer.error | command-atomicity.test.ts；io-history.test.ts：real failed reads and saves preserve | A；内容、索引、路径、两栈和 blocked；磁盘窗口另述 |
| S01 | §4.1 | rect | model/Rect | shapes.test.ts：rect:；factory.test.ts：factory creates rect | A；几何、样式、clone |
| S02 | §4.1 | circle | model/Circle | shapes.test.ts：circle:；factory.test.ts：factory creates circle | A |
| S03 | §4.1 | ellipse | model/Ellipse | shapes.test.ts：ellipse:；factory.test.ts：factory creates ellipse | A |
| S04 | §4.1 | line | model/Line | shapes.test.ts：line:；factory.test.ts：factory creates line | A；可选参数是 stroke，未指定时不补默认 |
| S05 | §4.1 | text | model/Text | shapes.test.ts：text content stays raw；factory.test.ts：factory creates text | A；内容与颜色区分 |
| S06 | §4.1、§2.1 | g 嵌套/统一操作 | model/Group extends Shape | shapes.test.ts：group recursively transforms each descendant once | A；样式采用 H02 |
| I01 | §2 | svg> 逐行/EOF | cli/CliRepl.run；main.ts | cli-integration.test.ts：compiled entry processes CRLF；buffered lines and EOF wait | A；真实键盘表现仍需本人确认 |
| I02 | §2 | 双引号空格/中文 | cli/CommandParser.tokenize | cli-parser.test.ts；cli-integration.test.ts：REPL init/create | A；无转义是已记录约定，不扩展 shell |
| I03 | §2 | 独立整行 # | CommandParser.tokenize | cli-integration.test.ts：only separate comment lines are ignored | A；颜色/文本普通 #；明确禁止行尾注释 |
| I04 | §2 | 唯一、大小写敏感 ID | model/Document.index/insert；SvgParser.parse | document.test.ts：insert owns a deep copy；svg-codec.test.ts：missing ids reserve later explicit ids | A；外部 ID 自动补齐与冲突预留 |
| I05 | §4.2 | 规定错误模板/无文档 | ModelError；Document；ShapeFactory；CommandExecutor | commands.test.ts：no-document errors apply；document.test.ts；factory.test.ts | A；box 专属 composite 错误本阶段不适用 |
| IO01 | §0、§3 | 保存/读取六类及文本/顺序 | io/SvgSerializer.serialize；SvgParser.parse；SvgFileStore | svg-codec.test.ts：multiple serialization and parsing cycles；cli-io.test.ts：real CLI lifecycle | A；真实文件多次语义往返 |
| IO02 | §0.2 | 浏览器展示 | 保存的标准 namespace SVG | PR06 用户反馈：Edge 打开 demo.svg 检查矩形/圆形/文字 | 部分人工证据；PR07 新示例尚待浏览器核验，XML 成功不等于显示验收 |
| IO03 | §2、§4.2 | 文件/解析失败保持 | SvgFileStore.read/write；Executor | svg-file-store.test.ts：failed open/writeFile/sync/close/rename；io-history.test.ts | A；文件权限由可控故障模拟，不冒充 ACL 实测 |
| O01 | §2.1 | OO/封装/一类一文件 | src 全部类；Shape 多态 | 源码与 TypeScript AST/import DFS 审查 | 静态核对；自动测试不能独自证明设计质量 |
| O02 | §1.2、§2.1 | Command/Composite | Command；Executor；Shape/Group；Document | commands.test.ts；shapes.test.ts；command-history.test.ts | A + 源码审查；delete 由 Document 统一维护树 |
| O03 | §2.1 | 两处名称分派 | CommandDispatcher.#definitions；ShapeFactory.#definitions | 源码审查；依赖检查 | 固定 Map，保留为待重构点；effect/属性验证不是第三处类型分派 |
| O04 | §1.2 | 四模块/图/变化点/过程/自查/QA | doc/README.md；architecture.md | 文档/源码对照 | 初查发现旧模板待实现状态过时；本轮整理事实，保留人的字段 |
| D01 | §1.1 | 分步 git、远程、final | git log；main/origin/main | fetch/祖先检查 | PR01～06 已分步合并；final 尚未创建，由用户截止前确认，属于未完成交付步骤 |
| H01 | §4.3 未规定实现算法 | 完整快照、候选与单次提交 D1 | Executor/History/Session | command-atomicity.test.ts | H；空间/时间成本，非强制逆命令算法 |
| H02 | 普通组样式未细定 | D2 SVG 继承、不覆盖显式样式 | Shape.setAttribute；Group.toSvgNode | shapes.test.ts；svg-codec.test.ts | H；不套用 box 的传播语义 |
| H03 | 跨父新组落点未细定 | D3 LCA/DFS/最早分支之前 | Document.group | document.test.ts：D3 cross-parent grouping | H；未选节点相对绘制关系可能变化，undo 能还原，ungroup 不等于 undo |
| H04 | §3 默认路径 | D4 最近 read，save-as 不更新 | SaveCommand/InitCommand/ReadCommand | io-history.test.ts：D4 default save | H；已人工确认 |
| H05 | 外部 SVG 支持范围未穷举 | D5 子集、transform/非默认 viewBox 拒绝 | SvgParser；ShapeFactory | svg-codec.test.ts：parser rejects unsupported | H；非通用 SVG/CSS 引擎 |
| H06 | 尺寸/单位边界未穷举 | 缺根尺寸800×600、几何0、数值/px、零图形尺寸；画布正值 | ModelValue；SvgParser；ShapeFactory | shapes.test.ts：zero dimensions；svg-codec.test.ts：codec applies approved root dimension defaults | H；PR03/06 用户确认，不倒写为任务书原文 |
| H07 | HEX 全语法未细定 | create 可选 # 颜色仅3/4/6/8位 | ShapeFactory.create | factory.test.ts；cli-dispatcher.test.ts：invalid create hash colors | H；用户纠偏；不影响 text/ID，不扩展 set/导入颜色验证 |
| H08 | 并发/资源界限未细定 | 单 Executor 拒重叠；16MiB/100000节点/256层 | Executor.exclusive；SvgParser/SvgSerializer/FileStore | io-history.test.ts：pending；svg-codec.test.ts：parser bounds nesting/codec applies | H；初查 B：节点数阈值及 Serializer 深度缺针对性测试，计划补齐 |
| X01 | §4.4 阶段排除 | box/ShapeProvider 不实现 | ShapeFactory.definition | factory.test.ts：未知类型；cli-dispatcher.test.ts：invalid dispatch | 不属于本阶段；无插件框架、GUI 或额外命令 |

## 2. 初查缺口与验收计划

- 旧测试覆盖 clone 恢复失败，但缺 Undo/Redo 恢复 validate 失败的专项状态断言。
- 100000 节点阈值只有实现，缺越界/恰好边界测试；Serializer 深度边界亦缺针对性验证。
- 跨父 D3、整组收编、层级、历史、保存回读已有分层测试；补一个真实编译入口的连贯结构场景，以独立预期树核对每个落盘检查点。
- 课程报告仍有 PR01 模板的“Command 待实现”等现行章节，根 README 的 PR06 状态也过时；整理当前事实时保留历史与人工结论。
- 不为增加数量重写既有异常测试；先跑基线，再补以上缺口。未发现已复现的生产缺陷，不预先宣称已修复。

## 3. 实际验证结果

基线 `npm.cmd test`：242 pass / 0 fail / 0 skip。新增测试首轮 248 项中 247 pass / 1 fail，是新测试对 back 后 group 的位置预期错误，按 D3 修正为 `[both,b]`，未改生产实现；随后六项全部通过。加入示例可复现第七项后，最终 `npm.cmd test`：**249 pass / 0 fail / 0 skip / 0 cancelled**，包含源码构建及测试编译；`npm.cmd run typecheck` 退出码 0。

### 3.1 各文件计数及新增目标

| 分类 | 测试文件 | 项数 |
|---|---|---:|
| CLI 分发 | cli-dispatcher.test.ts | 17 |
| CLI REPL/入口 | cli-integration.test.ts | 13 |
| CLI + 实际文件 | cli-io.test.ts | 4 |
| 词法 | cli-parser.test.ts | 22 |
| 排版 | cli-renderer.test.ts | 6 |
| 命令失败原子性 | command-atomicity.test.ts | 15 |
| 历史 | command-history.test.ts | 10 |
| 具体命令 | commands.test.ts | 24 |
| 树模型 | document.test.ts | 13 |
| 工厂 | factory.test.ts | 19 |
| 文件与历史 | io-history.test.ts | 20 |
| PR07 综合验收 | phase1-acceptance.test.ts | 7 |
| 几何/Composite | shapes.test.ts | 15 |
| 启动 | smoke.test.ts | 1 |
| SVG 编解码 | svg-codec.test.ts | 52 |
| 文件存储 | svg-file-store.test.ts | 11 |
| 总计 | 16 个测试文件 | 249 |

前 15 个文件（除 PR07）和 PR07 六项版本分别通过独立文件运行，计数为 242+6；最终全量再次验证七项版本为 249。模块汇总：Model 47、Commands/History 49、CLI 58、IO/CLI-IO/IO-History 87、综合验收 7、启动 1。不要把这套分类与 E2E 数量重复相加。

计数口径：REPL/跨模块集成共 20 项（cli-integration 13 + cli-io 4 + PR07 子进程 3），其中含空输入及故障注入，不全部称为完整入口 E2E。实际文件参与的集成共 7 项，真正执行编译后 main 的业务端到端子进程为 5 项；另有 1 项启动 smoke。文件/编解码/故障注入不冒充入口 E2E。

新增文件 [phase1-acceptance.test.ts](../phase1-acceptance.test.ts) 的七个实际测试标题均以 `acceptance:` 开头：

1. `committed SVG example is reproducible through the real CLI`：在临时目录回放提交的脚本，比较交付 SVG 全树/索引语义，并核验独立坐标、颜色和中文预期。
2. `compiled CLI transforms every leaf, saves, reads and continues editing`：五种叶子逐个 show/move/scale/set，六类组合、保存回读、组移动与 Undo/Redo，按独立属性表核验前后坐标/尺寸/显式样式。
3. `compiled CLI D3, whole-group composition, order and subtree undo survive file checkpoints`：跨父逆序参数仍按原序、未选节点、组内递归一次、根级解组/祖孙/环错误、ungroup/addto/front/back、两个 Group 整体收编、删除整树的 Undo/Redo；两个文件检查点比较实际树和坐标。
4. `undo and redo validation failures preserve full state and allow retry`：恢复 clone 后 validate 故障，内容/索引/readPath/Undo/Redo/blocked 不变，解除注入后可重试。
5. `serialization and rename failures preserve session stacks, old file and cleanup`：实际 SaveCommand+Executor+FileStore 链路故障，比较五类会话状态、旧字节及目录无临时文件，并继续 Redo。
6. `codec accepts 100000 nodes and rejects 100001 nodes`：恰好阈值真实编解码及索引，超限输入/输出明确拒绝。
7. `codec accepts depth 256 and rejects output depth 257`：精确深度可往返，超限输出拒绝；原有测试继续验证超深输入。

初查 B 的资源阈值与恢复校验缺口现已补齐。F01～F21、S01～S06、I01～I05、IO01/IO03 具备实现和自动验证；O01～O04 结合静态审阅，不用测试计数替代架构判断。IO02 仅有 PR06 用户反馈，本轮新示例待人工浏览器检查。D01 的 final 标签/截止要求及最终签收尚未完成；X01 正确排除，H01～H08 保持人工决策，不视为新增课程强制需求。

### 3.2 工具与测试质量检查

- 实际执行 Node 原生覆盖率：`node --test --experimental-test-coverage --test-coverage-include="dist/**" --test-coverage-exclude="dist/tests/tests/**" dist/tests/tests/*.test.js`，由 spawnSync 检查退出码 0。编译 JS 汇总：行 95.65%、分支 90.67%、函数 91.43%。包括 dist 与 dist/tests/src 两套编译代码及子进程，未配置 TS source map 合并，不是 TS 源码精确覆盖或需求完整性的百分比。未引入依赖/阈值门禁。
- TypeScript AST/import DFS 核对 46 个源码文件、40 个类，一类一文件及类名匹配、本地路径可解析、无违规模块依赖、无循环；源码审阅确认两处名称 Map、无第三处按图形名分派。effect 策略、属性白名单、容器识别不混淆为名称分派。
- 行为测试包含实际对象、完整语义/索引比较与独立预期，而 Parser/Renderer 的字符串断言用于其直接输出契约。参数化负向用例部分只断言 error 前缀，再检查不变状态；并非每个错误原因都有精确文本断言。新增关键故障和结构错误使用精确消息。
- 单文件独立运行成功，未发现跨文件顺序依赖；mock 使用 t.mock 并在需要恢复后先检查 mock.restore。已有命令 gate 测试部分没有显式超时，不能宣称所有异步测试都有硬超时；新增子进程/重资源测试设置 timeout，输入有限，临时目录使用助手核验绝对清理路径并注册 t.after。
- 新测试不使用固定用户数据路径；旧失败 Store 的虚拟路径不写盘。交付示例测试读仓库示例，但只写独立临时目录；实际生成示例的操作是明确授权的交付步骤。原测试未删除、跳过或放宽。

### 3.3 示例、限制与最终交付

[examples/phase1.svg](../../examples/phase1.svg) 为真实 main 回放 [脚本](../../examples/phase1.cli) 生成，10 个图形/容器、753 字节。脚本首次校验误计 11 个，核对 create 数量后纠正为 10；重新运行生成、解析和继续编辑均退出码 0。继承样式、显式文字样式、端点/圆心、节点顺序和回读检查通过，临时续编文件已清理。复现方法见 [示例说明](../../examples/README.md)。

本轮无生产缺陷修复、无架构变化。当前基础 SVG 子集及 16 MiB/100000 节点/256 层限制不扩大；不支持 transform/非默认 viewBox、复杂 SVG/CSS；完整快照有大文档成本，DOM 建立后才计深度/节点，磁盘替换与 Session 不共享事务。未实测 Linux/macOS/网络盘、断电恢复、Windows ACL、性能基准；未运行 UML 渲染或独立 lint 工具。浏览器未启动；PR06 用户对 Edge 的反馈不自动覆盖此新示例。

复现文档实际发现并修正：Windows PowerShell 将 node -e 示例的内部引号剥离而报 SyntaxError，已改为 `@' ... '@ | node` 的 here-string 方式，并按文档原样回放成功，退出码0、正常生成10节点。任务书/生产逻辑未改变。35 个文档本地链接存在、UML 起止块配对；既有24条人工标记/已勾选行逐字保留，最终 diff/空白检查见课程报告 §4.13。

**【人工核对】[待核验]** 逐项抽查矩阵及新测试预期，打开新示例观察颜色继承、顺序和中文，按 README 读取后续编；结果记入课程报告 §4.13。功能与自动 QA 条件已具备，完整课程交付仍待个人签收、允许后的提交/远程合并及截止前 final 标签，不代为完成这些操作。
