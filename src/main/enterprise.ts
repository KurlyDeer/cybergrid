import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import { stat } from "node:fs/promises";
import type {
  ConnectionTaskRecord,
  ExternalToolRecord,
  ExternalToolRunResult,
  SessionVariableContext,
} from "../shared/ipc";

const MAX_CAPTURE_BYTES = 64 * 1024;

function expandValue(value: string, context: SessionVariableContext): string {
  const variables: Record<string, string> = {
    HOST: context.host,
    IP: context.ip,
    PORT: String(context.port),
    USER: context.username,
    USERNAME: context.username,
  };
  const expanded = value.replace(
    /\$(?:\{(HOST|IP|PORT|USER|USERNAME)\}|(HOST|IP|PORT|USER|USERNAME))(?![A-Z0-9_])/g,
    (_token, braced: string | undefined, plain: string | undefined) => variables[braced ?? plain ?? ""] ?? "",
  );
  if (expanded.includes("\0") || /[\r\n]/.test(expanded) || expanded.length > 8_192) {
    throw new Error("Expanded external process argument is invalid.");
  }
  return expanded;
}

async function validateExecutable(executablePath: string): Promise<void> {
  if (!executablePath || executablePath.length > 2_048 || /[\r\n\0]/.test(executablePath)) {
    throw new Error("External executable path is invalid.");
  }
  if (isAbsolute(executablePath)) {
    const info = await stat(executablePath).catch(() => undefined);
    if (!info?.isFile()) throw new Error(`External executable was not found: ${executablePath}`);
  } else if (!/^[a-z0-9_.+-]+(?:\.exe)?$/i.test(executablePath)) {
    throw new Error("Executable names resolved through PATH may contain only letters, numbers, dots, underscores, plus, and hyphens.");
  }
}

export async function launchExternalTool(
  tool: ExternalToolRecord,
  context: SessionVariableContext,
): Promise<ExternalToolRunResult> {
  await validateExecutable(tool.executablePath);
  const args = tool.arguments.map((argument) => expandValue(argument, context));
  const child = spawn(tool.executablePath, args, {
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: false,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
  return {
    launched: true,
    toolName: tool.name,
    commandPreview: [tool.executablePath, ...args].map((part) => JSON.stringify(part)).join(" "),
  };
}

async function runWaitedTask(
  task: ConnectionTaskRecord,
  args: string[],
  context: SessionVariableContext,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(task.executablePath, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CYBERGRID_HOST: context.host,
        CYBERGRID_IP: context.ip,
        CYBERGRID_PORT: String(context.port),
        CYBERGRID_USER: context.username,
      },
    });
    let output = "";
    const capture = (chunk: Buffer): void => {
      if (output.length < MAX_CAPTURE_BYTES) output += chunk.toString("utf8").slice(0, MAX_CAPTURE_BYTES - output.length);
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Task ${task.name} timed out after ${task.timeoutSeconds} seconds.`));
    }, task.timeoutSeconds * 1_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Task ${task.name} failed (${signal ?? `exit ${code ?? "unknown"}`}): ${output.trim() || "no output"}`));
    });
  });
}

export async function runConnectionTasks(
  tasks: ConnectionTaskRecord[],
  context: SessionVariableContext,
): Promise<void> {
  for (const task of tasks) {
    await validateExecutable(task.executablePath);
    const args = task.arguments.map((argument) => expandValue(argument, context));
    if (task.waitForExit) {
      await runWaitedTask(task, args, context);
      continue;
    }
    const child = spawn(task.executablePath, args, {
      detached: true,
      shell: false,
      stdio: "ignore",
      windowsHide: task.kind !== "vpn",
    });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
  }
}
