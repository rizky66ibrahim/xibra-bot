// Tasks: list with one-tap done, edit, delete, and the add-task wizard.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { shorten } from "../../core/text.js";
import {
  ICON,
  PRIORITY_ICON,
  captured,
  confirmKeyboard,
  dayOptions,
  resolveDay,
  showOrEdit,
  viewAndHome,
  withFooter,
} from "../../core/ui.js";
import { formatDateId } from "../../core/time.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";

export interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  is_completed: boolean;
}

const MAX_BUTTONS = 8;

const PRIORITY_OPTIONS = [
  { label: "🟢 Rendah", value: "low" },
  { label: "🟡 Sedang", value: "medium" },
  { label: "🔴 Tinggi", value: "high" },
];

const validTitle = (v: string): string | null =>
  v.length === 0 || v.length > 255 ? "Judul wajib diisi, maksimal 255 karakter." : null;

function renderTasks(tasks: TaskItem[]): string {
  if (tasks.length === 0) return `${ICON.task} Tidak ada tugas yang belum selesai.`;

  const lines = tasks.map((task) => {
    const icon = PRIORITY_ICON[task.priority ?? ""] ?? "⚪";
    const due = task.due_date ? `  (tenggat ${formatDateId(task.due_date)})` : "";
    return `#${task.id} ${icon} ${task.title}${due}`;
  });

  return [`${ICON.task} Tugas belum selesai`, "", ...lines].join("\n");
}

// Open tasks, with a done button per task and the manage buttons underneath
export async function showTasks(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<TaskItem[]>(userId, "GET", "/tasks");
  if (!res.ok) return void (await showOrEdit(ctx, res.message));

  const keyboard = new InlineKeyboard();

  res.data.slice(0, MAX_BUTTONS).forEach((task, i) => {
    keyboard.text(`✓ #${task.id}`, `task:done:${task.id}`);
    if (i % 4 === 3) keyboard.row();
  });

  if (res.data.length > 0) {
    keyboard.row().text("✏️ Ubah", "task:pick:edit").text("🗑 Hapus", "task:pick:del");
  }
  keyboard.row().text(`${ICON.add} Tambah tugas`, "add:open");

  await showOrEdit(ctx, renderTasks(res.data), withFooter(keyboard, "task:list"));
}

// "Which task?" screen for editing or deleting
async function pickTask(ctx: Context, mode: "edit" | "del"): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<TaskItem[]>(userId, "GET", "/tasks");
  if (!res.ok) return void (await showOrEdit(ctx, res.message));
  if (res.data.length === 0) return showTasks(ctx);

  const keyboard = new InlineKeyboard();
  for (const task of res.data.slice(0, 12)) {
    keyboard.text(`#${task.id} ${shorten(task.title, 34)}`, `task:${mode}:${task.id}`).row();
  }
  keyboard.text("◀ Kembali", "task:list");

  const verb = mode === "edit" ? "diubah" : "dihapus";
  await showOrEdit(ctx, `Pilih tugas yang ingin ${verb}:`, keyboard);
}

async function confirmDelete(ctx: Context, id: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<TaskItem[]>(userId, "GET", "/tasks");
  const task = res.ok ? res.data.find((t) => String(t.id) === id) : undefined;
  if (!task) return showTasks(ctx);

  await showOrEdit(
    ctx,
    `Hapus tugas #${task.id}?\n"${task.title}"\n\nPengingat tenggatnya ikut terhapus.`,
    confirmKeyboard(`task:delyes:${task.id}`, "task:list"),
  );
}

export const addTaskFlow: Flow = {
  id: "addtask",
  steps: [
    { kind: "text", key: "title", prompt: "Apa judul tugasnya?", validate: validTitle },
    { kind: "choice", key: "priority", prompt: "Prioritasnya?", options: PRIORITY_OPTIONS },
    {
      kind: "choice",
      key: "dayChoice",
      prompt: "Tenggatnya kapan?",
      options: [{ label: "Tidak ada", value: "none" }, ...dayOptions()],
    },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal tenggatnya? Contoh: 10-11-2026 atau 10 nov.",
      validate: (v) => (resolveDay({ dayChoice: "custom", customDate: v }) ? null : "Tanggal tidak dikenali."),
      skipIf: (a) => a.dayChoice !== "custom",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const due = answers.dayChoice === "none" ? undefined : resolveDay(answers) ?? undefined;

    const res = await bridge<TaskItem>(userId, "POST", "/tasks", {
      title: answers.title,
      priority: answers.priority,
      due_date: due,
    });

    if (!res.ok) return void (await ctx.reply(res.message));
    await ctx.reply(`${ICON.task} Tugas #${res.data.id} dibuat: ${res.data.title}`, {
      reply_markup: viewAndHome(`${ICON.task} Lihat tugas`, "task:list"),
    });
  },
};

// Edit wizard. The task id arrives as a prefilled answer ("id"), so one flow serves every task.
export const editTaskFlow: Flow = {
  id: "edittask",
  steps: [
    {
      kind: "choice",
      key: "field",
      prompt: "Apa yang ingin diubah?",
      options: [
        { label: "✏️ Judul", value: "title" },
        { label: "🚦 Prioritas", value: "priority" },
        { label: "📅 Tenggat", value: "due" },
      ],
    },
    { kind: "text", key: "title", prompt: "Judul barunya?", validate: validTitle, skipIf: (a) => a.field !== "title" },
    {
      kind: "choice",
      key: "priority",
      prompt: "Prioritas barunya?",
      options: PRIORITY_OPTIONS,
      skipIf: (a) => a.field !== "priority",
    },
    {
      kind: "choice",
      key: "dayChoice",
      prompt: "Tenggat barunya?",
      options: [{ label: "Tidak ada", value: "none" }, ...dayOptions()],
      skipIf: (a) => a.field !== "due",
    },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal tenggatnya? Contoh: 10-11-2026 atau 10 nov.",
      validate: (v) => (resolveDay({ dayChoice: "custom", customDate: v }) ? null : "Tanggal tidak dikenali."),
      skipIf: (a) => a.field !== "due" || a.dayChoice !== "custom",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined || !answers.id) return;

    let body: Record<string, unknown>;
    if (answers.field === "title") {
      body = { title: answers.title };
    } else if (answers.field === "priority") {
      body = { priority: answers.priority };
    } else {
      const due = answers.dayChoice === "none" ? null : resolveDay(answers);
      if (due === null && answers.dayChoice !== "none") {
        return void (await ctx.reply("Tanggal tidak valid. Coba lagi dari daftar tugas."));
      }
      body = { due_date: due };
    }

    const res = await bridge<TaskItem>(userId, "PUT", `/tasks/${answers.id}`, body);
    if (!res.ok) return void (await ctx.reply(res.message));

    await ctx.reply(`✏️ Tugas #${res.data.id} diperbarui: ${res.data.title}`, {
      reply_markup: viewAndHome(`${ICON.task} Lihat tugas`, "task:list"),
    });
  },
};

export function registerTasks(bot: Bot): void {
  registerFlow(addTaskFlow);
  registerFlow(editTaskFlow);

  bot.command("task", (ctx) => showTasks(ctx));

  bot.callbackQuery("task:list", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showTasks(ctx);
  });

  bot.callbackQuery(/^task:done:(\d+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const res = await bridge<unknown>(userId, "POST", `/tasks/${captured(ctx)}/complete`);
    await ctx.answerCallbackQuery({ text: res.ok ? "Tugas selesai" : res.message }).catch(() => undefined);
    if (res.ok) await showTasks(ctx);
  });

  bot.callbackQuery(/^task:pick:(edit|del)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return pickTask(ctx, captured(ctx) === "edit" ? "edit" : "del");
  });

  bot.callbackQuery(/^task:edit:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startFlow(ctx, editTaskFlow, { id: captured(ctx) });
  });

  bot.callbackQuery(/^task:del:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return confirmDelete(ctx, captured(ctx));
  });

  bot.callbackQuery(/^task:delyes:(\d+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const res = await bridge<unknown>(userId, "DELETE", `/tasks/${captured(ctx)}`);
    await ctx.answerCallbackQuery({ text: res.ok ? "Tugas dihapus" : res.message }).catch(() => undefined);
    await showTasks(ctx);
  });

  bot.command("done", async (ctx) => {
    const id = Number((ctx.match ?? "").toString().trim());
    const userId = ctx.from?.id;
    if (!Number.isInteger(id) || id <= 0 || userId === undefined) {
      return ctx.reply("Format: /done <id>. Lihat id tugas di /task.");
    }
    const res = await bridge<unknown>(userId, "POST", `/tasks/${id}/complete`);
    await ctx.reply(res.ok ? `${ICON.task} Tugas #${id} selesai.` : res.message);
  });
}

export function startAddTask(ctx: Context): Promise<void> {
  return startFlow(ctx, addTaskFlow);
}
