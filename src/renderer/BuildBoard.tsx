import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { ReactFlow, Background, MarkerType, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAgentStore, useProjectStore, useGenerationStore, useUIStore } from './stores'
import { api } from './api'

export default function BuildBoard() {
  const allAgents = useAgentStore(s => s.agents)
  const relationships = useAgentStore(s => s.relationships)
  const activePid = useProjectStore(s => s.activeProjectId)
  const setSelectedAgent = useAgentStore(s => s.setSelectedAgent)
  const setActiveTab = useUIStore(s => s.setActiveTab)
  const sessions = useGenerationStore(s => s.sessions)
  const [activeSkillCount, setActiveSkillCount] = useState(0)
  const [width, setWidth] = useState(320)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX - ev.clientX
      setWidth(Math.max(200, Math.min(600, startW + delta)))
    }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width])

  useEffect(() => {
    api.get<Record<string,unknown>[]>('/api/skills').then(s => {
      setActiveSkillCount(s.filter(x => (x.isActive !== undefined ? x.isActive : x.is_active) !== 0).length)
    }).catch(() => {})
  }, [allAgents.length])

  const agents = useMemo(() =>
    activePid ? allAgents.filter(a => a.projectId === activePid) : allAgents,
    [allAgents, activePid]
  )

  // Activity Cards
  const cards = useMemo(() => agents.map(a => {
    const session = sessions[a.id]
    const status = (session && session.status === 'generating') ? 'generating' : a.status
    return { agent: a, status }
  }), [agents, sessions])

  // Mini architecture graph
  const projectRels = useMemo(() =>
    relationships.filter(r =>
      agents.some(a => a.id === r.sourceAgentId) && agents.some(a => a.id === r.targetAgentId)
    ),
    [relationships, agents]
  )

  const { nodes, edges } = useMemo(() => {
    const cols = 3
    const ns: Node[] = agents.map((a, i) => ({
      id: a.id,
      type: 'default',
      position: { x: (i % cols) * 200 + 20, y: Math.floor(i / cols) * 100 + 20 },
      data: { label: a.name },
      style: {
        background: '#1a1d2e', border: '1px solid #2d3348', borderRadius: 8,
        color: '#c9d1d9', fontSize: 11, padding: '8px 12px', width: 160,
      },
    }))
    const es: Edge[] = projectRels.map(r => ({
      id: r.id,
      source: r.sourceAgentId,
      target: r.targetAgentId,
      type: 'default',
      animated: r.relationshipType === 'communicates_with',
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: r.relationshipType === 'depends_on' ? '#ef4444' : r.relationshipType === 'communicates_with' ? '#3b82f6' : '#22c55e' },
      style: { stroke: r.relationshipType === 'depends_on' ? '#ef4444' : r.relationshipType === 'communicates_with' ? '#3b82f6' : '#22c55e', strokeWidth: 1.5 },
      label: r.description || undefined,
      labelStyle: { fontSize: 9, fill: '#6b7280' },
    }))
    return { nodes: ns, edges: es }
  }, [agents, projectRels])

  if (agents.length === 0) return null

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-l border-[#2d3348] select-none flex-shrink-0 relative" style={{ width }}>
      {/* Resize handle */}
      <div onMouseDown={onMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/50 active:bg-accent transition-colors z-10" />
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-[#2d3348] flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Build Board</span>
        <div className="flex items-center gap-2">
          {activeSkillCount > 0 && (
            <button onClick={() => setActiveTab('skills')} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
              {activeSkillCount} skills active
            </button>
          )}
          <span className="text-[10px] text-gray-500">{agents.length} agents</span>
        </div>
      </div>

      {/* Activity Cards */}
      <div className="flex-shrink-0 overflow-y-auto max-h-[50%] border-b border-[#2d3348]">
        <div className="p-2 space-y-1">
          {cards.map(({ agent, status }) => (
            <div key={agent.id}
              onClick={() => { setSelectedAgent(agent.id); setActiveTab('agents') }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-white/5 transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                status === 'generating' || status === 'queued' ? 'bg-yellow-500 animate-pulse' :
                status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-gray-600'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-gray-200 truncate">{agent.name}</div>
              </div>
              <span className={`text-[9px] flex-shrink-0 uppercase font-medium ${
                status === 'generating' || status === 'queued' ? 'text-yellow-400' :
                status === 'completed' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-gray-500'
              }`}>{status === 'generating' ? 'gen' : status === 'queued' ? 'que' : status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Mini-graph */}
      <div className="flex-1 min-h-0">
        <div className="px-3 py-1.5 border-b border-[#2d3348] text-[10px] text-gray-500 uppercase flex items-center justify-between">
          <span>Architecture</span>
          <span className="text-gray-600">{projectRels.length} links</span>
        </div>
        <div className="h-[calc(100%-28px)]">
          <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            proOptions={{ hideAttribution: true }}>
            <Background color="#1e2430" gap={20} />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
