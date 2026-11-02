import type { Context } from "grammy";
import { bridge } from "../bridge.js";
import { formatDateId, parseFlexibleDate } from "../time.js";
import { startFlow } from "../wizard/engine.js";
import type { Flow } from "../wizard/types.js";

export interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  is_completed: boolean;
}
const PRIORITY_ICON: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

export async function showTodo(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<TaskItem[]>(userId, "GET", "/tasks");
  if (!res.ok) return void (await ctx.reply(res.message));

  if (res.data.length === 0) {
    await ctx.reply(
      "Tidak ada tugas yang belum selesai. Tambah dengan /addtodo.",
    );
    return;
  }

  const lines = res.data.map((task) => {
    const icon = PRIORITY_ICON[task.priority ?? ""] ?? "⚪";
    const due = task.due_date
      ? `  (tenggat ${formatDateId(task.due_date)})`
      : "";
    return `#${task.id}  ${icon} ${task.title}${due}`;
  });

  await ctx.reply(
    [
      "📝 Tugas belum selesai",
      "",
      ...lines,
      "",
      "Selesaikan dengan /done <id>.",
    ].join("\n"),
  );
}
export async function completeTask(
  ctx: Context,
  taskId: number,
): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<unknown>(
    userId,
    "POST",
    `/tasks/${taskId}/complete`,
  );

  if (res.ok) {
    await ctx.reply(`✅ Tugas #${taskId} selesai.`);
  } else if (res.reason === "not_found") {
    await ctx.reply("Tugas itu tidak ditemukan. Cek id-nya di /todo.");
  } else {
    await ctx.reply(res.message);
  }
}

// Wizard: judul, prioritas, lalu tenggat (boleh dilewati dengan "-")
export const addTaskFlow: Flow = {
  id: "addtask",
  steps: [
    {
      kind: "text",
      key: "title",
      prompt: "Apa judul tugasnya?",
      validate: (value) =>
        value.length === 0 || value.length > 255
          ? "Judul wajib diisi, maksimal 255 karakter."
          : null,
    },
    {
      kind: "choice",
      key: "priority",
      prompt: "Prioritasnya?",
      options: [
        { label: "🟢 Rendah", value: "low" },
        { label: "🟡 Sedang", value: "medium" },
        { label: "🔴 Tinggi", value: "high" },
      ],
    },
    {
      kind: "text",
      key: "due",
      prompt:
        "Tenggatnya? Contoh: 10-11-2026, 10 nov 2026, atau besok. Ketik - untuk melewati.",
      validate: (value) =>
        value === "-" || parseFlexibleDate(value)
          ? null
          : "Format tanggal tidak dikenali. Contoh: 10-11-2026 atau 10 nov 2026.",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const dueDate =
      answers.due && answers.due !== "-"
        ? (parseFlexibleDate(answers.due) ?? undefined)
        : undefined;

    const res = await bridge<TaskItem>(userId, "POST", "/tasks", {
      title: answers.title,
      priority: answers.priority,
      due_date: dueDate,
    });

    await ctx.reply(
      res.ok
        ? `✅ Tugas #${res.data.id} dibuat: ${res.data.title}`
        : res.message,
    );
  },
};

export function startAddTask(ctx: Context, title?: string): Promise<void> {
  return title
    ? startFlow(ctx, addTaskFlow, { title })
    : startFlow(ctx, addTaskFlow);
}
