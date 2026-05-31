import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  outputPath: z.string().optional(),
  mode: z.enum(['project', 'standalone']),
  parentId: z.string().uuid().nullable().optional()
})

export const createAgentSchema = z.object({
  projectId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  specJson: z.string().optional(),
  interfaceJson: z.string().optional(),
  maxRetries: z.number().min(1).max(10).optional(),
  sortOrder: z.number().int().min(0).optional()
})

export const createRelationshipSchema = z.object({
  sourceAgentId: z.string().uuid(),
  targetAgentId: z.string().uuid(),
  relationshipType: z.enum(['depends_on', 'communicates_with', 'shares_data']),
  description: z.string().max(500).optional()
})

export const createConversationSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).optional(),
  systemPrompt: z.string().max(10000).optional(),
  modelConfigId: z.string().uuid().nullable().optional()
})

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(50000),
  modelConfigId: z.string().uuid().nullable().optional()
})

export const createLLMConfigSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['deepseek', 'openai', 'anthropic', 'google', 'custom']),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().nullable().optional(),
  modelName: z.string().min(1).max(200),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  isDefault: z.boolean().optional()
})
