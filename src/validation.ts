import { spawn, spawnSync } from "node:child_process";
import type { ValidationResult } from "./types.js";

export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
/** Keep at most this much output per command. The end is kept: failures are usually printed last. */
export const MAX_OUTPUT_CHARS = 20_000;

export type ValidationOptions = {
  timeoutMs?: number;
};

/** Stops the command and everything it started (for example npm -> node -> test workers). */
function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL"); // negative pid = the whole process group
    }
  } catch {
    // Already exited.
  }
}

/**
 * Runs one validation command. Never rejects: a failing, crashing or
 * timed-out command is reported as a "failed" result, so the review is
 * still produced.
 */
export function runValidation(
  command: string,
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    let output = "";
    let droppedChars = 0;
    let timedOut = false;
    let settled = false;

    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      // On POSIX, give the command its own process group so a timeout can stop all of it.
      detached: process.platform !== "win32",
    });

    const append = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > MAX_OUTPUT_CHARS) {
        droppedChars += output.length - MAX_OUTPUT_CHARS;
        output = output.slice(-MAX_OUTPUT_CHARS);
      }
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, timeoutMs);

    const finish = (exitCode: number | null, note?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const parts: string[] = [];
      if (droppedChars > 0) parts.push(`[inspector] ${droppedChars} earlier characters of output were truncated.`);
      if (output.trimEnd()) parts.push(output.trimEnd());
      if (timedOut) parts.push(`[inspector] Command timed out after ${timeoutMs} ms and was stopped.`);
      if (note) parts.push(note);
      resolve({
        command,
        status: exitCode === 0 && !timedOut ? "passed" : "failed",
        output: parts.join("\n"),
        exitCode: timedOut ? null : exitCode,
        timedOut,
      });
    };

    child.on("error", (error) => finish(null, `[inspector] Command could not run: ${error.message}`));
    child.on("close", (code) => finish(code));
  });
}

export async function runValidations(
  commands: string[],
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd, options));
  }
  return results;
}
