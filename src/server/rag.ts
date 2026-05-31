// ============================================================
// RAG Service — local embedding + 3-layer retrieval
// ============================================================
import { getDB, saveDB } from './db'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

let _embedder: ((texts: string[]) => Promise<number[][]>) | null = null

async function getEmbedder(): Promise<(texts: string[]) => Promise<number[][]>> {
  if (_embedder) return _embedder
  try {
    const { pipeline } = await import('@xenova/transformers')
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    _embedder = async (texts: string[]) => {
      const results: number[][] = []
      for (const t of texts) {
        const r = await pipe(t, { pooling: 'mean', normalize: true })
        results.push(Array.from(r.data as Float32Array) as number[])
      }
      return results
    }
    return _embedder
  } catch (e) {
    console.error('[RAG] Failed to load embedder:', e)
    // Return fallback — zero vectors, will skip vector search
    _embedder = async (texts) => texts.map(() => [])
    return _embedder
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// Index agent code files into code_chunks
export async function indexAgentCode(agentId: string, agentDir: string, agentName: string) {
  const db = getDB()
  const files = ['index.ts', 'service.ts', 'config.ts', 'types.ts']
  const embedder = await getEmbedder()
  const rnd = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  for (const fn of files) {
    const fp = join(agentDir, fn)
    if (!existsSync(fp)) continue
    try {
      const content = readFileSync(fp, 'utf-8')
      if (content.length < 20) continue
      // Chunk by function/class boundaries or ~1000 chars
      const chunks = content.match(/[\s\S]{1,1000}/g) || [content]
      const texts: string[] = []
      const metas: { ci: number; c: string }[] = []
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i].trim()
        if (c.length < 20) continue
        texts.push(c); metas.push({ ci: i, c })
      }
      if (texts.length === 0) continue

      // Delete old chunks for this agent+file
      db.prepare('DELETE FROM code_chunks WHERE agent_id=? AND file_name=?').run(agentId, fn)

      const vectors = await embedder(texts)
      for (let i = 0; i < texts.length; i++) {
        const id = rnd()
        db.prepare('INSERT INTO code_chunks (id,agent_id,file_name,chunk_index,content,embedding_json,content_type,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(id, agentId, fn, metas[i].ci, metas[i].c, JSON.stringify(vectors[i]), 'code', new Date().toISOString())
      }
    } catch (e) { console.error(`[RAG] Index error ${fn}:`, e) }
  }
  saveDB()
}

// Index a chat message
export async function indexMessage(convId: string, msgId: string, content: string) {
  if (!content || content.length < 20) return
  const db = getDB()
  try {
    const embedder = await getEmbedder()
    const chunks = content.length > 1000 ? (content.match(/[\s\S]{1,1000}/g) || [content]) : [content]
    const vectors = await embedder(chunks)
    const rnd = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    for (let i = 0; i < chunks.length; i++) {
      db.prepare('INSERT INTO code_chunks (id,conversation_id,file_name,chunk_index,content,embedding_json,content_type,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(rnd(), convId, '', i, chunks[i].trim(), JSON.stringify(vectors[i]), 'message', new Date().toISOString())
    }
    saveDB()
  } catch (e) { console.error('[RAG] Message index error:', e) }
}

// 3-layer retrieval: SQL → FTS → Vector
export async function retrieveContext(query: string, projectId: string | null, topK: number = 8): Promise<string[]> {
  const db = getDB()
  const results: Map<string, { content: string; score: number }> = new Map()

  // Layer 1: SQL — exact agent name match
  const words = query.split(/[\s，,。.?？!！]+/).filter(w => w.length > 1)
  for (const w of words) {
    try {
      const agents = db.prepare('SELECT name, description, spec_json, error_message, status FROM agents WHERE (project_id=? OR ? IS NULL) AND (name LIKE ? OR description LIKE ? OR error_message LIKE ?) LIMIT 5')
        .all(projectId, projectId, `%${w}%`, `%${w}%`, `%${w}%`) as Record<string,unknown>[]
      for (const a of agents) {
        const info = `${a.name} (${a.status}): ${a.description || ''} ${a.error_message ? 'ERROR: ' + a.error_message : ''}`
        results.set(`agent-${a.name}`, { content: info, score: 1.0 })
      }
    } catch { /* ok */ }
  }

  // Layer 2: FTS — full text search on chunks
  for (const w of words) {
    try {
      const fts = db.prepare('SELECT content FROM code_chunks WHERE content LIKE ? LIMIT 5').all(`%${w}%`) as { content: string }[]
      for (const r of fts) {
        const key = `fts-${r.content.slice(0, 50)}`
        if (!results.has(key)) results.set(key, { content: r.content.slice(0, 500), score: 0.7 })
      }
    } catch { /* ok */ }
  }

  // Layer 3: Vector semantic search
  try {
    const embedder = await getEmbedder()
    const queryVec = (await embedder([query]))[0]
    if (queryVec.length > 0) {
      const allChunks = db.prepare('SELECT content, embedding_json FROM code_chunks ORDER BY created_at DESC LIMIT 200').all() as { content: string; embedding_json: string }[]
      for (const c of allChunks) {
        try {
          const vec = JSON.parse(c.embedding_json) as number[]
          if (vec.length === 0) continue
          const score = cosineSimilarity(queryVec, vec)
          if (score > 0.3) {
            const key = `vec-${c.content.slice(0, 50)}`
            const existing = results.get(key)
            if (!existing || existing.score < score) {
              results.set(key, { content: c.content.slice(0, 500), score })
            }
          }
        } catch { /* skip bad JSON */ }
      }
    }
  } catch { /* vector search unavailable */ }

  // Sort by score descending, take top K
  return Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(r => r.content)
}
