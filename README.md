# @dotgui/cli

The command-line toolchain for the dotgui format. `gui` reads, edits, validates, renders, and packages `.gui` files — and installs the dotgui **skill** into the AI tools you already use.

```
npm i -g @dotgui/cli
gui setup
```

---

## Mental model

**`gui` does not contain an AI.** It is a fast, deterministic tool for working with `.gui` files: lint, autofix, render, package. That's it.

The *design generation* happens in **your own agent** — Claude Code, Gemini CLI, Cursor, Codex, whatever you already use. `gui setup` installs the dotgui skill into those tools, so when you ask one to "make a stocks app in gui," it knows the format, writes the markup, and calls `gui` to validate and package the result.

Why this split: a real agent — warm session, your best model, full tool-calling and vision — produces better UIs than anything a CLI could wrap around a model. So the CLI doesn't try. It owns the one thing only it can do perfectly: keep `.gui` files **valid**.

```
You ──ask──▶ your agent ──uses──▶ dotgui skill ──calls──▶ gui (this tool)
                                                            └─ lint · autofix · render · package
```

---

## What a `.gui` is

A `.gui` is a **zip package**:

```
app.gui
├── design.guix     # the markup (XML)
├── assets/         # images, SVGs
└── preview.webp    # rendered thumbnail
```

You never unzip it by hand. `gui` treats a `.gui` like a folder — read the markup, list assets, add or remove an asset — and does the unzip/rezip for you in an **ephemeral shadow directory** that is created and deleted within each command. Nothing is left on disk.

---

## Commands

### Edit the markup

```bash
gui read  app.gui            # print the markup
gui write app.gui            # read markup from stdin → lint → repack → regenerate preview
```

`gui write` is the save step: it lints, **exits non-zero with the errors** if the markup is invalid (nothing is written), and on success repacks the zip and regenerates `preview.webp` so it always matches. Pass `--no-preview` to skip the render for speed.

### Assets & preview (folder-like)

```bash
gui read app.gui --assets            # list asset names + sizes
gui read app.gui --preview           # extract preview, print a viewable path
gui read app.gui --asset hero.webp   # extract one asset, print a viewable path
gui add app.gui logo.png [as brand.png]
gui rm  app.gui assets/old.webp
gui set-preview app.gui shot.webp
```

`--preview` and `--asset` return a **file path** (in the shadow cache) so your agent can open the image with its own vision. Lists are printed as text.

### Check

```bash
gui lint app.gui            # validate only
gui lint app.gui --fix      # apply deterministic autofix, write back
```

### View

```bash
gui render app.gui -o out.png   # rasterize to an image (PNG/WEBP/JPEG by extension)
gui open   app.gui              # open in the dotgui viewer
```

`render` (and the preview that `gui write` regenerates) draws with the dotgui
renderer — Rust, compiled to WebAssembly, installed with the CLI. No browser. It
reads your installed fonts and fetches Google fonts and remote images. If a
document cannot be drawn, `render` says why and `gui write` simply skips the
preview rather than blocking the save.

### Inspect

```bash
gui info app.gui            # name, platform, asset list, dimensions
```

### Packaging (for humans — agents never need these)

```bash
gui pack   ./my-design app.gui   # a markup+assets folder → .gui
gui unpack app.gui ./my-design   # .gui → a real folder you can edit
```

### Setup

```bash
gui setup                   # install the skill into detected agents + allowlist `gui`
gui skill where             # show where the skill is installed
gui skill update            # refresh the skill after an upgrade
gui --version
gui help
```

---

## `gui setup`

Run once after install. It:

1. Detects installed agents (Claude Code, Gemini CLI / Antigravity, …).
2. Installs the dotgui skill into each one's discovery location (e.g. `~/.claude/skills/dotgui/`, the global Gemini skills dir).
3. Allowlists the `gui` command so the agent runs it **without permission prompts**.

It asks for one confirmation; it does not write anything silently. For agents without a skill model, it prints the snippet to add manually.

After setup, ask any of those tools for a UI "in gui" and it builds it — picking the skill automatically.

---

## Behaviors

- **Ephemeral shadow dir** — every asset/markup command unzips → changes → rezips → **deletes** the working dir before exiting. No leftover folders.
- **Self-cleaning** — the shadow dir lives in one fixed cache (`~/.cache/dotgui/`); on startup `gui` sweeps any stray dir older than a few hours, so a crashed command can't litter your filesystem.
- **Lint gates everything** — `write`, `add`, `set-preview`, and `pack` all lint before committing. Invalid markup never gets packaged; the command exits non-zero with structured errors.
- **Preview stays in sync** — `gui write` regenerates `preview.webp` on every successful save.

---

## Conventions

| Flag | Meaning |
|------|---------|
| `--json` | machine-readable output and errors (for agents) |
| `--fix` | apply deterministic autofix and write back |
| `-o, --out <path>` | output path |
| `--no-preview` | skip preview regeneration on write |
| `--quiet` | suppress non-essential output |

**Exit codes:** `0` success · `1` lint/validation error · `2` bad input or missing file · `3` user cancelled.

---

## Roadmap

- `gui mount app.gui` — a live folder that auto-syncs back into the zip (the only persistent mode; cleans up on unmount).
- `gui diff a.gui b.gui` — structural diff.
- `gui pull <figma-url>` / `gui push app.gui <figma-url>` — Figma round-trip.
