import { InlineKeyboard, type Context } from 'grammy'
import { clearSession, getSession, saveSession } from './state.js'
import type { Answers, Flow, Step } from './types.js'

const flows = new Map<string, Flow>()

export function registerFlow(flow: Flow): void {
  flows.set(flow.id, flow)
}

export function getFlow(id: string): Flow | undefined {
  return flows.get(id)
}

// Telegram bisa menolak edit/alert (pesan sudah lama, dll). Kegagalan itu tidak boleh menghentikan alur.
async function tryCall(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch {
    // diabaikan
  }
}

const CALLBACK_PATTERN = /^w:([a-z0-9]+):(\d+):(.+)$/

async function askStep(ctx: Context, flow: Flow, index: number): Promise<void> {
  const step: Step = flow.steps[index]

  if (step.kind === 'choice') {
    const keyboard = new InlineKeyboard()
    step.options.forEach((option, i) => {
      keyboard.text(option.label, `w:${flow.id}:${index}:${option.value}`)
      if (i % 2 === 1) keyboard.row()
    })
    keyboard.row().text('✖ Batal', `w:${flow.id}:${index}:cancel`)
    await ctx.reply(step.prompt, { reply_markup: keyboard })
    return
  }

  await ctx.reply(`${step.prompt}\n\nKetik jawaban Anda, atau /batal untuk membatalkan.`)
}

// Langkah yang nilainya sudah ada (misalnya dari argumen perintah) dilewati
export async function startFlow(ctx: Context, flow: Flow, initial: Answers = {}): Promise<void> {
  const userId = ctx.from?.id
  if (userId === undefined) return

  let index = 0
  while (index < flow.steps.length && initial[flow.steps[index].key] !== undefined) {
    index++
  }

  if (index >= flow.steps.length) {
    clearSession(userId)
    await flow.finish(ctx, initial)
    return
  }

  saveSession(userId, { flowId: flow.id, index, answers: { ...initial } })
  await askStep(ctx, flow, index)
}

// Melanjutkan sesi setelah jawaban diterima. Mengembalikan true jika sudah ditangani.
async function advance(ctx: Context, flow: Flow, userId: number, answers: Answers, index: number): Promise<void> {
  const next = index + 1
  if (next >= flow.steps.length) {
    clearSession(userId)
    await flow.finish(ctx, answers)
    return
  }
  saveSession(userId, { flowId: flow.id, index: next, answers })
  await askStep(ctx, flow, next)
}

export async function handleCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data
  const userId = ctx.from?.id
  if (!data || userId === undefined) return false

  const match = CALLBACK_PATTERN.exec(data)
  if (!match) return false

  const [, flowId, indexRaw, value] = match
  const session = getSession(userId)

  if (value === 'cancel') {
    clearSession(userId)
    await tryCall(() => ctx.answerCallbackQuery({ text: 'Dibatalkan' }))
    await tryCall(() => ctx.editMessageText('Dibatalkan.'))
    return true
  }

  const flow = getFlow(flowId)
  if (!session || !flow || session.flowId !== flowId || session.index !== Number(indexRaw)) {
    await tryCall(() => ctx.answerCallbackQuery({ text: 'Sesi sudah berakhir. Ulangi perintahnya.' }))
    return true
  }

  const step = flow.steps[session.index]
  if (step.kind !== 'choice' || !step.options.some((o) => o.value === value)) {
    await tryCall(() => ctx.answerCallbackQuery({ text: 'Pilihan tidak valid.' }))
    return true
  }

  await tryCall(() => ctx.answerCallbackQuery())

  const label = step.options.find((o) => o.value === value)?.label ?? value
  await tryCall(() => ctx.editMessageText(`${step.prompt}\n✓ ${label}`))

  const answers = { ...session.answers, [step.key]: value }
  await advance(ctx, flow, userId, answers, session.index)
  return true
}

export async function handleText(ctx: Context): Promise<boolean> {
  const text = ctx.message?.text
  const userId = ctx.from?.id
  if (text === undefined || userId === undefined) return false

  const session = getSession(userId)
  if (!session) return false

  const flow = getFlow(session.flowId)
  const step = flow?.steps[session.index]
  if (!flow || !step || step.kind !== 'text') return false

  const error = step.validate?.(text.trim()) ?? null
  if (error) {
    await ctx.reply(`${error}\n\n${step.prompt}`)
    return true
  }

  const answers = { ...session.answers, [step.key]: text.trim() }
  await advance(ctx, flow, userId, answers, session.index)
  return true
}
