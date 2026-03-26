import { type LanguageModel } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import * as dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env') })

const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
const modelName = process.env.LLM_MODEL || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o')

export function getModel(): LanguageModel {
  if (provider === 'anthropic') {
    return anthropic(modelName)
  }
  return openai(modelName)
}

export function getModelName(): string {
  return modelName
}

export function getProvider(): string {
  return provider
}
