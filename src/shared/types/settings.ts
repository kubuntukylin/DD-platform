export interface AppSettings {
  theme: 'dark' | 'light'
  fontSize: number
  defaultOutputPath: string
  maxRetries: number
  generationTimeoutMs: number
  autoSaveConversations: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  defaultOutputPath: 'output',
  maxRetries: 3,
  generationTimeoutMs: 120000,
  autoSaveConversations: true
}
