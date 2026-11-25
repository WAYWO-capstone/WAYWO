# E2E tests (Playwright)

We use Playwright for end-to-end tests ([#255](https://github.com/WAYWO-capstone/WAYWO/discussions/255)). 
It opens the app in a real browser and clicks like a user would.

- Unit tests (Vitest) go in `frontend/tests/` and end in `.test.ts`
- E2E tests (Playwright) go in `frontend/e2e/` and end in `.spec.ts`

## Setup (once)

`bun run test:e2e` starts **both** the backend (`uvicorn` on port 8000) and the frontend (Vite on port 5173) for you, so the backend has to be ready to run.

### 1. Backend

Follow the backend steps in the [root README](../../README.md#backend-setup) first. You need:

1. **Postgres running**, with a database for WAYWO (e.g. `waywo`).
2. **`backend/.env` filled in.** See `backend/.env.example`.
3. **Migrations applied.** From `backend/`, run:

   ```bash
   alembic upgrade head
   ```

4. **Python dependencies installed** in your virtual environment (`pip install -r requirements.txt`).

Playwright runs `uvicorn` from `backend/`, so **activate your backend virtual environment in the same terminal** before you run the tests. Otherwise you'll get `uvicorn: command not found`.

### 2. Frontend

You need **Node.js 22.15+**. Check with `node --version`, or get the LTS from [nodejs.org](https://nodejs.org/).

```bash
cd frontend
bun i
bun run e2e:install
```

### 3. Check that it works

With the backend venv active and Postgres running:

```bash
cd frontend
bun run test:e2e
```

All tests should pass. No need to start `bun dev` or `uvicorn` yourself. If either is already running on its port, Playwright reuses it.

## Useful commands

Run these from `frontend/`:

| Command | What it does |
|---|---|
| `bun run test:e2e` | Run all tests |
| `bun run test:e2e:ui` | Open the visual mode, great for writing and debugging |
| `bun run test:e2e:report` | See the report of the last run |
| `bun run test:e2e e2e/login.spec.ts` | Run one file |

## Writing a test

Add a file in `frontend/e2e/`, like `create-project.spec.ts`. 
Look at `login.spec.ts` for an example, including how to fake a backend response with `page.route` when a test needs specific data.

## Troubleshoot

- **"Executable doesn't exist"**: run `bun run e2e:install`
- **Port 5173 is busy**: close whatever is using it and try again
- **`uvicorn: command not found`**: activate the backend virtual environment, then run the tests again
- **Timed out waiting for `http://localhost:8000/database-test`**: the backend can't reach Postgres. Check that Postgres is running and that `DATABASE_URL` in `backend/.env` is correct
- **Errors about missing tables or columns**: run `alembic upgrade head` from `backend/`