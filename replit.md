# JARVIS AI Assistant

A commercial-grade, Iron Man-inspired AI voice assistant for complete computer control — with local AI, HWID licensing, analytics, and GitHub Actions builds for Windows .exe / macOS .dmg / Linux AppImage.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/jarvis-ui run dev` — run the JARVIS UI (port 22829)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (artifacts/api-server)
- UI: React + Vite + Tailwind + framer-motion + recharts (artifacts/jarvis-ui)
- Desktop: Electron (electron/) wrapping the UI + Python FastAPI native core
- Python: FastAPI core (desktop/core/main.py) — HWID, Ollama, voice pipeline
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle for API), PyInstaller + electron-builder for .exe

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/index.ts` — DB schema (memory, tasks, activity, settings, license, apps)
- `artifacts/api-server/src/routes/` — Express route handlers (license, voice, memory, apps, stats, settings)
- `artifacts/jarvis-ui/src/` — React UI (pages: HQ, Memory, Apps, Stats, Settings, License)
- `desktop/core/main.py` — Python native API (FastAPI, HWID, Ollama, voice, psutil)
- `desktop/core/voice_engine.py` — STT (Whisper) + TTS (Piper) + wake word (Porcupine) + voice cloning
- `desktop/config/config.json` — User configuration file
- `desktop/requirements.txt` — Python dependencies
- `electron/src/main.ts` — Electron main process (window, tray, IPC, Python spawn)
- `.github/workflows/build-release.yml` — GitHub Actions: tag → .exe + .dmg + AppImage release
- `.github/workflows/dev-build.yml` — CI typecheck on every push

## Architecture decisions

- HWID generated from platform-specific hardware info (SHA-256), stored in `~/.jarvis/license.json`
- License key format: `JARVIS-XXXX-XXXX-XXXX` (trial) or `JARVIS-PERM-XXXX-XXXX` (permanent)
- All AI runs locally via Ollama at `http://127.0.0.1:11434` — zero cloud dependency
- Voice pipeline: Porcupine wake word → Whisper STT → Ollama LLM → Piper TTS (all local)
- Electron spawns Python core as a child process; both communicate via HTTP on localhost:8765
- GitHub Actions builds .exe on tag push (Windows/macOS/Linux in parallel)

## Product

JARVIS provides:
- Premium Iron Man-style dark UI with glassmorphism, neon cyan glows, and cinematic animations
- Voice orb with idle-pulse / listening-wave animations connected to real voice status API
- Full computer control by voice (launch apps, query time, set reminders, search)
- Long-term memory: stores user preferences, goals, tasks with importance ratings
- YouTube + TikTok analytics dashboard with real API integration
- License system: 30-day trial or permanent, HWID-bound, validated on startup
- Skills/plugin panel for MCP integrations (Notion, GitHub, Discord, Google, Home Assistant)
- GitHub Actions builds distributable .exe/.dmg/.AppImage on git tag push

## User preferences

- Language: Russian/English bilingual support
- Dark mode only, no light mode toggle needed
- Commercial product targeting creators and power users

## Gotchas

- Ollama must be installed locally (`ollama pull llama3:8b`) for AI responses
- Piper TTS binary must be downloaded separately (see SETUP.md)
- Porcupine wake word requires a free API key from picovoice.ai
- GitHub Actions .exe build requires `GITHUB_TOKEN` secret (auto-provided by GitHub)
- Demo license key for testing: `JARVIS-DEMO-TEST-2024`

## Pointers

- See `SETUP.md` for full installation instructions including YouTube/TikTok API setup
- See `.github/workflows/build-release.yml` for the full .exe build pipeline
- See `pnpm-workspace` skill for workspace structure details
