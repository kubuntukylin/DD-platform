export interface Project {
  id: string
  name: string
  description: string
  outputPath: string
  status: ProjectStatus
  mode: ProjectMode
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = 'idle' | 'generating' | 'completed' | 'error'
export type ProjectMode = 'project' | 'standalone'

export interface CreateProjectInput {
  name: string
  description?: string
  outputPath?: string
  mode: ProjectMode
  parentId?: string | null
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  outputPath?: string
  status?: ProjectStatus
}
