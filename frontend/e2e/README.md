# E2E tests (Playwright)

We use Playwright for end-to-end tests ([#255](https://github.com/WAYWO-capstone/WAYWO/discussions/255)). 
It opens the app in a real browser and clicks like a user would.

- Unit tests (Vitest) go in `frontend/tests/` and end in `.test.ts`
- E2E tests (Playwright) go in `frontend/e2e/` and end in `.spec.ts`

## Setup (once)

You need **Node.js 22.15+**. Check with `node --version`, or get the LTS from [nodejs.org](https://nodejs.org/).

```bash
cd frontend
bun i
bun run e2e:install
```

Then check that it works:

```bash
bun run test:e2e
```

All tests should pass. No need to start `bun dev`

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
Look at `login.spec.ts` for an example, including how to fake the backend if needded so tests run without it.

## Troubleshoot

- **"Executable doesn't exist"**: run `bun run e2e:install`
- **Port 5173 is busy**: close whatever is using it and try again