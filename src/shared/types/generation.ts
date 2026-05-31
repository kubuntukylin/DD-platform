export interface GenerationSession {
  id: string
  conversationId: string | null
  projectId: string | null
  status: GenerationSessionStatus
  totalAgents: number
  completedAgents: number
  failedAgents: number
  startedAt: string
  completedAt: string | null
  errorMessage: string | null
}

export type GenerationSessionStatus = 'running' | 'completed' | 'cancelled' | 'failed'

export interface GenerationLog {
  id: string
  sessionId: string
  agentId: string | null
  logLevel: LogLevel
  message: string
  phase: string | null
  metadataJson: string
  createdAt: string
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface GenerationProgress {
  sessionId: string
  phase: string
  percent: number
  detail: string
  agentId?: string
  timestamp: number
}

export interface TerminalOutput {
  sessionId: string
  agentId?: string
  text: string
  stream: 'stdout' | 'stderr'
  timestamp: number
}

export interface GenerationPlan {
  agents: import('./agent').AgentSpecification[]
  relationships: import('./relationship').CreateRelationshipInput[]
  generationOrder: string[]
  projectStructure: FileNode[]
}

export interface FileNode {
  name: string
  type: 'file' | 'directory'
  children?: FileNode[]
}
