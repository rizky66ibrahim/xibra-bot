// Daily check-in scheduler: 06.00 morning overview, 18.00 evening questions (WIB).
import { InlineKeyboard, type Bot } from "grammy";
import { bridgeSystem } from "../../core/bridge.js";
import { addDays, wibDate, wibHourMinute } from "../../core/time.js";
import { buildEveningMessage, buildMorningMessage, type CheckinPayload } from "./messages.js";

const SLOT_TIMES: Record<string, "morning" | "evening"> = {
  "06:00": "morning",
  "18:00": "evening",
};

const TICK_MS = 60_000;

// Each slot runs at most once per day, even if the process ticks several times in that minute
const done = new Set<string>();

export function startCheckinScheduler(bot: Bot): void {
  setInterval(() => {
    void runIfDue(bot);
  }, TICK_MS);
}

async function runIfDue(bot: Bot): Promise<void> {
  const slot = SLOT_TIMES[wibHourMinute()];
  if (!slot) return;

  const key = `${slot}:${wibDate(0)}`;
  if (done.has(key)) return;
  done.add(key);

  const res = await bridgeSystem<CheckinPayload[]>("GET", `/checkins/due?slot=${slot}`);
  if (!res.ok) return;

  for (const payload of res.data) {
    try {
      if (payload.slot === "morning") {
        await bot.api.sendMessage(payload.chat_id, buildMorningMessage(payload));
      } else {
        const message = buildEveningMessage(payload);
        if (!message) continue;

        const keyboard = message.showTomorrow
          ? new InlineKeyboard().text("📅 Lihat besok", `sch:${addDays(wibDate(0), 1)}`)
          : undefined;

        await bot.api.sendMessage(payload.chat_id, message.text, { reply_markup: keyboard });
      }
    } catch (err) {
      console.error(`Check-in ${slot} failed for chat ${payload.chat_id}:`, (err as Error).message);
    }
  }
}
