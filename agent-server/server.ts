// ─── Drift Agent Execution Server ────────────────────────────
// Runs locally on your Mac. The admin dashboard (Railway) calls this
// to execute Claude CLI agents.
//
// Start:  npx tsx agent-server/server.ts
// Or:     npm run agents
//
// Flow:   Admin Dashboard → POST /execute → Claude CLI → stream logs → response

import http from 'http'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const PORT = parseInt(process.env.AGENT_PORT || '3100')
const PROJECT_ROOT = path.resolve(__dirname, '..')
const AGENTS_DIR = path.join(PROJECT_ROOT, '.claude', 'agents')
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'drift-beta-s3cr3t-x7k9m2'

// Supabase client for persisting executions
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Find claude CLI
function findClaude(): string {
  try {
    return execSync('which claude', { encoding: 'utf-8' }).trim()
  } catch {
    const paths = ['/usr/local/bin/claude', '/opt/homebrew/bin/claude']
    for (const p of paths) {
      if (fs.existsSync(p)) return p
    }
    throw new Error('Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code')
  }
}

// Find agent definition file
function findAgentFile(agentId: string): string | null {
  const candidates = [
    path.join(AGENTS_DIR, `${agentId}.md`),
  ]

  // Search all team dirs
  if (fs.existsSync(AGENTS_DIR)) {
    const teamDirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
    for (const team of teamDirs) {
      candidates.push(
        path.join(AGENTS_DIR, team.name, 'agents', `${agentId}.md`),
        path.join(AGENTS_DIR, team.name, `${agentId}.md`),
      )
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

// Parse agent name from frontmatter
function getAgentName(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8')
  const match = content.match(/name:\s*(.+)/)
  return match?.[1]?.trim() || path.basename(filePath, '.md')
}

// List all agents
function listAgents(): Array<{ id: string; name: string; team: string; path: string }> {
  const agents: Array<{ id: string; name: string; team: string; path: string }> = []

  if (!fs.existsSync(AGENTS_DIR)) return agents

  // Root agents
  for (const f of fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'))) {
    const fp = path.join(AGENTS_DIR, f)
    agents.push({ id: path.basename(f, '.md'), name: getAgentName(fp), team: 'root', path: fp })
  }

  // Team agents
  const teamDirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
  for (const team of teamDirs) {
    // Team-level files
    const teamPath = path.join(AGENTS_DIR, team.name)
    for (const f of fs.readdirSync(teamPath).filter(f => f.endsWith('.md'))) {
      const fp = path.join(teamPath, f)
      agents.push({ id: path.basename(f, '.md'), name: getAgentName(fp), team: team.name, path: fp })
    }

    // agents/ subdir
    const agentsSubdir = path.join(teamPath, 'agents')
    if (fs.existsSync(agentsSubdir)) {
      for (const f of fs.readdirSync(agentsSubdir).filter(f => f.endsWith('.md'))) {
        const fp = path.join(agentsSubdir, f)
        agents.push({ id: path.basename(f, '.md'), name: getAgentName(fp), team: team.name, path: fp })
      }
    }
  }

  return agents
}

// Active executions
const executions = new Map<string, {
  id: string
  agentId: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  output: string
  error?: string
  durationMs?: number
}>()

let execCounter = 0

// Execute an agent
async function executeAgent(agentId: string, task: string): Promise<string> {
  const claudeBin = findClaude()
  const agentFile = findAgentFile(agentId)

  if (!agentFile) {
    throw new Error(`Agent "${agentId}" not found`)
  }

  let execId = `exec_${Date.now()}_${++execCounter}`
  const agentName = agentFile
    .replace(AGENTS_DIR + '/', '')
    .replace('.md', '')
    .replace('/agents/', '/')

  const startedAt = new Date().toISOString()

  executions.set(execId, {
    id: execId,
    agentId,
    status: 'running',
    startedAt,
    output: '',
  })

  // Persist to DB
  const teamId = agentName.split('/')[0] || 'root'
  const { data: dbExec } = await db.from('agent_executions').insert({
    agent_id: agentId,
    team_id: teamId,
    status: 'running',
    action: agentId,
    task_description: task,
    input_params: {},
    started_at: startedAt,
  }).select('id').single()

  const dbId = dbExec?.id
  // Update in-memory ID to match DB
  if (dbId) {
    const exec = executions.get(execId)!
    executions.delete(execId)
    exec.id = dbId
    execId = dbId
    executions.set(dbId, exec)
  }

  const startTime = Date.now()

  console.log(`\n🚀 Executing: ${agentId}`)
  console.log(`   Task: ${task.slice(0, 100)}...`)
  console.log(`   Agent: ${agentName}`)
  console.log(`   Exec ID: ${execId}`)

  const child = spawn(claudeBin, [
    '--print',
    '--output-format', 'text',
    '--dangerously-skip-permissions',
    '--max-turns', '50',
    '-p', task,
  ], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLAUDE_AGENT: agentName },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let output = ''
  let errorOutput = ''

  child.stdout.on('data', (data: Buffer) => {
    const text = data.toString()
    output += text
    process.stdout.write(text)
    const exec = executions.get(execId)
    if (exec) exec.output = output
  })

  child.stderr.on('data', (data: Buffer) => {
    errorOutput += data.toString()
  })

  child.on('close', async (code) => {
    const durationMs = Date.now() - startTime
    const status = code === 0 ? 'completed' : 'failed'
    const completedAt = new Date().toISOString()
    const exec = executions.get(execId)
    if (exec) {
      exec.status = status
      exec.completedAt = completedAt
      exec.durationMs = durationMs
      exec.output = output
      if (code !== 0) exec.error = errorOutput.slice(0, 2000)
    }

    // Persist to DB
    await db.from('agent_executions').update({
      status,
      output: { text: output.slice(0, 50000) }, // cap at 50KB
      error: code !== 0 ? errorOutput.slice(0, 2000) : null,
      completed_at: completedAt,
      duration_ms: durationMs,
    }).eq('id', execId).then(() => {}, () => {})

    console.log(`\n${code === 0 ? '✅' : '❌'} ${agentId} ${status} in ${(durationMs / 1000).toFixed(1)}s`)
  })

  return execId
}

// ─── HTTP Server ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS for admin dashboard
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Auth check
  const secret = req.headers['x-admin-secret'] as string ||
    new URL(req.url || '/', `http://localhost:${PORT}`).searchParams.get('secret')
  if (secret !== ADMIN_SECRET) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  // GET /agents — list all agents
  if (req.method === 'GET' && url.pathname === '/agents') {
    const agents = listAgents()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ agents, count: agents.length }))
    return
  }

  // POST /execute — execute an agent
  if (req.method === 'POST' && url.pathname === '/execute') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { agentId, task } = JSON.parse(body)
        if (!agentId || !task) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing agentId or task' }))
          return
        }

        const execId = executeAgent(agentId, task)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ execId, status: 'running' }))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (err as Error).message }))
      }
    })
    return
  }

  // GET /executions — list recent executions
  if (req.method === 'GET' && url.pathname === '/executions') {
    const all = Array.from(executions.values()).sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ executions: all.slice(0, 50) }))
    return
  }

  // GET /executions/:id — get execution detail
  const execMatch = url.pathname.match(/^\/executions\/(.+)$/)
  if (req.method === 'GET' && execMatch) {
    const exec = executions.get(execMatch[1])
    if (!exec) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Execution not found' }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(exec))
    return
  }

  // GET /executions/:id/stream — SSE stream of execution output
  const streamMatch = url.pathname.match(/^\/executions\/(.+)\/stream$/)
  if (req.method === 'GET' && streamMatch) {
    const exec = executions.get(streamMatch[1])
    if (!exec) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Execution not found' }))
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    let lastLen = 0
    const interval = setInterval(() => {
      const current = executions.get(streamMatch![1])
      if (!current) { clearInterval(interval); res.end(); return }

      if (current.output.length > lastLen) {
        const newText = current.output.slice(lastLen)
        res.write(`data: ${JSON.stringify({ type: 'output', text: newText })}\n\n`)
        lastLen = current.output.length
      }

      if (current.status !== 'running') {
        res.write(`data: ${JSON.stringify({ type: 'done', status: current.status, durationMs: current.durationMs })}\n\n`)
        clearInterval(interval)
        res.end()
      }
    }, 500)

    req.on('close', () => clearInterval(interval))
    return
  }

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', agents: listAgents().length, uptime: process.uptime() }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  const agents = listAgents()
  console.log(`\n🤖 Drift Agent Server running on http://localhost:${PORT}`)
  console.log(`   ${agents.length} agents loaded across ${new Set(agents.map(a => a.team)).size} teams`)
  console.log(`   Project: ${PROJECT_ROOT}`)
  console.log(`   Claude CLI: ${findClaude()}`)
  console.log(`\n   Endpoints:`)
  console.log(`     GET  /agents              — list all agents`)
  console.log(`     POST /execute             — execute an agent { agentId, task }`)
  console.log(`     GET  /executions          — list recent executions`)
  console.log(`     GET  /executions/:id      — get execution detail`)
  console.log(`     GET  /executions/:id/stream — SSE stream of output`)
  console.log(`     GET  /health              — health check`)
  console.log(`\n   Auth: x-admin-secret header or ?secret= param`)
  console.log('')
})
