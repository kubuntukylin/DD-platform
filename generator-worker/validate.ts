// ============================================================
// Code quality validator — rejects chat text, accepts real code
// ============================================================

const CHAT_PATTERNS = [
  /^Ready\b/i, /^The\s+(file|write|code|content|index)/i, /^Here'?s?\b/i,
  /^I'?ll\b/i, /^Let\s+me\b/i, /^Create\b/i, /^Write\s+(the|a|this)/i,
  /^This\s+(file|code|document)/i, /^Sure/i, /^Of\s+course/i,
  /^The\s+\w+\s+file\s+(is|will|already|contains)/i,
  /^Below\b/i, /^The\s+following/i, /^```/i,
]

const CODE_PATTERNS = [
  /^import\b/m, /^export\b/m, /^const\b/m, /^let\b/m, /^var\b/m,
  /^function\b/m, /^class\b/m, /^interface\b/m, /^type\b/m,
  /^async\b/m, /^\/\//m, /^\/\*/m, /^#.*!/m, /^'use strict'/m,
  /^@/m, /^module\.exports/m, /^require\(/m, /^\{\s*$/m,
  /^(public|private|protected)\b/m, /^enum\b/m,
]

/**
 * Returns true if content looks like real code, false if it looks like chat text.
 */
export function isValidCode(content: string): { valid: boolean; reason: string } {
  if (!content || content.length < 30) {
    return { valid: false, reason: 'Too short (< 30 chars)' }
  }

  const firstLine = content.trimStart().split('\n')[0] || ''

  // Check for chat patterns first
  for (const pat of CHAT_PATTERNS) {
    if (pat.test(firstLine)) {
      return { valid: false, reason: `Chat text detected: "${firstLine.slice(0, 60)}"` }
    }
  }

  // Check for code patterns
  for (const pat of CODE_PATTERNS) {
    if (pat.test(content)) {
      return { valid: true, reason: 'ok' }
    }
  }

  // If no code patterns found but content is substantial, still reject as uncertain
  return { valid: false, reason: `No recognizable code patterns in ${content.length} chars` }
}
