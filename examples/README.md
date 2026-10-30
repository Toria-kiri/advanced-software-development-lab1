# Phase 1 可复现示例

`phase1.svg` 由真实编译入口回放 [phase1.cli](phase1.cli) 生成，包含六类图形、嵌套组、中文/XML 特殊字符、显式及继承样式和绘制顺序。line 必须设置 stroke 才可见；背景是第一个根节点，marker 在 scene 内最先绘制。

在仓库根目录执行 `npm.cmd run cli`，逐行粘贴脚本中的命令即可重新生成。`#` 注释须单独成行。也可在构建后用 Node 回放，避免 PowerShell 管道改变中文编码：

```powershell
npm.cmd run build
@'
const fs = require("node:fs"), cp = require("node:child_process");
const result = cp.spawnSync(process.execPath, ["dist/main.js"], {
  input: fs.readFileSync("examples/phase1.cli"),
  stdio: ["pipe", "inherit", "inherit"], timeout: 10000,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
'@ | node
```

保存命令会覆盖 `examples/phase1.svg`。普通自动测试在临时目录验证，不修改此交付文件。可以用 Edge/Chrome 打开它；PR07 尚未执行真实浏览器展示验收，XML/回读成功不等于视觉验收。

继续编辑时，在 CLI 输入：

```text
read examples/phase1.svg
show start
move right 0 40
undo
redo
save examples/phase1-edited.svg
```

最后一行生成单独的文件，需用户自行决定是否保留。核验：圆心位置随右侧组移动，组内文字同步移动；开始框继承蓝色，文字保留白色；椭圆继承蓝色，连线为深色。
