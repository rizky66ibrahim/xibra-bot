// Background sender: every minute, delivers reminders whose time has come.
import type { Bot } from "grammy";
import { bridgeSystem } from "../../core/bridge.js";
import { ICON } from "../../core/ui.js";
import { formatDateTime } from "../../core/time.js";

interface DueReminder {
  id: number;
  title: string;
  reminder_at: string;
  chat_id: number;
}

const POLL_MS = 60_000;
const MAX_ATTEMPTS = 3;

// Failed sends per reminder. Lives in memory, so a restart resets the count.
const attempts = new Map<number, number>();
let running = false;

export function startReminderNotifier(bot: Bot): void {
  const tick = async (): Promise<void> => {
    if (running) return; // never overlap two runs
    running = true;
    try {
      await deliverDue(bot);
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => void tick(), POLL_MS);
}

async function deliverDue(bot: Bot): Promise<void> {
  const res = await bridgeSystem<DueReminder[]>("GET", "/reminders/due");
  if (!res.ok) return;

  for (const reminder of res.data) {
    const text = `${ICON.reminder} Pengingat: ${reminder.title}\n${formatDateTime(reminder.reminder_at)}`;

    try {
      // In a private chat, the chat id equals the user id
      await bot.api.sendMessage(reminder.chat_id, text);
      await report(reminder.id, "sent");
      attempts.delete(reminder.id);
    } catch (err) {
      const count = (attempts.get(reminder.id) ?? 0) + 1;
      attempts.set(reminder.id, count);
      console.error(
        `Reminder ${reminder.id} send failed (attempt ${count}):`,
        (err as Error).message,
      );

      if (count >= MAX_ATTEMPTS) {
        await report(reminder.id, "failed");
        attempts.delete(reminder.id);
      }
    }
  }
}

async function report(id: number, status: "sent" | "failed"): Promise<void> {
  await bridgeSystem("POST", `/reminders/${id}/sent`, { status });
}
