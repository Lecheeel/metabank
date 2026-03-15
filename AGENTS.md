# AGENTS.md

## Cursor Cloud specific instructions

### Overview

MetaBank is a full-stack web app (Python FastAPI backend + React/Vite frontend). No database server or external services are needed — data is stored in flat JSON files under `backend/data/` (auto-created on first startup).

### Running services

| Service | Command | Port | Working directory |
|---|---|---|---|
| Backend API | `python3 main.py` | 8000 | `backend/` |
| Frontend dev | `npm run dev -- --host 0.0.0.0` | 5173 | `frontend/` |

Start the backend **before** the frontend — Vite proxies `/api` requests to `localhost:8000`.

### Gotchas

- **bcrypt compatibility**: `passlib` 1.7.4 is incompatible with `bcrypt` >= 4.1. The update script pins `bcrypt<4.1` after installing `requirements.txt`.
- **`~/.local/bin` on PATH**: `pip install --user` places `uvicorn` in `~/.local/bin`. The update script adds this to `PATH` in `~/.bashrc`.
- **`backend/data/` directory**: The `routes/shop.py` module-level init runs before `main.py` creates the `data/` directory. The update script pre-creates it with `mkdir -p backend/data`.
- **Default admin credentials**: `admin` / `admin123` (auto-seeded on first backend startup).
- **Frontend lint**: `npm run lint` reports pre-existing errors (unused vars, hook ordering). These are in the original source and not regressions.
- **No automated tests**: The repository has no test suite. Verification is done via manual testing (API curl / browser).

### Standard commands

See `README.md` for full setup and startup instructions. Key scripts in `frontend/package.json`:
- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build
- `npm run lint` — ESLint
