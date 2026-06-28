/**
 * Deterministic .gui operations — no AI. Each command treats the .gui like a
 * folder, doing zip/unzip in memory via lib/package.ts.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import path from 'path'
import { readPackage, writePackage, extractToTemp, type GuiPackage } from '../lib/package.js'
import { lintMarkup, type LintIssue } from '@dotgui/kit/lint'
import { autofixMarkup } from '@dotgui/kit/autofix'
import { rasterize } from '@dotgui/kit/rasterize'
import { success, fail, warn, c } from '../lib/ui.js'

function resolve(file: string): string {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
  if (!existsSync(abs)) fail(`file not found: ${file}`, 2)
  return abs
}

function readStdin(): Promise<string> {
  return new Promise((res) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (d) => (data += d))
    process.stdin.on('end', () => res(data))
  })
}

function guiName(xml: string): string {
  return xml.match(/<gui\b[^>]*\bname="([^"]*)"/)?.[1] ?? '(unnamed)'
}

function printIssues(issues: LintIssue[]) {
  for (const i of issues) {
    const tag = i.level === 'error' ? c.red('ERROR') : c.yellow('warn ')
    const loc = i.where ? c.dim(`[${i.where}] `) : ''
    console.log(`  ${tag} ${loc}${i.message}`)
  }
}

// ── read ──────────────────────────────────────────────────────────────────────
export async function readCommand(
  file: string,
  opts: { assets?: boolean; preview?: boolean; asset?: string; json?: boolean },
) {
  const pkg = readPackage(resolve(file))

  if (opts.assets) {
    const list = Object.entries(pkg.assets).map(([name, data]) => ({ name, bytes: data.length }))
    if (opts.json) { console.log(JSON.stringify(list, null, 2)); return }
    if (list.length === 0) { console.log(c.dim('  (no assets)')); return }
    for (const a of list) console.log(`  ${a.name}  ${c.dim(`${a.bytes} B`)}`)
    return
  }

  if (opts.preview) {
    if (!pkg.preview) fail('no preview in this package', 2)
    console.log(extractToTemp(pkg.preview!, 'preview.webp'))
    return
  }

  if (opts.asset) {
    const key = opts.asset.startsWith('assets/') ? opts.asset : `assets/${opts.asset}`
    const data = pkg.assets[key]
    if (!data) fail(`asset not found: ${opts.asset}`, 2)
    console.log(extractToTemp(data, key))
    return
  }

  process.stdout.write(pkg.xml)
}

// ── write ───────────────────────────────────────────────────────────────────--
export async function writeCommand(file: string, opts: { noPreview?: boolean; json?: boolean }) {
  const xml = (await readStdin()).trim()
  if (!xml.startsWith('<gui')) fail('stdin is not a <gui> markup document', 2)

  const result = lintMarkup(xml)
  if (!result.ok) {
    if (opts.json) { console.log(JSON.stringify(result.errors)); }
    else { console.log(c.red(`  ${result.errors.length} lint error(s) — not written:`)); printIssues(result.errors) }
    process.exit(1)
  }

  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
  const pkg: GuiPackage = existsSync(abs) ? readPackage(abs) : { xml: '', assets: {} }
  pkg.xml = xml

  // Regenerate the preview from the new markup. Soft: if no Chromium browser is
  // installed we keep the old preview and move on (never block a write on it).
  let previewNote = ''
  if (!opts.noPreview) {
    const res = await rasterize(pkg, { format: 'webp' })
    if (res.image) { pkg.preview = res.image; previewNote = ' · preview updated' }
    else if (res.reason === 'no-browser') previewNote = ' · preview skipped (no browser)'
  }

  writePackage(abs, pkg)
  if (!opts.json) {
    const warns = result.issues.filter((i) => i.level === 'warn')
    success(`wrote ${c.bold(path.basename(abs))}${warns.length ? c.dim(` · ${warns.length} warning(s)`) : ' · lint clean'}${c.dim(previewNote)}`)
    if (warns.length) printIssues(warns)
  }
}

// ── lint ───────────────────────────────────────────────────────────────────---
export async function lintCommand(file: string, opts: { fix?: boolean; json?: boolean }) {
  const abs = resolve(file)
  const pkg = readPackage(abs)

  if (opts.fix) {
    const fixed = autofixMarkup(pkg.xml)
    if (fixed.fixes.length > 0) {
      pkg.xml = fixed.xml
      writePackage(abs, pkg)
      if (!opts.json) { success(`autofixed ${fixed.fixes.length} issue(s)`); for (const f of fixed.fixes) console.log(`  ${c.dim('·')} ${f}`) }
    } else if (!opts.json) {
      console.log(c.dim('  nothing to autofix'))
    }
  }

  const result = lintMarkup(pkg.xml)
  if (!result.ran) { warn('linter not found — skipped'); return }

  if (opts.json) { console.log(JSON.stringify(result.issues, null, 2)) }
  else if (result.issues.length === 0) { success('lint clean') }
  else { printIssues(result.issues); console.log(c.dim(`  ${result.errors.length} error(s), ${result.issues.length - result.errors.length} warning(s)`)) }

  if (!result.ok) process.exit(1)
}

// ── add / rm / set-preview ──────────────────────────────────────────────────--
export async function addCommand(file: string, asset: string, asName: string | undefined) {
  const abs = resolve(file)
  const pkg = readPackage(abs)
  const bytes = new Uint8Array(readFileSync(resolve(asset)))
  const name = asName ?? path.basename(asset)
  const key = name.startsWith('assets/') ? name : `assets/${name}`
  pkg.assets[key] = bytes
  writePackage(abs, pkg)
  success(`added ${c.bold(key)}  ${c.dim(`${bytes.length} B`)}`)
}

export async function rmCommand(file: string, name: string) {
  const abs = resolve(file)
  const pkg = readPackage(abs)
  const key = name.startsWith('assets/') ? name : `assets/${name}`
  if (!pkg.assets[key]) fail(`asset not found: ${name}`, 2)
  delete pkg.assets[key]
  writePackage(abs, pkg)
  success(`removed ${c.bold(key)}`)
}

export async function setPreviewCommand(file: string, img: string) {
  const abs = resolve(file)
  const pkg = readPackage(abs)
  pkg.preview = new Uint8Array(readFileSync(resolve(img)))
  writePackage(abs, pkg)
  success(`preview set from ${c.bold(path.basename(img))}`)
}

// ── info ──────────────────────────────────────────────────────────────────────
export async function infoCommand(file: string, opts: { json?: boolean }) {
  const pkg = readPackage(resolve(file))
  // The root layout is the first layout node AFTER the metadata blocks — skip
  // past components/styles/fonts/tokens so we don't match a node inside them.
  const afterMeta = (() => {
    let i = 0
    for (const close of ['</components>', '</fonts>', '</styles>', '</tokens>']) {
      i = Math.max(i, pkg.xml.lastIndexOf(close) + close.length)
    }
    return pkg.xml.slice(i)
  })()
  const root = afterMeta.match(/<(frame|col|row|grid|stack)\b[^>]*>/)?.[0] ?? ''
  const w = root.match(/\bw="([^"]*)"/)?.[1]
  const h = root.match(/\bh="([^"]*)"/)?.[1]
  const meta = {
    name: guiName(pkg.xml),
    root: root.match(/<(\w+)/)?.[1],
    width: w, height: h,
    assets: Object.keys(pkg.assets),
    hasPreview: !!pkg.preview,
  }
  if (opts.json) { console.log(JSON.stringify(meta, null, 2)); return }
  console.log(`  ${c.bold(meta.name)}`)
  console.log(`  root      ${c.dim(`${meta.root ?? '?'}  ${w ?? '?'}×${h ?? '?'}`)}`)
  console.log(`  assets    ${c.dim(String(meta.assets.length))}`)
  console.log(`  preview   ${c.dim(meta.hasPreview ? 'yes' : 'no')}`)
}

// ── pack / unpack (humans) ──────────────────────────────────────────────────--
export async function packCommand(dir: string, file: string) {
  const src = resolve(dir)
  const guix = readdirSync(src).find((f) => f.endsWith('.guix'))
  if (!guix) fail(`no .guix file in ${dir}`, 2)
  const pkg: GuiPackage = { xml: readFileSync(path.join(src, guix!), 'utf-8'), assets: {} }

  const assetsDir = path.join(src, 'assets')
  if (existsSync(assetsDir)) {
    for (const f of readdirSync(assetsDir)) pkg.assets[`assets/${f}`] = new Uint8Array(readFileSync(path.join(assetsDir, f)))
  }
  const prev = path.join(src, 'preview.webp')
  if (existsSync(prev)) pkg.preview = new Uint8Array(readFileSync(prev))

  const result = lintMarkup(pkg.xml)
  if (!result.ok) { console.log(c.red('  lint errors — not packed:')); printIssues(result.errors); process.exit(1) }

  const out = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
  writePackage(out, pkg)
  success(`packed ${c.bold(path.basename(out))}`)
}

export async function unpackCommand(file: string, dir: string) {
  const pkg = readPackage(resolve(file))
  const out = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
  mkdirSync(out, { recursive: true })
  writeFileSync(path.join(out, 'design.guix'), pkg.xml, 'utf-8')
  if (pkg.preview) writeFileSync(path.join(out, 'preview.webp'), pkg.preview)
  if (Object.keys(pkg.assets).length) {
    mkdirSync(path.join(out, 'assets'), { recursive: true })
    for (const [name, data] of Object.entries(pkg.assets)) writeFileSync(path.join(out, name), data)
  }
  success(`unpacked to ${c.bold(path.relative(process.cwd(), out) || '.')}`)
}
