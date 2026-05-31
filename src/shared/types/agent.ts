export interface Agent {
  id: string
  projectId: string | null
  name: string
  description: string
  status: AgentStatus
  agentType: AgentType
  specJson: string
  interfaceJson: string
  outputPath: string | null
  generationAttempts: number
  maxRetries: number
  errorMessage: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type AgentStatus = 'pending' | 'queued' | 'generating' | 'validating' | 'completed' | 'failed' | 'retrying'
export type AgentType = 'generated' | 'manual' | 'template'

export interface AgentSpecification {
  id: string
  name: string
  description: string
  responsibilities: string[]
  inputs: InterfaceEndpoint[]
  outputs: InterfaceEndpoint[]
  dependencies: string[]
  technologies: string[]
  complexity: 'low' | 'medium' | 'high'
}

export interface InterfaceEndpoint {
  name: string
  type: string
  source?: string
  destination?: string
}

export interface InterfaceContract {
  agentId: string
  agentName: string
  inputs: InterfaceEndpoint[]
  outputs: InterfaceEndpoint[]
  typescriptInterface: string
}

export interface CreateAgentInput {
  projectId: string | null
  name: string
  description?: string
  specJson?: string
  interfaceJson?: string
  maxRetries?: number
  sortOrder?: number
}
