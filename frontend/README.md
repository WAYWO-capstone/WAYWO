# Frontend

The frontend uses React + Typescript + Vite.
Package management/bundling is handled using [Bun.js](https://bun.com/). [Installation steps](https://bun.com/docs/installation)

## Running instructions

1. Download **bun**: [installation steps](https://bun.com/docs/installation)
2. Install dependencies by running `bun install`.
3. Run the frontend with `bun dev`.

## API Types

The frontend's API models (`frontend/src/api/models.ts`) come from the backend's OpenAPI schema. After changing a backend schema or route, regenerate them and commit the result. CI fails if they are out of date.

From the frontend, with the backend virtual environment active:

```bash
bun run api:sync
```

This runs both steps: `python -m scripts.export_openapi` in the backend, then `bun run api:types` in the frontend. It updates `frontend/openapi.json` and `frontend/src/api/schema.gen.ts`. Do not edit either file by hand.

API calls in `frontend/src/api/` use [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) with these types, so a renamed route, wrong method, missing parameter or invalid body is a TypeScript error after regenerating.

## Adding new dependencies

When adding new dependencies, please don't forget to first set your terminal's directory to `/frontend` by running `cd frontend`. Once this is done, you can add dependencies with `bun add`.
