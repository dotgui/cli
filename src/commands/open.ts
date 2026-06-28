import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import os from 'os'
import path from 'path'
import { info, success, warn, fail } from '../lib/ui.js'

const execFileAsync = promisify(execFile)

const APP_PATHS = [
  '/Applications/dotgui.app',
  '/Applications/GUI.app',
  path.join(os.homedir(), 'Applications/dotgui.app'),
  path.join(os.homedir(), 'Applications/GUI.app'),
]

export async function openCommand(file: string) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
  if (!existsSync(abs)) fail(`file not found: ${file}`, 2)

  const appPath = APP_PATHS.find((p) => existsSync(p))
  if (appPath) {
    try {
      await execFileAsync('open', ['-a', appPath, abs])
      success('opened in dotgui app')
      return
    } catch { /* fall through to browser */ }
  }

  const url = `https://app.dotgui.co/preview?file=${encodeURIComponent(path.basename(abs))}`
  warn('dotgui app not installed — opening browser preview')
  info(`url: ${url}`)
  try {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    await execFileAsync(opener, [url])
  } catch {
    info('could not open a browser automatically — copy the URL above')
  }
}
