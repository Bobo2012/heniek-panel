import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

const execFileAsync = promisify(execFile);

const containerName = process.env.PANEL_TARGET_CONTAINER || "hermes-agent";
const composePath = process.env.PANEL_COMPOSE_PATH || "/root/docker-compose.yml";
const composeService = process.env.PANEL_COMPOSE_SERVICE || "hermes";
const soulPath = process.env.PANEL_SOUL_PATH || "/opt/prod/hermes-agent/data/SOUL.md";
const logTailDefault = Number(process.env.PANEL_LOG_TAIL || 120);
const authToken = process.env.PANEL_AUTH_TOKEN || "";

export type PanelStatus = {
  status: "online" | "offline" | "degraded";
  containerName: string;
  composeService: string;
  containerState: string;
  running: boolean;
  uptime: string;
  composePath: string;
  composeFileExists: boolean;
  soulPath: string;
  soulFileExists: boolean;
  checkedAt: string;
  host: string;
  errors: string[];
  authConfigured: boolean;
};

async function run(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function getPanelConfig() {
  return {
    containerName,
    composePath,
    composeService,
    soulPath,
    logTailDefault,
    authConfigured: Boolean(authToken),
  };
}

export function isAuthorized(request: Request) {
  if (!authToken) return true;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = request.headers.get("x-panel-token");
  return bearer === authToken || headerToken === authToken;
}

export function unauthorizedResponse() {
  return Response.json(
    {
      message: "Unauthorized",
      authRequired: true,
    },
    { status: 401 }
  );
}

export async function getPanelStatus(): Promise<PanelStatus> {
  const errors: string[] = [];
  const composeFileExists = await pathExists(composePath);
  const soulFileExists = await pathExists(soulPath);

  let containerState = "not found";
  let uptime = "—";
  let running = false;
  let host = "unknown";

  try {
    host = (await run("hostname", [])).stdout || "unknown";
  } catch {
    errors.push("Could not read hostname");
  }

  try {
    const inspect = await run("docker", [
      "inspect",
      containerName,
      "--format",
      "{{json .State}}",
    ]);

    if (inspect.stdout) {
      const state = JSON.parse(inspect.stdout) as {
        Status?: string;
        Running?: boolean;
      };

      containerState = state.Status || "unknown";
      running = Boolean(state.Running);
    }
  } catch (error) {
    containerState = "not found";
    errors.push(error instanceof Error ? error.message : "Could not inspect container");
  }

  try {
    const uptimeOutput = await run("docker", [
      "ps",
      "--filter",
      `name=^/${containerName}$`,
      "--format",
      "{{.RunningFor}}",
    ]);
    uptime = uptimeOutput.stdout || "—";
  } catch {
    errors.push("Could not read uptime");
  }

  return {
    status: running ? "online" : errors.length > 0 ? "degraded" : "offline",
    containerName,
    composeService,
    containerState,
    running,
    uptime,
    composePath,
    composeFileExists,
    soulPath,
    soulFileExists,
    checkedAt: new Date().toISOString(),
    host,
    errors,
    authConfigured: Boolean(authToken),
  };
}

export async function getContainerLogs(tail = logTailDefault) {
  const safeTail = Number.isFinite(tail) ? Math.min(Math.max(tail, 20), 400) : logTailDefault;

  try {
    const result = await run("docker", ["logs", "--tail", String(safeTail), containerName]);
    return {
      logs: result.stdout || result.stderr || "No logs available.",
      tail: safeTail,
      containerName,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Docker logs are unavailable.";
    return {
      logs: `Docker logs unavailable: ${message}`,
      tail: safeTail,
      containerName,
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function restartPanel() {
  const composeFileExists = await pathExists(composePath);

  try {
    if (composeFileExists) {
      await run("docker", ["compose", "-f", composePath, "restart", composeService]);
      return {
        restarted: true,
        method: "docker-compose",
        message: `Restart command sent to service ${composeService}.`,
      };
    }

    await run("docker", ["restart", containerName]);
    return {
      restarted: true,
      method: "docker",
      message: `Restart command sent to container ${containerName}.`,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? `Restart failed: ${error.message}` : "Restart failed.");
  }
}

export async function readSoulFile() {
  const exists = await pathExists(soulPath);
  if (!exists) {
    return {
      content: "",
      exists: false,
      path: soulPath,
      message: "Soul file does not exist yet.",
    };
  }

  const content = await readFile(soulPath, "utf8");
  return {
    content,
    exists: true,
    path: soulPath,
    message: "Soul file loaded.",
  };
}

export async function saveSoulFile(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trimEnd() + "\n";
  const slashIndex = soulPath.lastIndexOf("/");
  const directory = slashIndex > 0 ? soulPath.slice(0, slashIndex) : ".";
  await mkdir(directory, { recursive: true });

  const tempPath = `${soulPath}.tmp`;
  await writeFile(tempPath, normalized, "utf8");
  await rename(tempPath, soulPath);

  return {
    saved: true,
    path: soulPath,
    bytes: Buffer.byteLength(normalized),
    savedAt: new Date().toISOString(),
  };
}
