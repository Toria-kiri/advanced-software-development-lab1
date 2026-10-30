import { CliRepl } from "./cli/CliRepl";
import { CliRenderer } from "./cli/CliRenderer";
import { CommandDispatcher } from "./cli/CommandDispatcher";
import { CommandParser } from "./cli/CommandParser";
import { CommandExecutor } from "./commands/CommandExecutor";
import { EditorSession } from "./commands/EditorSession";
import { SvgFileStore } from "./io/SvgFileStore";

const renderer = new CliRenderer();
const session = new EditorSession();
const executor = new CommandExecutor(session);
const repl = new CliRepl(executor, new CommandParser(), new CommandDispatcher(new SvgFileStore()), renderer);

console.log("SVG Editor CLI started!");
void repl.run(process.stdin, process.stdout, process.stderr).catch(error => {
  process.stderr.write(`${renderer.error(error)}\n`);
  process.exitCode = 1;
});
