import { useState, useEffect } from 'react'
import { useUIStore } from './stores'
import { api } from './api'
import { THINKING_MODELS } from '../shared/types'

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useUIStore()
  const [configs, setConfigs] = useState<Record<string, unknown>[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', apiKey: '', model: 'deepseek-v4-pro', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', enableThinking: true })
  const [testMsg, setTestMsg] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [dockerRegistry, setDockerRegistry] = useState('')
  const [dockerRegistrySaved, setDockerRegistrySaved] = useState(false)

  useEffect(() => { load(); loadSettings() }, [])

  const loadSettings = async () => {
    try {
      const s = await api.settings.get() as Record<string, unknown>
      setDockerRegistry((s.dockerRegistry as string) || '')
    } catch { /* ok */ }
  }

  const saveDockerRegistry = async () => {
    try {
      await api.settings.set('dockerRegistry', dockerRegistry.trim())
      setDockerRegistrySaved(true)
      setTimeout(() => setDockerRegistrySaved(false), 2000)
    } catch { alert('Save failed') }
  }

  const load = async () => {
    try { setConfigs(await api.llm.list()) } catch { /* ok */ }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if ((!editingId || editingId === '__new__') && !form.apiKey.trim()) return
    setTestMsg('')
    try {
      const data: Record<string, unknown> = {
        name: form.name, provider: form.provider,
        modelName: form.model, baseUrl: form.baseUrl || null,
        enableThinking: form.enableThinking
      }
      if (form.apiKey.trim()) data.apiKey = form.apiKey
      if (editingId && editingId !== '__new__') {
        await api.llm.update(editingId, data)
      } else {
        await api.llm.create({ ...data, apiKey: form.apiKey, isDefault: configs.length === 0 })
      }
      await load(); setEditingId(null); setAdding(false)
    } catch (e) { alert('Save failed: ' + (e as Error).message) }
  }

  const handleTest = async (id: string) => {
    setTestMsg('Testing...')
    try {
      const r = await api.llm.test(id)
      if (r.success) setTestMsg(`Connected: ${r.latency}ms, model: ${r.model}`)
      else setTestMsg(`Failed: ${r.error}`)
    } catch (e) { setTestMsg('Error: ' + (e as Error).message) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this configuration?')) return
    await api.llm.del(id); await load()
  }

  const openNew = () => {
    setEditingId('__new__'); setAdding(true)
    setForm({ name: '', apiKey: '', model: 'deepseek-v4-pro', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', enableThinking: true })
    setTestMsg('')
  }

  const openEdit = (c: Record<string, unknown>) => {
    setEditingId(c.id as string); setAdding(false)
    setForm({
      name: c.name as string, apiKey: '',
      model: (c.modelName || c.model_name) as string, provider: c.provider as string,
      baseUrl: ((c.baseUrl || c.base_url) as string) || '',
      enableThinking: ((c.enableThinking !== undefined ? c.enableThinking : c.enable_thinking) as number) !== 0
    })
    setTestMsg('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-lg w-[560px] max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">AI Model</h3>
                <p className="text-[12px] text-text-tertiary mt-0.5">Configure the AI model for analysis and generation</p>
              </div>
              <button onClick={openNew} className="text-[12px] px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-md">Add Model</button>
            </div>

            {configs.map(c => {
              const isEditing = editingId === c.id || (adding && editingId === '__new__')
              const testForThis = testMsg && !isEditing && !editingId
              const modelName = (c.modelName || c.model_name) as string
              const isDefault = ((c.isDefault !== undefined ? c.isDefault : c.is_default) as number) === 1
              const enableThinking = ((c.enableThinking !== undefined ? c.enableThinking : c.enable_thinking) as number) !== 0
              const apiKey = (c.apiKey || c.api_key) as string || ''
              return (
                <div key={c.id as string} className="bg-bg border border-border rounded-lg p-4 mb-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[12px] text-text-secondary block mb-1">Display Name</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                          placeholder="DeepSeek V4 Flash" className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-[13px] placeholder-text-tertiary outline-none focus:border-accent" />
                      </div>
                      <div>
                        <label className="text-[12px] text-text-secondary block mb-1">Access Key {editingId && editingId !== '__new__' && <span className="text-text-tertiary">(leave empty to keep current)</span>}</label>
                        <input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
                          placeholder={editingId && editingId !== '__new__' ? '········ (unchanged)' : 'sk-...'}
                          className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-[13px] placeholder-text-tertiary outline-none focus:border-accent font-mono" />
                      </div>
                      <div>
                        <label className="text-[12px] text-text-secondary block mb-1">Model</label>
                        <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                          className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-[13px] outline-none focus:border-accent">
                          <optgroup label="DeepSeek">
                            <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                            <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
                          </optgroup>
                          <optgroup label="OpenAI">
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                          </optgroup>
                          <optgroup label="Anthropic">
                            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                          </optgroup>
                          <optgroup label="Google">
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                          </optgroup>
                        </select>
                      </div>

                      {THINKING_MODELS.has(form.model) && (
                        <div className="flex items-center justify-between bg-bg-tertiary rounded px-3 py-2">
                          <div>
                            <span className="text-[13px]">Thinking Mode</span>
                            <p className="text-[11px] text-text-tertiary">Deep reasoning with chain-of-thought</p>
                          </div>
                          <button onClick={() => setForm({ ...form, enableThinking: !form.enableThinking })}
                            className={`w-9 h-5 rounded-full transition-colors relative ${form.enableThinking ? 'bg-accent' : 'bg-border'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.enableThinking ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      )}

                      <button onClick={() => setAdvanced(!advanced)} className="text-[11px] text-accent hover:underline">
                        {advanced ? 'Hide' : 'Show'} Advanced
                      </button>
                      {advanced && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="text-[12px] text-text-secondary block mb-1">Provider</label>
                            <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}
                              className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-[13px] outline-none focus:border-accent">
                              <option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google</option><option value="custom">Custom</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[12px] text-text-secondary block mb-1">API URL</label>
                            <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                              className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-[13px] font-mono outline-none focus:border-accent" />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={handleSave} className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded text-[13px]">Save</button>
                        <button onClick={() => { setEditingId(null); setAdding(false) }} className="px-4 py-1.5 bg-bg-tertiary hover:bg-border rounded text-[13px]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">{c.name as string}</span>
                          {isDefault && <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded">Default</span>}
                          {enableThinking && THINKING_MODELS.has(modelName) && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-success/10 text-success rounded">Thinking</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleTest(c.id as string)}
                            className={`px-2 py-1 text-[11px] rounded ${testForThis && testMsg.includes('Connected') ? 'bg-success/10 text-success' : testForThis && testMsg !== 'Testing...' ? 'bg-error/10 text-error' : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'}`}>
                            {testForThis && testMsg.includes('Connected') ? 'Connected' : testForThis && testMsg === 'Testing...' ? 'Testing...' : testForThis ? 'Failed' : 'Test'}
                          </button>
                          <button onClick={() => openEdit(c)} className="px-2 py-1 text-[11px] text-text-tertiary hover:text-text hover:bg-bg-tertiary rounded">Edit</button>
                          {!isDefault && (
                            <button onClick={() => handleDelete(c.id as string)} className="px-2 py-1 text-[11px] text-text-tertiary hover:text-error hover:bg-error/10 rounded">Remove</button>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        Model: <span className="text-text-secondary">{modelName}</span>
                        <span className="mx-2">|</span>
                        Key: {apiKey.slice(0, 6)}...{apiKey.slice(-4)}
                      </div>
                      {testForThis && (
                        <div className={`mt-2 text-[11px] px-2 py-1 rounded ${testMsg.includes('Connected') ? 'bg-success/10 text-success border border-success/20' : testMsg === 'Testing...' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-error/10 text-error border border-error/20'}`}>
                          {testMsg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3">Appearance</h3>
            <div className="flex gap-3">
              <button onClick={() => setTheme('dark')} className={`flex-1 p-3 rounded-lg border transition-colors ${theme === 'dark' ? 'border-accent bg-accent/10' : 'border-border hover:border-border-hover'}`}>
                <div className="text-lg mb-1">🌙</div><div className="text-[13px]">Dark</div>
              </button>
              <button onClick={() => setTheme('light')} className={`flex-1 p-3 rounded-lg border transition-colors ${theme === 'light' ? 'border-accent bg-accent/10' : 'border-border hover:border-border-hover'}`}>
                <div className="text-lg mb-1">☀️</div><div className="text-[13px]">Light</div>
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-1">Docker Registry Mirror</h3>
            <p className="text-[11px] text-text-tertiary mb-3">
              Docker base image prefix. If Docker Hub is unavailable, set a mirror so all generated Dockerfiles use it. Leave empty to use Docker Hub directly.
            </p>
            <div className="flex gap-2">
              <input
                value={dockerRegistry}
                onChange={e => setDockerRegistry(e.target.value)}
                placeholder="e.g. docker.1ms.run"
                className="flex-1 bg-bg-secondary border border-border rounded px-3 py-2 text-[13px] font-mono placeholder-text-tertiary outline-none focus:border-accent"
              />
              <button onClick={saveDockerRegistry}
                className={`px-4 py-2 rounded text-[12px] font-medium transition-colors ${
                  dockerRegistrySaved
                    ? 'bg-success/20 text-success border border-success/30'
                    : 'bg-accent hover:bg-accent-hover text-white'
                }`}>
                {dockerRegistrySaved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-text-tertiary mt-1.5">
              {dockerRegistry
                ? `Dockerfile will use: FROM ${dockerRegistry}/node:22-alpine`
                : 'Default: FROM node:22-alpine (Docker Hub)'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
