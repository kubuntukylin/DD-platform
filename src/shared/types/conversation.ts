export interface Conversation {
  id: string
  projectId: string | null
  title: string
  systemPrompt: string
  modelConfigId: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  tokensIn: number | null
  tokensOut: number | null
  modelUsed: string | null
  metadataJson: string
  parentMessageId: string | null
  sortOrder: number
  createdAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface CreateConversationInput {
  projectId?: string | null
  title?: string
  systemPrompt?: string
  modelConfigId?: string | null
}

export interface SendMessageInput {
  conversationId: string
  content: string
  modelConfigId?: string | null
}
