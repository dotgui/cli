/**
 * `gui setup` — install the dotgui skill into the AI agents on this machine.
 * Follows the skills.sh convention: every agent is just a global skills
 * directory you copy the skill into (no per-agent CLI calls). Detects the
 * agents present, lets you pick, copies the skill into each, and additionally
 * allowlists `gui` for Claude Code. Deterministic, no AI.
 */
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { checkbox } from '@inquirer/prompts'
import { success, fail, warn, info, c } from '../lib/ui.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = os.homedir()

// Locate the bundled skill source (gui-skills/) — walk up like the linter does.
function resolveSkillSrc(): string | null {
  let dir = HERE
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'gui-skills')
    if (existsSync(path.join(candidate, 'skill.md'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

const SKIP = new Set(['scripts', '__pycache__', '.DS_Store'])
function copyTree(src: string, dst: string) {
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src)) {
    if (SKIP.has(entry)) continue
    const s = path.join(src, entry)
    const d = path.join(dst, entry)
    if (statSync(s).isDirectory()) copyTree(s, d)
    else copyFileSync(s, d)
  }
}

// ── Agent registry (paths per skills.sh / vercel-labs/skills) ─────────────────
// `root` = a dir whose presence means the agent is installed.
// `skills` = the global skills dir to copy into.
interface Agent {
  id: string
  label: string
  root: string
  skills: string
  allowlist?: boolean // Claude: add Bash(gui:*) to settings.json
}

const AGENTS: Agent[] = [
  { id: 'claude',      label: 'Claude Code', root: path.join(HOME, '.claude'),                 skills: path.join(HOME, '.claude', 'skills'),                 allowlist: true },
  { id: 'gemini',      label: 'Gemini CLI',  root: path.join(HOME, '.gemini'),                 skills: path.join(HOME, '.gemini', 'skills') },
  { id: 'antigravity', label: 'Antigravity', root: path.join(HOME, '.gemini', 'antigravity'),  skills: path.join(HOME, '.gemini', 'antigravity', 'skills') },
  { id: 'codex',       label: 'Codex',       root: path.join(HOME, '.codex'),                  skills: path.join(HOME, '.codex', 'skills') },
  { id: 'cursor',      label: 'Cursor',      root: path.join(HOME, '.cursor'),                 skills: path.join(HOME, '.cursor', 'skills') },
]

function allowGuiInClaude() {
  const settingsPath = path.join(HOME, '.claude', 'settings.json')
  let json: any = {}
  if (existsSync(settingsPath)) { try { json = JSON.parse(readFileSync(settingsPath, 'utf-8')) } catch { json = {} } }
  json.permissions ??= {}
  json.permissions.allow ??= []
  if (!json.permissions.allow.includes('Bash(gui:*)')) json.permissions.allow.push('Bash(gui:*)')
  writeFileSync(settingsPath, JSON.stringify(json, null, 2))
}

function installAgent(agent: Agent, skillSrc: string): string {
  const dst = path.join(agent.skills, 'dotgui')
  rmSync(dst, { recursive: true, force: true }) // replace cleanly — no stale orphans
  copyTree(skillSrc, dst)
  if (agent.allowlist) { allowGuiInClaude(); return `${rel(dst)} + allowlisted Bash(gui:*)` }
  return rel(dst)
}

function rel(p: string): string {
  return p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p
}

// ── Command ──────────────────────────────────────────────────────────────────
export async function setupCommand() {
  const skillSrc = resolveSkillSrc()
  if (!skillSrc) fail('skill source (gui-skills/) not found near the CLI', 2)

  const detected = AGENTS.filter((a) => existsSync(a.root))
  if (detected.length === 0) {
    warn('no supported agent detected')
    info(`install manually by copying the skill into your agent's skills dir: ${path.join(skillSrc!, '..')}`)
    return
  }

  const chosen = await checkbox({
    message: 'Install the dotgui skill for which agents?',
    choices: detected.map((a) => ({ name: a.label, value: a.id, checked: true })),
  })
  if (chosen.length === 0) { warn('nothing selected'); return }

  console.log()
  for (const id of chosen) {
    const agent = AGENTS.find((a) => a.id === id)!
    try {
      const detail = installAgent(agent, skillSrc!)
      success(`${agent.label}  ${c.dim(detail)}`)
    } catch (e: any) {
      warn(`${agent.label}: ${e.message}`)
    }
  }
  console.log()
  console.log(`  ${c.dim('Ask your agent for a UI "in gui" — it picks the skill automatically.')}`)
}

export async function skillCommand(sub: string | undefined) {
  if (sub === 'update') return setupCommand()
  // default / "where" — show every agent the skill is installed into.
  let any = false
  for (const a of AGENTS) {
    const dst = path.join(a.skills, 'dotgui')
    if (existsSync(dst)) { console.log(`  ${a.label.padEnd(14)} ${c.dim(rel(dst))}`); any = true }
  }
  if (!any) warn('skill not installed anywhere — run `gui setup`')
}
