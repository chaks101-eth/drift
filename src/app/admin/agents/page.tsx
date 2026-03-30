'use client'

import { useState, useEffect } from 'react'

let _secret = ''
const getSecret = () => _secret
const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-secret': getSecret() })

// Agent server: local execution server on port 3100
const AGENT_SERVER = 'http://localhost:3100'
const agentServerHeaders = () => ({ 'Content-Type': 'application/json', 'x-admin-secret': getSecret() })

const api = (path: string) => {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('secret', getSecret())
  return url.toString()
}

type Agent = { id: string; name: string; description: string; model: string; path: string }
type Team = { id: string; name: string; agents: Agent[] }
type Execution = {
  id: string; agent_id: string; team_id: string; status: string
  action: string; task_description: string; input_params: Record<string, unknown>
  output: Record<string, unknown>; error: string | null
  started_at: string; completed_at: string; duration_ms: number; created_at: string
}

function scoreColor(status: string): string {
  if (status === 'completed') return '#4ecdc4'
  if (status === 'running') return '#c8a44e'
  if (status === 'failed') return '#e74c3c'
  return '#7a7a85'
}

export default function AgentsDashboard() {
  const [authed, setAuthed] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [execsByAgent, setExecsByAgent] = useState<Record<string, { total: number; lastRun: string; lastStatus: string }>>({})
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [taskInput, setTaskInput] = useState('')
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState<Record<string, unknown> | null>(null)
  const [recentExecs, setRecentExecs] = useState<Execution[]>([])
  const [expandedExec, setExpandedExec] = useState<string | null>(null)

  useEffect(() => {
    if (!authed) return
    loadAgents()
    loadRecentExecutions()
  }, [authed])

  async function loadAgents() {
    const res = await fetch(api('/api/agents'), { headers: headers() })
    const data = await res.json()
    setTeams(data.teams || [])
    setExecsByAgent(data.execsByAgent || {})
  }

  async function loadRecentExecutions() {
    // Try local agent server first (has in-memory + live data)
    try {
      const res = await fetch(`${AGENT_SERVER}/executions?secret=${getSecret()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.executions?.length) {
          setRecentExecs(data.executions)
          return
        }
      }
    } catch { /* server offline, try DB */ }

    // Fallback: load from Supabase via admin API
    try {
      const res = await fetch(api('/api/admin/agent-executions'), { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setRecentExecs(data)
      }
    } catch { /* ignore */ }
  }

  const [agentServerOnline, setAgentServerOnline] = useState(false)
  const [execLog, setExecLog] = useState('')

  // Check if local agent server is running
  useEffect(() => {
    if (!authed) return
    fetch(`${AGENT_SERVER}/health?secret=${getSecret()}`)
      .then(r => r.json())
      .then(d => setAgentServerOnline(d.status === 'ok'))
      .catch(() => setAgentServerOnline(false))
  }, [authed])

  async function executeAgent() {
    if (!selectedAgent || !taskInput) return

    if (!agentServerOnline) {
      setExecResult({ error: 'Local agent server not running. Start it with: npx tsx agent-server/server.ts' })
      return
    }

    setExecuting(true)
    setExecResult(null)
    setExecLog('')

    try {
      // Execute via local agent server
      const res = await fetch(`${AGENT_SERVER}/execute`, {
        method: 'POST',
        headers: agentServerHeaders(),
        body: JSON.stringify({ agentId: selectedAgent.id, task: taskInput }),
      })
      const data = await res.json()

      if (data.execId) {
        // Poll for completion via SSE stream
        const eventSource = new EventSource(`${AGENT_SERVER}/executions/${data.execId}/stream?secret=${getSecret()}`)
        eventSource.onmessage = (event) => {
          const msg = JSON.parse(event.data)
          if (msg.type === 'output') {
            setExecLog(prev => prev + msg.text)
          }
          if (msg.type === 'done') {
            eventSource.close()
            setExecResult({ status: msg.status, durationMs: msg.durationMs, execId: data.execId })
            setExecuting(false)
          }
        }
        eventSource.onerror = () => {
          eventSource.close()
          // Fallback: poll for result
          setTimeout(async () => {
            const r = await fetch(`${AGENT_SERVER}/executions/${data.execId}?secret=${getSecret()}`)
            const d = await r.json()
            setExecResult(d)
            setExecLog(d.output || '')
            setExecuting(false)
          }, 2000)
        }
      } else {
        setExecResult(data)
        setExecuting(false)
      }
    } catch (err) {
      setExecResult({ error: `Failed to connect to agent server: ${err}` })
      setExecuting(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 w-[380px]">
          <h1 className="font-serif text-2xl text-[#c8a44e] mb-4">Agent Dashboard</h1>
          <input
            value={secretInput}
            onChange={e => setSecretInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { _secret = secretInput; setAuthed(true) } }}
            placeholder="Admin secret" type="password"
            className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-[#f0efe8] mb-4"
          />
          <button onClick={() => { _secret = secretInput; setAuthed(true) }}
            className="w-full bg-[#c8a44e] text-[#08080c] rounded-xl py-3 text-sm font-medium">Enter</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-8 py-4 flex items-center gap-4">
        <a href="/admin" className="text-[#7a7a85] text-sm hover:text-[#f0efe8]">&larr; Admin</a>
        <h1 className="font-serif text-xl text-[#c8a44e]">Agent System</h1>
        <span className="text-xs text-[#4a4a55]">{teams.reduce((s, t) => s + t.agents.length, 0)} agents across {teams.length} teams</span>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 grid grid-cols-[300px_1fr] gap-8">
        {/* Left: Agent Registry */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[#4a4a55]">Teams & Agents</h2>

          {teams.map(team => (
            <div key={team.id} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
              <div className="text-xs text-[#c8a44e] uppercase tracking-wider mb-3 font-medium">{team.name}</div>
              <div className="space-y-1">
                {team.agents.map(agent => {
                  const stats = execsByAgent[agent.id]
                  const isSelected = selectedAgent?.id === agent.id
                  return (
                    <button
                      key={agent.id}
                      onClick={() => { setSelectedAgent(agent); setExecResult(null) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        isSelected ? 'bg-[rgba(200,164,78,0.1)] text-[#c8a44e]' : 'text-[#7a7a85] hover:text-[#f0efe8] hover:bg-[rgba(255,255,255,0.02)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-[9px] text-[#4a4a55]">{agent.model}</span>
                      </div>
                      {stats && (
                        <div className="text-[9px] text-[#4a4a55] mt-0.5">
                          {stats.total} runs · <span style={{ color: scoreColor(stats.lastStatus) }}>{stats.lastStatus}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Agent Detail + Execute */}
        <div className="space-y-6">
          {/* Selected Agent */}
          {selectedAgent ? (
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-serif text-[#f0efe8]">{selectedAgent.name}</h2>
                  <p className="text-xs text-[#7a7a85] mt-1">{selectedAgent.description}</p>
                </div>
                <span className="text-[10px] bg-[rgba(200,164,78,0.1)] text-[#c8a44e] px-2 py-1 rounded">{selectedAgent.model}</span>
              </div>

              <div className="text-[10px] text-[#4a4a55] mb-4">{selectedAgent.path}</div>

              {/* Agent Server Status */}
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-2 w-2 rounded-full ${agentServerOnline ? 'bg-[#4ecdc4]' : 'bg-[#e74c3c]'}`} />
                  <span className="text-[10px] text-[#7a7a85]">
                    Agent Server {agentServerOnline ? 'online' : 'offline'}
                  </span>
                  {!agentServerOnline && (
                    <code className="text-[9px] text-[#4a4a55] bg-[#08080c] px-2 py-0.5 rounded ml-1">
                      npx tsx agent-server/server.ts
                    </code>
                  )}
                </div>
              </div>

              {/* Execute */}
              <div>
                <label className="text-[10px] text-[#4a4a55] uppercase tracking-wider block mb-2">Task Description</label>
                <textarea
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  placeholder={`Tell ${selectedAgent.name} what to do...`}
                  rows={3}
                  className="w-full bg-[#08080c] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-[#f0efe8] resize-none mb-3"
                />
                <button
                  onClick={executeAgent}
                  disabled={executing || !taskInput || !agentServerOnline}
                  className="bg-[#c8a44e] text-[#08080c] px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {executing ? 'Executing...' : 'Execute Agent'}
                </button>
              </div>

              {/* Live Execution Log */}
              {execLog && (
                <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-4">
                  <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-2">
                    {executing ? '● Live Output' : 'Output'}
                  </div>
                  <pre className="bg-[#08080c] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-xs text-[#a0a0a8] overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap font-mono">
                    {execLog}
                  </pre>
                </div>
              )}

              {/* Result */}
              {execResult && (
                <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-4">
                  <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-2">Result</div>
                  <div className={`text-xs px-2 py-1 rounded inline-block mb-2 ${
                    execResult.status === 'completed' ? 'bg-[rgba(78,205,196,0.1)] text-[#4ecdc4]'
                      : 'bg-[rgba(231,76,60,0.1)] text-[#e74c3c]'
                  }`}>
                    {(execResult.status as string) || 'unknown'}
                  </div>
                  {typeof execResult.durationMs === 'number' && (
                    <span className="text-[10px] text-[#4a4a55] ml-2">{Math.round((execResult.durationMs as number) / 1000)}s</span>
                  )}
                  {execResult.error ? (
                    <pre className="mt-2 bg-[rgba(231,76,60,0.05)] border border-[rgba(231,76,60,0.15)] rounded-xl p-4 text-xs text-[#e74c3c] overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                      {String(execResult.error as string)}
                    </pre>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-12 text-center">
              <div className="text-[#4a4a55] text-sm">Select an agent from the left to view details and execute</div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Run Full Eval', agent: 'eval-runner', task: 'Run batch eval on all trips with judge enabled. Report avg scores by destination and weakest dimensions.' },
                { label: 'Analyze Patterns', agent: 'pattern-analyzer', task: 'Run deep pattern analysis on all eval results. Identify systemic issues and recommend fixes.' },
                { label: 'Validate Recent Trips', agent: 'trip-validator', task: 'Validate the 5 most recent trips for hallucinations, temporal logic, and geographic feasibility.' },
                { label: 'Research Must-Sees', agent: 'must-see-enforcer', task: 'Research and compile must-see lists for Bangkok, Bali, Phuket, and Dubai. Include both landmarks and vibe-specific picks for foodie, culture, adventure, and beach vibes.' },
                { label: 'Audit Ratings', agent: 'rating-enricher', task: 'Audit how many itinerary items have Google Places ratings. Report the gap and recommend fixes.' },
                { label: 'Growth Report', agent: 'analytics-reporter', task: 'Generate a weekly growth report with user signups, trips created, and content performance.' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => {
                    const agent = teams.flatMap(t => t.agents).find(a => a.id === action.agent)
                    if (agent) { setSelectedAgent(agent); setTaskInput(action.task) }
                  }}
                  className="text-left px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[#c8a44e33] hover:bg-[rgba(200,164,78,0.03)] transition-colors"
                >
                  <div className="text-xs text-[#f0efe8] font-medium">{action.label}</div>
                  <div className="text-[9px] text-[#4a4a55] mt-1">{action.agent}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Executions */}
          {recentExecs.length > 0 && (
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Recent Executions</h3>
              <div className="space-y-2">
                {recentExecs.map(exec => (
                  <div key={exec.id}>
                    <button
                      onClick={() => setExpandedExec(expandedExec === exec.id ? null : exec.id)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
                    >
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded" style={{
                        color: scoreColor(exec.status),
                        backgroundColor: `${scoreColor(exec.status)}20`,
                      }}>
                        {exec.status}
                      </span>
                      <span className="text-xs text-[#f0efe8] flex-1">{exec.agent_id}</span>
                      {exec.duration_ms && <span className="text-[10px] text-[#4a4a55]">{Math.round(exec.duration_ms / 1000)}s</span>}
                      <span className="text-[10px] text-[#4a4a55]">{new Date(exec.created_at).toLocaleString()}</span>
                    </button>
                    {expandedExec === exec.id && (
                      <div className="ml-8 mt-2 mb-3">
                        <div className="text-[10px] text-[#4a4a55] mb-1">Task: {exec.task_description}</div>
                        {exec.error && <div className="text-[10px] text-[#e74c3c] mb-1">Error: {exec.error}</div>}
                        {exec.output && Object.keys(exec.output).length > 0 && (
                          <pre className="bg-[#08080c] border border-[rgba(255,255,255,0.06)] rounded-lg p-3 text-[10px] text-[#7a7a85] overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                            {JSON.stringify(exec.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
