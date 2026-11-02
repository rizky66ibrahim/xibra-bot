import type { Context } from 'grammy'

export type Answers = Record<string, string>

export interface Option {
  label: string
  value: string
}

export interface ChoiceStep {
  kind: 'choice'
  key: string
  prompt: string
  options: Option[]
}

export interface TextStep {
  kind: 'text'
  key: string
  prompt: string
  // Mengembalikan pesan error jika input tidak valid, atau null jika valid
  validate?: (input: string) => string | null
}

export type Step = ChoiceStep | TextStep

export interface Flow {
  // Id pendek, dipakai di callback_data. Hanya huruf kecil dan angka.
  id: string
  steps: Step[]
  finish: (ctx: Context, answers: Answers) => Promise<void>
}
