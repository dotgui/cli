import chalk from 'chalk'
import ora, { type Ora } from 'ora'

export const c = {
  dim:     chalk.dim,
  bold:    chalk.bold,
  cyan:    chalk.cyan,
  green:   chalk.green,
  red:     chalk.red,
  yellow:  chalk.yellow,
  white:   chalk.white,
  gray:    chalk.gray,
  magenta: chalk.magenta,
  blue:    chalk.blue,
}

export function header(command: string) {
  console.log(`\n  ${c.bold(c.cyan('◈'))}  ${c.bold(command)}`)
}

export class Progress {
  private spinner: Ora
  private messages: string[]
  private idx = 0
  private interval?: ReturnType<typeof setInterval>
  private startTime = 0
  private currentMsg: string

  constructor(messages: string[]) {
    this.messages = messages
    this.currentMsg = messages[0]
    this.spinner = ora({
      text:   `  ${messages[0]}`,
      color:  'cyan',
      indent: 0,
      stream: process.stderr,
    })
  }

  private elapsed(): string {
    return c.dim(`${Math.floor((Date.now() - this.startTime) / 1000)}s`)
  }

  private render() {
    this.spinner.text = `  ${this.currentMsg}  ${this.elapsed()}`
  }

  start(): this {
    this.startTime = Date.now()
    this.spinner.start()
    // Tick every second so the elapsed counter updates even when idle
    this.interval = setInterval(() => {
      if (this.messages.length > 1) {
        this.idx = (this.idx + 1) % this.messages.length
        this.currentMsg = this.messages[this.idx]
      }
      this.render()
    }, 1000)
    this.render()
    return this
  }

  update(msg: string) {
    this.currentMsg = msg
    this.render()
  }

  /** Seconds elapsed since start, as a plain number. */
  seconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }

  succeed(msg?: string) {
    clearInterval(this.interval)
    const total = c.dim(`${this.seconds()}s`)
    this.spinner.succeed(msg ? `  ${msg}  ${total}` : undefined)
  }

  fail(msg: string) {
    clearInterval(this.interval)
    this.spinner.fail(`  ${c.red(msg)}  ${this.elapsed()}`)
  }

  stop() {
    clearInterval(this.interval)
    this.spinner.stop()
  }
}

export function printPlan(plan: string) {
  console.log()
  for (const line of plan.split('\n')) {
    console.log(`  ${c.dim('│')}  ${line}`)
  }
  console.log()
}


export function printPreview(xml: string, maxLines = 10) {
  console.log()
  const lines = xml.split('\n')
  const shown = lines.slice(0, maxLines)
  for (const line of shown) {
    console.log(`  ${c.dim(line)}`)
  }
  if (lines.length > maxLines) {
    console.log(`  ${c.dim(`… +${lines.length - maxLines} more lines`)}`)
  }
  console.log()
}

export function printDiff(original: string, modified: string) {
  const origLines  = original.split('\n')
  const modLines   = modified.split('\n')
  const origSet    = new Set(origLines)
  const modSet     = new Set(modLines)

  let adds = 0
  let removes = 0

  console.log()
  for (const line of modLines) {
    if (!origSet.has(line)) {
      console.log(`  ${c.green('+')}  ${c.green(line)}`)
      adds++
    }
  }
  for (const line of origLines) {
    if (!modSet.has(line)) {
      console.log(`  ${c.red('-')}  ${c.red(line)}`)
      removes++
    }
  }

  if (adds === 0 && removes === 0) {
    console.log(`  ${c.dim('no changes')}`)
  } else {
    console.log()
    console.log(`  ${c.dim(`+${adds} lines  -${removes} lines`)}`)
  }
  console.log()
}

export function success(msg: string) {
  console.log(`  ${c.green('✓')}  ${msg}`)
}

export function fail(msg: string, code = 1): never {
  console.log(`  ${c.red('✗')}  ${msg}`)
  process.exit(code)
}

export function warn(msg: string) {
  console.log(`  ${c.yellow('!')}  ${msg}`)
}

export function info(msg: string) {
  console.log(`  ${c.dim('·')}  ${c.dim(msg)}`)
}

