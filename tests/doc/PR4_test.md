# PR04 测试说明

以下按测试文件编号说明，共 **49 项新增测试**，由参数化用例展开计数。每项包含多个断言；完整测试集还保留 PR01/PR03 的 40 项，合计 89 项。

[commands.test.ts](../commands.test.ts)：24 项

| 编号 | 具体测试行为 |
|---|---|
| 1 | CreateCommand 创建 rect 到指定容器，返回正确图形类型、父 id 和成功数据；记录一个历史单元 |
| 2 | CreateCommand 创建 circle 到指定容器，返回正确类型和父 id；记录一个历史单元 |
| 3 | CreateCommand 创建 ellipse 到指定容器，返回正确类型和父 id；记录一个历史单元 |
| 4 | CreateCommand 创建 line 到指定容器，返回正确类型和父 id；记录一个历史单元 |
| 5 | CreateCommand 创建 text 到指定容器，返回正确类型和父 id；记录一个历史单元 |
| 6 | CreateCommand 创建 g 到指定容器，返回正确类型和父 id；记录一个历史单元 |
| 7 | create 省略父容器时挂在根；一次 Undo 删除新图形，一次 Redo 恢复完整编辑后状态 |
| 8 | delete 删除容器及全部子孙；一次 Undo 恢复完整子树、属性和顺序，Redo 再次删除 |
| 9 | move 对容器内后代正确平移；一次 Undo/Redo 精确恢复前后完整文档 |
| 10 | scale 同步缩放后代位置和尺寸；一次 Undo/Redo 精确恢复前后完整文档 |
| 11 | set 修改 fill；一次 Undo 恢复原属性状态，Redo 恢复设置后的状态 |
| 12 | group 遵循 D3：最深公共祖先、原绘制顺序和规定的新组落点；一次 Undo/Redo 恢复完整层级 |
| 13 | ungroup 将嵌套组孩子提升到组所在位置；一次 Undo 恢复原组及顺序，Redo 再解组 |
| 14 | addto 把图形追加到目标容器末尾并从原父移除；一次 Undo/Redo 恢复完整父子关系 |
| 15 | front 移到同级序列末尾；一次 Undo/Redo 恢复前后顺序 |
| 16 | back 移到同级序列开头；一次 Undo/Redo 恢复前后顺序 |
| 17 | init 使用默认或自定义尺寸，替换为空文档、清除读入路径，清空并封锁历史 |
| 18 | 无文档时，编辑、canvas/tree/show/help、Undo/Redo 均报规定错误且会话不变；随后 init 可正常初始化 |
| 19 | tree/show 返回全文档或子树、几何属性、原始文字、父 id 和兄弟位置；不改变文档或历史，结果集合不可修改 |
| 20 | help 完整返回调用方传入的语法说明；构造后修改原数组不影响命令，返回集合不可修改，历史保持 |
| 21 | canvas 无参数为 query，不改历史；修改尺寸为 boundary，清空并封锁历史但保留读入路径 |
| 22 | CreateCommand 和 GroupCommand 复制参数数组，调用方后续修改数组不会改变已构造命令的意图 |
| 23 | Session 克隆注入文档，公开文档副本不能修改活状态；拒绝第二个 Executor 和无文档的读入路径 |
| 24 | 重复 id、未知类型、非法尺寸/属性/目标/结构、无效查询、失败 init/canvas 等均保持文档、路径和 Redo；之后仍能 Redo |

第 7～16 项共同检查：一条编辑只有一个历史单元；Undo 恢复完整编辑前中立节点，Redo 恢复完整编辑后中立节点；文档通过 validate，读入路径不变。

[command-history.test.ts](../command-history.test.ts)：10 项

| 编号 | 具体测试行为 |
|---|---|
| 25 | 连续移动、缩放、设置样式后逐步 Undo/Redo，每步与完整快照一致；避免浮点逆算误差，并恢复原本未设置的样式 |
| 26 | Undo 后执行新编辑清空 Redo；成功但数值无变化的编辑仍记录一个历史单元 |
| 27 | canvas 查询、tree、show、help 不新增历史，也不清除待 Redo 的记录 |
| 28 | init 成功后阻止两个方向的历史操作；查询和失败编辑不解除封锁，成功编辑解除封锁且不能 Undo 穿越边界 |
| 29 | canvas 修改成功后具有相同的历史边界规则；随后编辑可撤销到修改画布后的基点 |
| 30 | blocked 基点上的失败 init/canvas 不改变文档、路径、两栈或封锁状态 |
| 31 | 空历史分别报 nothing to undo/redo，与 IO-blocked 错误区分，历史数量不变 |
| 32 | History 的 before/after 与输入文档相互独立；修改恢复副本不污染历史；准备转移不修改原 History |
| 33 | Undo 后复用同一命令对象会按当前 id 重新查找，而不使用已过期的 Shape 引用 |
| 34 | 修改 Session 返回的文档副本不影响活文档、画布或后续 Undo/Redo |

[command-atomicity.test.ts](../command-atomicity.test.ts)：15 项

| 编号 | 具体测试行为 |
|---|---|
| 35 | 命令修改部分草稿、异步等待后抛错，活文档、路径和 Redo 保持；错误统一为单行 error:，之后仍能 Redo |
| 36 | 候选文档 validate 抛错时，不提交文档或历史 |
| 37 | 第 1 次克隆（创建候选）失败时，文档及历史不变，原 Redo 仍可使用 |
| 38 | 第 2 次克隆（准备提交文档）失败时，文档及历史不变，原 Redo 仍可使用 |
| 39 | 第 3 次克隆（准备 before 快照）失败时，文档及历史不变，原 Redo 仍可使用 |
| 40 | 第 4 次克隆（准备 after 快照）失败时，文档及历史不变，原 Redo 仍可使用 |
| 41 | History.record 已完成局部准备后抛错，也不能部分提交会话或历史 |
| 42 | boundary 的历史准备失败时，不能替换文档或清除原读入路径 |
| 43 | 编辑草稿后，结果数据因包含不可克隆值而准备失败，活状态仍保持 |
| 44 | Undo 和 Redo 恢复目标时克隆失败，两栈位置和当前文档均保持；恢复正常后仍可继续 |
| 45 | 命令保留草稿引用并在成功后修改它，不能污染已提交文档或历史；结果保留传入警告 |
| 46 | 自定义 query 即使替换自身草稿文档和路径，也不会修改 Session 或历史 |
| 47 | edit 尝试通过 Context 改变读入路径会被拒绝，文档与历史保持 |
| 48 | 慢命令未完成时，重叠 edit/query/Undo/Redo 均报 busy；活状态在提交前保持，逐次 await 的后续编辑不会互相覆盖 |
| 49 | 不同 Session 可并行执行；异步失败会释放其 Executor，之后正常命令仍可执行 |

失败原子性辅助检查比较实际文档的中立节点、节点数量、父 id、兄弟位置、读入路径、Undo/Redo 数量及 blocked，并调用 validate。故障通过测试 Command 和 Node test mock 注入，没有在生产代码中加入失败开关。

测试边界：这里只验证 TypeScript 命令 API、完整快照历史和会话隔离；不包含终端 REPL、字符串解析/排版、实际 SVG 文件读写或浏览器渲染。ReadCommand/SaveCommand 尚未实现，SvgStore 仅为接口契约。

运行全部测试（包含构建和测试编译）：

```powershell
npm.cmd test
```

完成构建和测试编译后，单独运行 PR04 专项：

```powershell
node --test dist/tests/tests/commands.test.js dist/tests/tests/command-history.test.js dist/tests/tests/command-atomicity.test.js
```
