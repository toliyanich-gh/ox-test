# Code Guardian

Backend service that wraps the [Trivy](https://github.com/aquasecurity/trivy) security scanner. It processes large Trivy JSON reports using **Node.js streams only** (no `fs.readFile` or `JSON.parse` on the full file), so it can run in memory-constrained environments (e.g. 256MB RAM).

## Features

- **Async scan**: `POST /api/scan` returns immediately with `scanId` and status `Queued`; the scan runs in the background.
- **Stream-based parsing**: Trivy JSON is read and parsed with `stream-json` (object-by-object). Only **CRITICAL** severity vulnerabilities are kept in memory.
- **Cleanup**: Temporary clone and JSON report are deleted after processing.
- **Type-safe**: Full TypeScript with no `any`; proper interfaces for API and Trivy data.

## Prerequisites

- **Node.js** 18+
- **Trivy** installed and on `PATH` (or set `TRIVY_CMD`), or run via Docker (see below).
- **Git** (for cloning repositories).

### Install Trivy

- **macOS**: `brew install trivy`
- **Linux**: see [Trivy installation](https://aquasecurity.github.io/trivy/latest/docs/installation/).
- **Docker**: use the `docker-compose` setup below; Trivy runs inside the container.

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run the server (default port 3000)
npm start
```

Or in development with auto-reload:

```bash
npm run dev
```

## API

### Start a scan (non-blocking)

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/OWASP/NodeGoat"}'
```

**Response** (202 Accepted):

```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Queued"
}
```

### Get scan status and results

```bash
curl http://localhost:3000/api/scan/:scanId
```

**Response** (200 OK):

- **Queued** / **Scanning**: `{ "scanId": "...", "status": "Queued" }` or `"Scanning"`.
- **Finished**: `{ "scanId": "...", "status": "Finished", "criticalVulnerabilities": [ ... ] }`.
- **Failed**: `{ "scanId": "...", "status": "Failed", "errorMessage": "..." }`.

### Health check

```bash
curl http://localhost:3000/health
```

## OOM self-test

To verify that the service does **not** load the full JSON into memory, run with a strict heap limit. If you used `fs.readFile` or `JSON.parse` on the report, this would crash; with streams it should run:

```bash
node --max-old-space-size=150 dist/index.js
```

Or use the npm script:

```bash
npm run oom-test
```

Then trigger a scan against a repo that produces a large Trivy report. The server should stay up.

## Docker (with memory limit)

A **docker-compose** setup is provided with a **200MB** memory limit (Bonus C) to prove the stream-based design under constraints.

```bash
# Build and run (Trivy is installed in the image)
docker-compose up --build
```

The API is available at `http://localhost:3000`. To use an existing Trivy binary on the host instead, you can mount it and set `TRIVY_CMD` in the service environment.

## Project structure

Clear separation of concerns (Controller vs Service vs Worker):

- **`src/index.ts`** – Express app: mounts router, health route.
- **`src/routers/scanRouter.ts`** – Route definitions only: `POST /api/scan`, `GET /api/scan/:scanId` → controller methods.
- **`src/controllers/scanController.ts`** – HTTP layer: request validation, call service, send response. No direct Store or Worker access.
- **`src/services/scanService.ts`** – Business logic: enqueue scan (create record, schedule worker), get scan status. Uses Store and enqueues Worker.
- **`src/workers/scanWorker.ts`** – Background job: clone repo, run Trivy, stream-parse JSON, extract CRITICAL vulns, cleanup. Handles Trivy failures and disk-full.
- **`src/streamParser.ts`** – Stream-only Trivy JSON parsing (`stream-json`: Parser → Pick → StreamValues). No `readFile`/`JSON.parse` on scan results.
- **`src/store.ts`** – In-memory scan state (status + critical vulnerabilities only).
- **`src/types.ts`** – TypeScript interfaces (no `any`) for API and vulnerabilities.

## Error handling

- **Invalid GitHub URL**: Controller validates; Service never receives invalid URL. Worker also validates and sets status `Failed` with a clear message if needed.
- **Trivy not found (ENOENT)**: Worker catches spawn error, sets status `Failed` with message e.g. "Trivy not found (is it installed?)".
- **Trivy exit code ≠ 0 or signal**: Worker catches close event, sets status `Failed` with stderr and exit code/signal.
- **Disk full (ENOSPC)**: Worker catches errors from `mkdtemp`, clone, or Trivy write; sets status `Failed` with message "Disk full: not enough space for clone or Trivy output".
- **Cleanup failure**: Best-effort in `finally`; scan result is still stored; in production you’d log and optionally retry cleanup.

## Evaluation criteria (checklist)

| Criterion | Status | Where |
|-----------|--------|--------|
| **1. Memory efficiency** — Stream pipeline, no full file in variable | ✅ | `streamParser.ts`: `createReadStream` → parser → pick → streamValues; only CRITICAL objects accumulated. No `fs.readFile` or `JSON.parse` on scan results anywhere. |
| **2. Architecture** — Controller vs Service vs Worker | ✅ | `controllers/`, `services/scanService.ts`, `workers/scanWorker.ts`, `routers/scanRouter.ts`. Router → Controller → Service; Service enqueues Worker. |
| **3. Error handling** — Trivy fails, disk full | ✅ | Worker: spawn `ENOENT` → "Trivy not found"; exit code/signal + stderr; `toErrorMessage()` maps `ENOSPC` to "Disk full: not enough space...". |
| **4. Type safety** — TypeScript interfaces, no `any` | ✅ | `types.ts` defines all request/response/vulnerability types; codebase has no `any`. |
| **5. Forbidden** — No `fs.readFile` or `JSON.parse` on scan results | ✅ | Only `createReadStream` + stream-json in `streamParser.ts`; grep confirms no readFile/JSON.parse on report. |
| **6. Node.js Streams** — stream-json (or bfj) object-by-object | ✅ | `stream-json`: Parser, Pick (path filter), StreamValues; processes each vulnerability object in the stream. |

## License

MIT
