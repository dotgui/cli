import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { readPackage } from '../lib/package.js'
import { rasterize } from '@dotgui/kit/rasterize'
import { success, fail, info } from '../lib/ui.js'

/** `gui render` — rasterize a .gui to an image with the Rust renderer (@dotgui/render). */
export async function renderCommand(file: string, opts: { out?: string }) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
  if (!existsSync(abs)) fail(`file not found: ${file}`, 2)
  const pkg = readPackage(abs)

  const out = opts.out
    ? path.resolve(process.cwd(), opts.out)
    : abs.replace(/\.(gui|guix)$/i, '') + '.png'
  const format = /\.webp$/i.test(out) ? 'webp' : /\.jpe?g$/i.test(out) ? 'jpeg' : 'png'

  info('rendering…')
  const res = await rasterize(pkg, { format })
  if (!res.image) {
    if (res.reason === 'no-renderer') fail('@dotgui/render could not be loaded — reinstall @dotgui/cli', 2)
    fail(`render failed${res.error ? `: ${res.error}` : ''}`, 1)
  }
  writeFileSync(out, res.image!)
  success(`rendered ${path.relative(process.cwd(), out)}`)
}
