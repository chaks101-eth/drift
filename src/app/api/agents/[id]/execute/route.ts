import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export const maxDuration = 300

// POST /api/agents/:id/execute — execute an agent
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: agentId } = await params
  const { taskDescription, inputParams } = await req.json()

  if (!taskDescription) return NextResponse.json({ error: 'Missing taskDescription' }, { status: 400 })

  const db = getAdminClient()

  // Determine team from agentId
  const teamId = agentId.includes('-') ? agentId.split('-')[0] : 'root'

  // Create execution record
  const { data: execution, error: execErr } = await db.from('agent_executions').insert({
    agent_id: agentId,
    team_id: teamId,
    status: 'pending',
    action: agentId,
    task_description: taskDescription,
    input_params: inputParams || {},
  }).select('id').single()

  if (execErr) {
    return NextResponse.json({ error: execErr.message }, { status: 500 })
  }

  const executionId = execution.id

  // Update status to running
  await db.from('agent_executions').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', executionId)

  // Execute via Claude CLI (spawn process)
  try {
    const { execSync } = await import('child_process')

    // Find the agent's instruction file
    const agentPaths = [
      `.claude/agents/${agentId}.md`,
      `.claude/agents/${teamId}/agents/${agentId}.md`,
      `.claude/agents/${teamId}/${agentId}.md`,
    ]

    let agentPath = ''
    const fs = await import('fs')
    for (const p of agentPaths) {
      if (fs.existsSync(p)) { agentPath = p; break }
    }

    if (!agentPath) {
      await db.from('agent_executions').update({
        status: 'failed',
        error: `Agent definition not found. Tried: ${agentPaths.join(', ')}`,
        completed_at: new Date().toISOString(),
      }).eq('id', executionId)
      return NextResponse.json({ executionId, error: 'Agent not found' }, { status: 404 })
    }

    // Build the prompt with context
    const prompt = `${taskDescription}\n\nExecution ID: ${executionId}\nInput: ${JSON.stringify(inputParams || {})}`

    // Try to find claude CLI
    const claudePaths = ['/usr/local/bin/claude', '/opt/homebrew/bin/claude']
    let claudeBin = 'claude'
    for (const p of claudePaths) {
      if (fs.existsSync(p)) { claudeBin = p; break }
    }

    // Execute synchronously (for now — async/streaming in future)
    const startTime = Date.now()
    const result = execSync(
      `${claudeBin} --print --output-format text --agent "${agentPath.replace('.claude/agents/', '').replace('.md', '')}" -p "${prompt.replace(/"/g, '\\"')}"`,
      { cwd: process.cwd(), timeout: 240000, maxBuffer: 1024 * 1024 * 10, encoding: 'utf-8' }
    )

    const durationMs = Date.now() - startTime

    // Parse output — try JSON first, fall back to text
    let output: Record<string, unknown> = { raw: result }
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) output = JSON.parse(jsonMatch[0])
    } catch {
      // keep raw text output
    }

    await db.from('agent_executions').update({
      status: 'completed',
      output,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
    }).eq('id', executionId)

    return NextResponse.json({ executionId, status: 'completed', output, durationMs })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Execution failed'

    await db.from('agent_executions').update({
      status: 'failed',
      error: errorMsg.slice(0, 2000),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - Date.now(),
    }).eq('id', executionId)

    return NextResponse.json({ executionId, status: 'failed', error: errorMsg.slice(0, 500) })
  }
}
