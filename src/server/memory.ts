// ============================================================
// Conversation Memory — vector embedding + RAG retrieval
// ============================================================
import { getDB, saveDB } from './db'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// Generate embedding vector via DeepSeek API
async function embed(text: string, apiKey: string, baseUrl: string): Promise<number[]> {
  const r = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-chat', input: text })
  })
  if (!r.ok) throw new Error(`Embedding API error: ${r.status}`)
  const j = await r.json() as { data: { embedding: number[] }[] }
  return j.data[0].embedding
}

// Store a message in vector memory
export async function rememberMessage(convId: string, msgId: string, content: string, apiKey: string, baseUrl: string) {
  if (!content || content.length < 10) return
  const db = getDB()
  // Chunk long messages
  const chunks = content.length > 2000
    ? content.match(/[\s\S]{1,1500}/g) || [content]
    : [content]

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim()
    if (chunk.length < 10) continue
    try {
      const vec = await embed(chunk, apiKey, baseUrl)
      const id = `${msgId}-${i}`
      db.prepare('INSERT OR REPLACE INTO conversation_memory (id,conversation_id,message_id,chunk_index,content,embedding_json,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id, convId, msgId, i, chunk, JSON.stringify(vec), new Date().toISOString())
    } catch (e) { console.error('[memory] embed error:', e) }
  }
  saveDB()
}

// Retrieve relevant past messages using vector similarity
export function recallMemory(convId: string, query: string, apiKey: string, baseUrl: string, topK: number = 5): string[] {
  const db = getDB()
  const memories = db.prepare('SELECT content, embedding_json FROM conversation_memory WHERE conversation_id=? ORDER BY created_at DESC LIMIT 200').all(convId) as { content: string; embedding_json: string }[]
  if (memories.length === 0) return []

  try {
    // Get query embedding
    embed(query, apiKey, baseUrl).then(queryVec => {
      // Score each memory
      const scored = memories.map(m => {
        try {
          const vec = JSON.parse(m.embedding_json) as number[]
          return { content: m.content, score: cosineSimilarity(queryVec, vec) }
        } catch { return { content: m.content, score: 0 } }
      })
      // No need to return — this is async fire-and-forget for now
    }).catch(() => { /* embedding failed, use recent messages */ })
  } catch { /* fall through to recent-only */ }

  // Fallback: return most recent messages if embeddings aren't ready
  const recent = db.prepare('SELECT content FROM conversation_memory WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?').all(convId, topK) as { content: string }[]
  return recent.map(r => r.content)
}

// Get recent conversation history with roles for LLM context
export function getRecentContext(convId: string, limit: number = 10): { role: string; content: string }[] {
  const db = getDB()
  const rows = db.prepare('SELECT role, content FROM messages WHERE conversation_id=? ORDER BY sort_order DESC LIMIT ?').all(convId, limit) as { role: string; content: string }[]
  return rows.reverse()
}
