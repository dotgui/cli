/**
 * Thin fs adapter over @dotgui/kit/package.
 *
 * The .gui zip logic (read/write/edit the container in memory) lives in the kit.
 * This file only adds the bits that touch disk — path-based read/write and the
 * local image cache — which the kit deliberately stays out of.
 */
import { unpack, pack, type GuiPackage } from '@dotgui/kit/package'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

export type { GuiPackage }

const CACHE_DIR = path.join(os.homedir(), '.cache', 'dotgui')
const SWEEP_AGE_MS = 6 * 60 * 60 * 1000 // 6h — kill anything older

/** Read a .gui (ZIP) or a raw .guix file into the in-memory package model. */
export function readPackage(file: string): GuiPackage {
  return unpack(new Uint8Array(readFileSync(file)))
}

/** Repack the package model back into a .gui (ZIP) at `file`. */
export function writePackage(file: string, pkg: GuiPackage): void {
  writeFileSync(file, pack(pkg))
}

/** Remove cache dirs older than the sweep age. Best-effort; never throws. */
export function sweepCache(): void {
  try {
    for (const entry of readdirSync(CACHE_DIR)) {
      const p = path.join(CACHE_DIR, entry)
      try {
        if (Date.now() - statSync(p).mtimeMs > SWEEP_AGE_MS) rmSync(p, { recursive: true, force: true })
      } catch { /* ignore one bad entry */ }
    }
  } catch { /* no cache dir yet */ }
}

/**
 * Write one entry's bytes to a fresh temp file and return its absolute path, so
 * an agent can read the image directly. Lives in the swept cache.
 */
export function extractToTemp(bytes: Uint8Array, name: string): string {
  sweepCache()
  const dir = path.join(CACHE_DIR, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  const out = path.join(dir, path.basename(name))
  writeFileSync(out, bytes)
  return out
}
