#!/usr/bin/env node
import { Command } from 'commander'
import { sweepCache } from './lib/package.js'
import {
  readCommand, writeCommand, lintCommand,
  addCommand, rmCommand, setPreviewCommand,
  infoCommand, packCommand, unpackCommand,
} from './commands/ops.js'
import { openCommand } from './commands/open.js'
import { renderCommand } from './commands/render.js'
import { setupCommand, skillCommand } from './commands/setup.js'

const VERSION = '0.2.0'

// Best-effort cleanup of any stray extract dirs from a crashed run.
sweepCache()

const program = new Command()
program
  .name('gui')
  .description('dotgui toolchain — read, edit, lint, render, and package .gui files')
  .version(VERSION, '-v, --version')

// ── Edit markup ──────────────────────────────────────────────────────────────
program
  .command('read <file>')
  .description('print the markup (or --assets / --preview / --asset to look inside)')
  .option('--assets', 'list asset names and sizes')
  .option('--preview', 'extract the preview, print a viewable path')
  .option('--asset <name>', 'extract one asset, print a viewable path')
  .option('--json', 'machine-readable output')
  .action((file, opts) => readCommand(file, opts))

program
  .command('write <file>')
  .description('read markup from stdin → lint → repack (throws on lint error)')
  .option('--no-preview', 'skip preview regeneration')
  .option('--json', 'machine-readable output')
  .action((file, opts) => writeCommand(file, opts))

// ── Check ──────────────────────────────────────────────────────────────────--
program
  .command('lint <file>')
  .description('validate the markup (non-zero exit on errors)')
  .option('--fix', 'apply deterministic autofix and write back')
  .option('--json', 'machine-readable output')
  .action((file, opts) => lintCommand(file, opts))

// ── Assets & preview ─────────────────────────────────────────────────────────
program
  .command('add <file> <asset> [as] [name]')
  .description('add an asset (use: gui add app.gui logo.png as brand.png)')
  .action((file, asset, _as, name) => addCommand(file, asset, name))

program
  .command('rm <file> <name>')
  .description('remove an asset')
  .action((file, name) => rmCommand(file, name))

program
  .command('set-preview <file> <image>')
  .description('replace the preview')
  .action((file, image) => setPreviewCommand(file, image))

// ── Inspect / view ───────────────────────────────────────────────────────────
program
  .command('info <file>')
  .description('name, root canvas, asset list, preview')
  .option('--json', 'machine-readable output')
  .action((file, opts) => infoCommand(file, opts))

program
  .command('render <file>')
  .description('rasterize to an image')
  .option('-o, --out <path>', 'output image path')
  .action((file, opts) => renderCommand(file, opts))

program
  .command('open <file>')
  .description('open in the dotgui viewer')
  .action((file) => openCommand(file))

// ── Packaging (humans) ───────────────────────────────────────────────────────
program
  .command('pack <dir> <file>')
  .description('bundle a markup+assets folder into a .gui')
  .action((dir, file) => packCommand(dir, file))

program
  .command('unpack <file> <dir>')
  .description('extract a .gui into a folder')
  .action((file, dir) => unpackCommand(file, dir))

// ── Setup ──────────────────────────────────────────────────────────────────--
program
  .command('setup')
  .description('install the dotgui skill into detected agents + allowlist `gui`')
  .action(() => setupCommand())

program
  .command('skill [sub]')
  .description('skill management: where | update')
  .action((sub) => skillCommand(sub))

program.parseAsync()
