// Prevents two bot processes from polling the same Telegram token.
// Two processes split the updates and break wizards, because each keeps its own session.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCK_FILE = resolve(process.cwd(), ".bot.lock");

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireSingleInstance(): void {
  if (existsSync(LOCK_FILE)) {
    const pid = Number(readFileSync(LOCK_FILE, "utf8"));
    if (pid && pid !== process.pid && isAlive(pid)) {
      console.error(`Another Xibra Bot is already running (PID ${pid}). Stop it first, then start again.`);
      process.exit(1);
    }
  }

  writeFileSync(LOCK_FILE, String(process.pid));
  process.once("exit", () => {
    try {
      if (existsSync(LOCK_FILE) && readFileSync(LOCK_FILE, "utf8") === String(process.pid)) {
        unlinkSync(LOCK_FILE);
      }
    } catch {
      // ignored: the lock is stale at worst, and the next start replaces it
    }
  });
}
