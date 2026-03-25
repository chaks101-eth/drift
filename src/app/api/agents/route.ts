import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/agents — list all agents (from filesystem + registry)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentsDir = path.join(process.cwd(), '.claude', 'agents')
  const teams: Array<{
    id: string; name: string; agents: Array<{ id: string; name: string; description: string; model: string; path: string }>
  }> = []

  try {
    const teamDirs = fs.readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory())

    for (const teamDir of teamDirs) {
      const teamId = teamDir.name
      const agentsPath = path.join(agentsDir, teamId, 'agents')
      const agents: typeof teams[0]['agents'] = []

      // Check for team-level agent file (e.g., growth-chief.md)
      const teamFiles = fs.readdirSync(path.join(agentsDir, teamId)).filter(f => f.endsWith('.md'))
      for (const file of teamFiles) {
        const parsed = parseAgentFile(path.join(agentsDir, teamId, file))
        if (parsed) agents.push({ ...parsed, path: `.claude/agents/${teamId}/${file}` })
      }

      // Check agents/ subdirectory
      if (fs.existsSync(agentsPath)) {
        const agentFiles = fs.readdirSync(agentsPath).filter(f => f.endsWith('.md'))
        for (const file of agentFiles) {
          const parsed = parseAgentFile(path.join(agentsPath, file))
          if (parsed) agents.push({ ...parsed, path: `.claude/agents/${teamId}/agents/${file}` })
        }
      }

      if (agents.length > 0) {
        teams.push({ id: teamId, name: teamId, agents })
      }
    }

    // Also check for root-level agents (e.g., chief.md)
    const rootFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))
    const rootAgents: typeof teams[0]['agents'] = []
    for (const file of rootFiles) {
      const parsed = parseAgentFile(path.join(agentsDir, file))
      if (parsed) rootAgents.push({ ...parsed, path: `.claude/agents/${file}` })
    }
    if (rootAgents.length > 0) {
      teams.unshift({ id: 'root', name: 'Chief', agents: rootAgents })
    }
  } catch {
    // agents dir may not exist
  }

  // Also load execution stats from DB
  const db = getAdminClient()
  const { data: recentExecs } = await db
    .from('agent_executions')
    .select('agent_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const execsByAgent: Record<string, { total: number; lastRun: string; lastStatus: string }> = {}
  for (const exec of recentExecs || []) {
    if (!exec.agent_id) continue
    if (!execsByAgent[exec.agent_id]) {
      execsByAgent[exec.agent_id] = { total: 0, lastRun: exec.created_at, lastStatus: exec.status }
    }
    execsByAgent[exec.agent_id].total++
  }

  return NextResponse.json({ teams, execsByAgent, totalAgents: teams.reduce((s, t) => s + t.agents.length, 0) })
}

function parseAgentFile(filePath: string): { id: string; name: string; description: string; model: string } | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return null

    const fm = frontmatterMatch[1]
    const name = fm.match(/name:\s*(.+)/)?.[1]?.trim() || path.basename(filePath, '.md')
    const description = fm.match(/description:\s*"?([^"\n]+)"?/)?.[1]?.trim() || ''
    const model = fm.match(/model:\s*(.+)/)?.[1]?.trim() || 'sonnet'

    return { id: name, name, description, model }
  } catch {
    return null
  }
}
