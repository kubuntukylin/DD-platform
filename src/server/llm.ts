// ============================================================
// LLM Provider + Agent Decomposer
// ============================================================
import OpenAI from 'openai'
import { THINKING_MODELS } from '../shared/types'
import type { LLMConfig } from '../shared/types'

// ---- LLM Provider ----
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export function createLLMProvider(config: LLMConfig) {
  if (!config.apiKey) throw new Error('No API key configured. Go to Settings to add your access key.')

  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl || undefined })

  function buildParams(messages: ChatMessage[], stream?: boolean): Record<string, unknown> {
    const p: Record<string, unknown> = {
      model: config.modelName,
      messages,
      max_tokens: config.maxTokens,
    }
    if (config.enableThinking) {
      p.reasoning_effort = 'high'
      p.extra_body = { thinking: { type: 'enabled' } }
    }
    if (stream) p.stream = true
    return p
  }

  return {
    config,
    async chat(messages: ChatMessage[]): Promise<string> {
      const r = await client.chat.completions.create(buildParams(messages) as never)
      return r.choices[0]?.message?.content || ''
    },
    async *chatStream(messages: ChatMessage[], signal?: AbortSignal) {
      const stream = await client.chat.completions.create({ ...buildParams(messages, true), signal } as never)
      for await (const c of stream) {
        const t = c.choices[0]?.delta?.content
        if (t) yield { token: t, done: false as const }
      }
      yield { token: '', done: true as const }
    },
    async json<T>(messages: ChatMessage[]): Promise<T> {
      const sysMsg: ChatMessage = { role: 'system' as const, content: 'Output ONLY valid JSON. No markdown, no explanation, no code blocks.' }
      const finalMsg: ChatMessage = { role: 'user' as const, content: 'Output the JSON object now:' }
      const text = await this.chat([sysMsg, ...messages, finalMsg])
      let jsonStr = text.trim()
      const cb = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (cb) jsonStr = cb[1].trim()
      const om = jsonStr.match(/\{[\s\S]*\}/)
      if (om) jsonStr = om[0]
      try { return JSON.parse(jsonStr) as T } catch {
        const retry = await this.chat([sysMsg, ...messages, { role: 'user', content: 'Previous response was invalid. Output ONLY valid JSON.' }])
        let rj = retry.trim()
        const rb = rj.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (rb) rj = rb[1].trim()
        const rm = rj.match(/\{[\s\S]*\}/)
        if (rm) rj = rm[0]
        return JSON.parse(rj) as T
      }
    }
  }
}

// ---- Decomposer ----
export interface AgentSpec { id: string; name: string; description: string; responsibilities: string[]; inputs: { name: string; type: string; source: string }[]; outputs: { name: string; type: string; destination: string }[]; dependencies: string[]; technologies: string[]; complexity: string }
export interface RelSpec { sourceId: string; targetId: string; type: 'depends_on' | 'communicates_with' | 'shares_data'; dataFlow: string }

const BASE_SYS = 'You are a JSON API. Only output JSON. Create ONLY the agents the user explicitly asked for. Do NOT expand or add extra agents. Minimum agents needed.'

export function createDecomposer(llm: ReturnType<typeof createLLMProvider>) {
  function buildSys(rules?: string) {
    return rules ? `${BASE_SYS}\n\nProject Rules/Constraints:\n${rules}` : BASE_SYS
  }

  return {
    async analyze(req: string, rules?: string) {
      const p = `Requirements: "${req}"\n\nOutput JSON:\n{"domains":[{"name":"domain","description":"desc","keyEntities":["entity"]}],"actors":["actor"],"workflows":[{"name":"flow","steps":["step"]}],"dataEntities":[{"name":"entity","fields":["field"]}]}`
      return llm.json<{ domains: { name: string; description: string; keyEntities: string[] }[]; actors: string[]; workflows: { name: string; steps: string[] }[]; dataEntities: { name: string; fields: string[] }[] }>([{ role: 'system', content: buildSys(rules) }, { role: 'user', content: p }])
    },

    async identifyAgents(analysis: unknown, rules?: string, existingAgents?: Array<Record<string,unknown>>) {
      const existingCtx = existingAgents?.length
        ? `\nEXISTING AGENTS (do NOT recreate):\n${existingAgents!.map((a: Record<string,unknown>) => `${a.name}`).join(', ')}\n`
        : ''
      const p = `Create ONLY the agents the user explicitly requested. Do NOT add extra agents. Minimum number needed.${existingCtx}\n\nAnalysis: ${JSON.stringify(analysis)}\n\nOutput JSON:\n{"agents":[{"id":"kebab-name","name":"Human Name","description":"what","responsibilities":["task"],"inputs":[{"name":"x","type":"string","source":"agent-id"}],"outputs":[{"name":"x","type":"string","destination":"agent-id"}],"dependencies":[],"technologies":["express"],"complexity":"medium"}]}`
      return llm.json<{ agents: AgentSpec[] }>([{ role: 'system', content: buildSys(rules) }, { role: 'user', content: p }])
    },

    async mapRelationships(agents: AgentSpec[], rules?: string, existingAgents?: Array<Record<string,unknown>>) {
      const existingList = existingAgents?.length
        ? `\nEXISTING: ${existingAgents!.map((a: Record<string,unknown>) => (a as Record<string,unknown>).id || a.name).join(', ')}\n`
        : ''
      const p = `Map relationships for these agents. Types: depends_on | communicates_with | shares_data${existingList}\n\nNew agents: ${JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, inputs: a.inputs.map(i => i.source), outputs: a.outputs.map(o => o.destination) })))}\n\nOutput JSON:\n{"relationships":[{"sourceId":"id","targetId":"id","type":"depends_on","dataFlow":"data"}],"generationOrder":["id1"]}`
      return llm.json<{ relationships: RelSpec[]; generationOrder: string[] }>([{ role: 'system', content: buildSys(rules) }, { role: 'user', content: p }])
    },

    // Chat mode — simple conversation
    async *answerQuestion(content: string, agents: Array<Record<string,unknown>>, rules?: string, history?: { role: string; content: string }[], signal?: AbortSignal) {
      const agentCtx = agents.length > 0
        ? `\n\nThis project has ${agents.length} agents: ${agents.map(a => a.name).join(', ')}.`
        : ''
      const sys = `You are a software architect helping users build applications. Each "agent" is an independent microservice with its own code, API, and Docker container. The user is a domain expert, not a programmer. Answer their questions about their project's architecture, agents, and how to build software. Be direct and technical. Match the user's language. You are DeepSeek.${agentCtx}`
      const msgs: ChatMessage[] = [{ role: 'system', content: rules ? `${sys}\n\nProject rules: ${rules}` : sys }]
      if (history && history.length > 0) for (const h of history) msgs.push({ role: h.role as 'user' | 'assistant', content: h.content })
      msgs.push({ role: 'user', content })
      yield* llm.chatStream(msgs, signal)
    },

    // Build mode — full project context, LLM designs architecture freely
    async *buildArchitecture(content: string, agents: Array<Record<string,unknown>>, rules?: string, history?: { role: string; content: string }[], signal?: AbortSignal, skillsCtx?: string) {
      // Build detailed agent context including interfaces and relationships
      const agentDetails = agents.map(a => {
        let iface: Record<string,unknown> = {}
        try { iface = JSON.parse((a.interface_json as string) || '{}') } catch { /* ok */ }
        return {
          name: a.name,
          description: a.description,
          status: a.status,
          inputs: (iface.inputs as Array<Record<string,unknown>>) || [],
          outputs: (iface.outputs as Array<Record<string,unknown>>) || [],
        }
      })
      const ctx = agents.length > 0
        ? `\n\n## Existing Project Agents\n${JSON.stringify(agentDetails, null, 2)}\n`
        : '\n\n## Existing Project Agents\nNone yet. This is a new project.\n'

      const sys = `You are a software architect designing microservice systems. You define, modify, and remove agents (services) that form the user's application. The system handles ALL code generation, Docker, and deployment.

## FORMAT
1. Briefly assess the user's request and choose the right command (CREATE/UPDATE/DELETE/REGENERATE)
2. Output the command block with proper JSON. Examples below.

## COMMANDS — choose the RIGHT one for each task

### [CREATE] — Add NEW agents only (never recreate existing ones)
[CREATE]
{"agents":[{"id":"kebab-name","name":"Human Name","description":"what","responsibilities":["task"],"inputs":[{"name":"x","type":"string","source":"agent-id"}],"outputs":[{"name":"x","type":"string","destination":"agent-id"}],"dependencies":[],"technologies":["express"],"complexity":"medium"}]}
[END]

### [UPDATE] — Modify EXISTING agents (name, description, dependencies, I/O, responsibilities)
[UPDATE]
{"agents":[{"id":"existing-agent-id","name":"New Name","description":"changed","dependencies":["dep-id"],"inputs":[{"name":"data","type":"json","source":"src"}],"outputs":[{"name":"out","type":"json","destination":"dst"}]}]}
[END]

### [DELETE] — Remove agents
[DELETE]
{"agents":["agent-id-1","agent-id-2"]}
[END]

### [REGENERATE] — Re-generate code for broken/outdated agents
[REGENERATE]
{"agents":["agent-id-1"]}
[END]

## CRITICAL RULES
- Choose the CORRECT command. When user says "change X"/"modify Y"/"rename Z"/"update W"/"remove"→ use [UPDATE] or [DELETE], NOT [CREATE]
- NEVER output [CREATE] for agents that already exist. Their ids: ${agents.map(a => (a.id || '') + '=' + a.name).join(', ') || 'none'}
- NO code snippets, NO markdown code blocks around commands, NO Dockerfiles, NO docker-compose
- MAX 2-3 short sentences of explanation before the command block
- Each agent: id (kebab-case), name (Title Case), description (1 sentence), responsibilities, inputs/outputs (with source/destination), dependencies (agent ids), technologies, complexity
${agentDetails}${rules ? `\n\nProject Requirements:\n${rules}` : ''}${skillsCtx || ''}`


      const msgs: ChatMessage[] = [{ role: 'system', content: sys }]
      if (history && history.length > 0) for (const h of history) msgs.push({ role: h.role as 'user' | 'assistant', content: h.content })
      msgs.push({ role: 'user', content })
      yield* llm.chatStream(msgs, signal)
    }
  }
}