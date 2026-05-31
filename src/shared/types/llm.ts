export interface LLMConfiguration {
  id: string
  name: string
  provider: LLMProvider
  apiKey: string
  baseUrl: string | null
  modelName: string
  maxTokens: number
  temperature: number
  enableThinking: boolean
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'google' | 'custom'

export interface CreateLLMConfigInput {
  name: string
  provider: LLMProvider
  apiKey: string
  baseUrl?: string | null
  modelName: string
  maxTokens?: number
  temperature?: number
  enableThinking?: boolean
  isDefault?: boolean
}

export interface UpdateLLMConfigInput {
  name?: string
  provider?: LLMProvider
  apiKey?: string
  baseUrl?: string | null
  modelName?: string
  maxTokens?: number
  temperature?: number
  enableThinking?: boolean
  isDefault?: boolean
  isActive?: boolean
}

export interface TestConnectionResult {
  success: boolean
  latency: number
  error?: string
}
