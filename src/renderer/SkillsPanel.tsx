import { useState, useEffect } from 'react'
import { api } from './api'

const CATEGORIES: Record<string, string> = {
  architecture: 'Architecture',
  backend: 'Backend',
  frontend: 'Frontend',
  iot: 'IoT',
  devops: 'DevOps',
  auth: 'Auth',
  general: 'General',
}

export default function SkillsPanel() {
  const [skills, setSkills] = useState<Record<string, unknown>[]>([])
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all'|'on'|'off'>('all')
  const [form, setForm] = useState({ name: '', description: '', category: 'general', promptContent: '', isActive: true })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => { load() }, [])

  const load = async () => {
    try { setSkills(await api.get<Record<string, unknown>[]>('/api/skills')) } catch { /* ok */ }
  }

  const save = async () => {
    if (!form.name.trim()) return
    try {
      if (editing) { await api.put(`/api/skills/${editing.id}`, form) }
      else { await api.post('/api/skills', form) }
      setEditing(null); setAdding(false); load()
    } catch (e) { alert('Save failed: ' + (e as Error).message) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this skill?')) return
    await api.del(`/api/skills/${id}`); load()
  }

  const toggleActive = async (skill: Record<string, unknown>) => {
    await api.put(`/api/skills/${skill.id}`, { isActive: !(skill.isActive as boolean) }); load()
  }

  const openEdit = (s: Record<string, unknown>) => {
    setEditing(s); setAdding(false)
    setForm({ name: s.name as string, description: (s.description as string) || '', category: (s.category as string) || 'general', promptContent: (s.promptContent || s.prompt_content) as string, isActive: (s.isActive !== undefined ? s.isActive : s.is_active) as boolean })
  }

  const openNew = () => {
    setEditing(null); setAdding(true)
    setForm({ name: '', description: '', category: 'general', promptContent: '', isActive: true })
  }

  const activeCount = skills.filter(s => (s.isActive !== undefined ? s.isActive : s.is_active) !== 0).length
  const inactiveCount = skills.length - activeCount

  const filtered = skills.filter(s => {
    if (statusFilter === 'on' && !(s.isActive !== undefined ? s.isActive : s.is_active)) return false
    if (statusFilter === 'off' && (s.isActive !== undefined ? s.isActive : s.is_active)) return false
    if (filter !== 'all' && (s.category || s.cateogry) !== filter) return false
    return true
  })

  const toggleCat = (cat: string) => setCollapsed(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Skills</h2>
          <p className="text-[11px] text-text-tertiary mt-0.5">Constraints for agent generation in Build Mode. Toggle skills on/off to control what rules apply.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-[12px]">
            <button onClick={() => setStatusFilter('on')} className={`flex items-center gap-1 hover:underline ${statusFilter === 'on' ? 'text-success font-semibold' : 'text-text-secondary'}`}>
              <span className="w-2 h-2 rounded-full bg-success" />{activeCount} on
            </button>
            <button onClick={() => setStatusFilter('off')} className={`flex items-center gap-1 hover:underline ${statusFilter === 'off' ? 'text-text-tertiary font-semibold' : 'text-text-secondary'}`}>
              <span className="w-2 h-2 rounded-full bg-text-tertiary" />{inactiveCount} off
            </button>
            {statusFilter !== 'all' && (
              <button onClick={() => setStatusFilter('all')} className="text-[10px] text-accent hover:underline">clear</button>
            )}
          </div>
          <button onClick={openNew} className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-md text-[12px] font-medium">Add Skill</button>
        </div>
      </div>

      {/* Category + Status filter */}
      <div className="flex-shrink-0 px-4 py-2 flex gap-1.5 flex-wrap border-b border-border/50 items-center">
        <button onClick={() => setFilter('all')}
          className={`px-2.5 py-1 text-[11px] rounded-full font-medium transition-colors ${filter === 'all' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text'}`}>
          All
        </button>
        {Object.entries(CATEGORIES).map(([k, v]) => {
          const count = skills.filter(s => (s.category || s.cateogry) === k).length
          if (count === 0) return null
          return (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-2.5 py-1 text-[11px] rounded-full font-medium transition-colors ${filter === k ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text'}`}>
              {v} ({count})
            </button>
          )
        })}
      </div>

      {/* Skills grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => {
            const isActive = (s.isActive !== undefined ? s.isActive : s.is_active) as boolean
            const cat = (s.category || s.cateogry || 'general') as string
            const prompt = (s.promptContent || s.prompt_content || '') as string
            return (
              <div key={s.id as string}
                className={`bg-bg-secondary border rounded-lg p-4 transition-colors ${isActive ? 'border-border hover:border-accent/30' : 'border-border/30 opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[13px] font-semibold truncate">{s.name as string}</h3>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-success' : 'bg-text-tertiary'}`} />
                    </div>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{CATEGORIES[cat] || cat}</span>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => toggleActive(s)}
                      className={`px-1.5 py-0.5 text-[10px] rounded ${isActive ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-bg-tertiary text-text-tertiary hover:text-text'}`}
                      title={isActive ? 'Active - click to disable' : 'Inactive - click to enable'}>
                      {isActive ? 'On' : 'Off'}
                    </button>
                    <button onClick={() => openEdit(s)}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-bg-tertiary text-text-tertiary hover:text-text">Edit</button>
                    <button onClick={() => del(s.id as string)}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-bg-tertiary text-text-tertiary hover:text-error">Del</button>
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-2">{(s.description as string) || 'No description'}</p>
                <div className="bg-bg-tertiary rounded p-2 max-h-24 overflow-y-auto">
                  <p className="text-[10px] text-text-tertiary font-mono leading-relaxed whitespace-pre-wrap">{prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAdding(false); setEditing(null) }} />
          <div className="relative bg-bg-secondary border border-border rounded-lg w-[520px] max-h-[80vh] overflow-y-auto shadow-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold">{editing ? 'Edit Skill' : 'New Skill'}</h3>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Skill name" autoFocus
              className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] placeholder-text-tertiary outline-none focus:border-accent" />
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Short description"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] placeholder-text-tertiary outline-none focus:border-accent" />
            <div className="flex gap-2">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="flex-1 bg-bg border border-border rounded px-3 py-2 text-[13px] outline-none focus:border-accent">
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="flex items-center gap-1.5 px-3 py-2 bg-bg border border-border rounded cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="w-3 h-3 rounded accent-accent" />
                <span className="text-[12px]">Active</span>
              </label>
            </div>
            <div>
              <label className="text-[11px] text-text-secondary block mb-1">Prompt Content (injected into Build Mode)</label>
              <textarea value={form.promptContent} onChange={e => setForm({ ...form, promptContent: e.target.value })}
                placeholder="Instructions for the LLM when generating agents..."
                rows={5}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-[12px] placeholder-text-tertiary outline-none focus:border-accent resize-none font-mono" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAdding(false); setEditing(null) }}
                className="px-4 py-1.5 text-[12px] text-text-secondary hover:text-text rounded">Cancel</button>
              <button onClick={save} disabled={!form.name.trim()}
                className="px-4 py-1.5 text-[12px] bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
