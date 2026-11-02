import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from 'grammy'
import { getFlow, handleCallback, handleText, registerFlow, startFlow } from './engine.js'
import { clearSession, getSession } from './state.js'
import type { Flow } from './types.js'

// Context palsu yang hanya mencatat pesan yang dikirim
function fakeCtx(userId: number, extra: Record<string, unknown> = {}) {
  const sent: string[] = []
  const ctx = {
    from: { id: userId },
    reply: async (text: string) => {
      sent.push(text)
      return {}
    },
    answerCallbackQuery: async () => true,
    ...extra
  }
  return { ctx: ctx as unknown as Context, sent }
}

const finished: Array<Record<string, string>> = []

const flow: Flow = {
  id: 'testflow',
  steps: [
    {
      kind: 'choice',
      key: 'color',
      prompt: 'Warna?',
      options: [
        { label: 'Merah', value: 'red' },
        { label: 'Biru', value: 'blue' }
      ]
    },
    {
      kind: 'text',
      key: 'name',
      prompt: 'Nama?',
      validate: (v) => (v.length < 2 ? 'Terlalu pendek.' : null)
    }
  ],
  finish: async (_ctx, answers) => {
    finished.push(answers)
  }
}

test('choice then text completes the flow and clears the session', async () => {
  registerFlow(flow)
  assert.equal(getFlow('testflow'), flow)

  const { ctx, sent } = fakeCtx(101)
  await startFlow(ctx, flow)
  assert.equal(sent.length, 1)
  assert.equal(getSession(101)?.index, 0)

  const cb = fakeCtx(101, { callbackQuery: { data: 'w:testflow:0:blue' } })
  assert.equal(await handleCallback(cb.ctx), true)
  assert.equal(getSession(101)?.index, 1)

  const short = fakeCtx(101, { message: { text: 'A' } })
  assert.equal(await handleText(short.ctx), true)
  assert.equal(short.sent[0].startsWith('Terlalu pendek.'), true)
  assert.equal(getSession(101)?.index, 1)

  const ok = fakeCtx(101, { message: { text: 'Budi' } })
  assert.equal(await handleText(ok.ctx), true)
  assert.equal(getSession(101), undefined)
  assert.deepEqual(finished.at(-1), { color: 'blue', name: 'Budi' })
  clearSession(101)
})

test('prefilled answers skip their step', async () => {
  const { ctx, sent } = fakeCtx(202)
  await startFlow(ctx, flow, { color: 'red' })
  assert.equal(getSession(202)?.index, 1)
  assert.equal(sent[0], 'Nama?\n\nKetik jawaban Anda, atau /batal untuk membatalkan.')
  clearSession(202)
})

test('callback from another flow or stale index is rejected', async () => {
  const { ctx } = fakeCtx(303)
  await startFlow(ctx, flow)

  const stale = fakeCtx(303, { callbackQuery: { data: 'w:testflow:1:Budi' } })
  assert.equal(await handleCallback(stale.ctx), true)
  assert.equal(getSession(303)?.index, 0)
  clearSession(303)
})

test('cancel clears the session', async () => {
  const { ctx } = fakeCtx(404)
  await startFlow(ctx, flow)
  const cancel = fakeCtx(404, {
    callbackQuery: { data: 'w:testflow:0:cancel' },
    editMessageText: async () => true
  })
  await handleCallback(cancel.ctx)
  assert.equal(getSession(404), undefined)
})
