export interface AgentRelationship {
  id: string
  sourceAgentId: string
  targetAgentId: string
  relationshipType: RelationshipType
  description: string
  createdAt: string
}

export type RelationshipType = 'depends_on' | 'communicates_with' | 'shares_data'

export interface CreateRelationshipInput {
  sourceAgentId: string
  targetAgentId: string
  relationshipType: RelationshipType
  description?: string
}
