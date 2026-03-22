# Neuronium

Local-first AI workspace IDE for working with Git repositories and text files.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
make setup

# Edit .env with your API keys
cp .env.example .env
# Add at least one: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or OPENROUTER_API_KEY
```

### Run

In two separate terminals:

```bash
# Terminal 1: Backend
make backend

# Terminal 2: Frontend
make frontend
```

Open http://localhost:5173

## Architecture

```
Browser (React + Monaco Editor)
    ↕ HTTP
FastAPI (Python)
    ↕
Local filesystem / Git repo + SQLite (metadata only)
    ↕
AI Providers (OpenAI / Anthropic / Google / OpenRouter)
```

### Key Principles
- **Source of truth** = files on disk, not database
- **AI as action engine** — AI operates on documents, not as a standalone chat
- **Controlled changes** — AI returns suggestions, user accepts/rejects
- **Local-first** — everything runs locally, no cloud dependencies beyond AI APIs

## Project Structure

```
backend/
  api/routes/     — FastAPI route handlers
  services/       — Business logic
  providers/      — AI provider adapters
  persistence/    — SQLAlchemy models, DB
  domain/         — Pydantic schemas, enums
  utils/          — Helpers (path security, diff, file types)

frontend/
  src/
    components/   — React components (editor, file-tree, ai-panel, command-bar)
    store/        — Zustand state management
    api/          — API client
    types/        — TypeScript types
```

## Features (MVP)

- Connect local or remote Git repository
- File tree with drag & drop
- Tabbed editor (Monaco) with View/Edit toggle
- AI chat panel (collapsible to command bar)
- AI actions: Rewrite, Summarize, Expand, Structure, etc.
- Suggestion diff overlay with Accept / Reject / Create New File
- Model selector (OpenAI, Anthropic, Google, OpenRouter)
- Session restore on restart
