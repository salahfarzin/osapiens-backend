# Copilot Instructions — osapiens Backend

## Project Overview
**Backend Coding Challenge** — Node.js + TypeScript backend service demonstrating asynchronous task/workflow execution. Runs on Express, persists data with TypeORM + SQLite, and processes geospatial workflows via an in-process polling worker.

## Stack
- **Runtime**: Node.js with TypeScript (`ts-node` for dev, `tsc` compiles to `dist/`)
- **Framework**: Express 4
- **ORM**: TypeORM 0.3 with SQLite (`data/database.sqlite`)
- **Geospatial**: `@turf/turf` (specifically `boolean-within`) + `world_data.json` country polygons
- **YAML parsing**: `js-yaml`
- **Auth libs installed but unused**: `bcrypt`, `jsonwebtoken`

## Architecture

### Entry Point
`src/index.ts` — initializes DB, starts `taskWorker()`, listens on port 3000.

### Routes
- `POST /analysis` — accepts `{ clientId, geoJson }`, creates a Workflow from `src/workflows/example_workflow.yml`
- `GET /` — renders `README.md` as dark-mode HTML

### Domain Model
```
Workflow (1) ──── (*) Task ──── (1) Result
```
- **Workflow**: `workflowId`, `clientId`, `status` (initial → in_progress → completed/failed)
- **Task**: `taskId`, `clientId`, `geoJson`, `status` (queued/in_progress/completed/failed), `taskType`, `stepNumber`, FK → Workflow
- **Result**: `resultId`, `taskId`, `data` (serialized JSON output)

### Workflow Engine
`WorkflowFactory.createWorkflowFromYAML()` reads a YAML definition and creates one `Workflow` + one `Task` per step. All tasks are queued immediately (no sequential gating by `stepNumber` yet).

### Task Processing
- `taskWorker.ts` — infinite polling loop (5s interval), picks the first `queued` task
- `taskRunner.ts` — runs the job, saves a `Result`, updates task and workflow statuses

### Job System (Strategy Pattern)
```
Job (interface: run(task): Promise<any>)
├── DataAnalysisJob   → taskType: "analysis"  — turf boolean-within against world_data.json
└── EmailNotificationJob → taskType: "notification" — stub, 500ms delay
```
`JobFactory` maps `taskType` string → Job instance via a `Record<string, () => Job>`.

## Key Files
| File | Role |
|---|---|
| `src/index.ts` | App bootstrap |
| `src/data-source.ts` | TypeORM DataSource config |
| `src/routes/analysisRoutes.ts` | POST /analysis handler |
| `src/workflows/WorkflowFactory.ts` | YAML → Workflow + Tasks |
| `src/workflows/example_workflow.yml` | Default 2-step workflow definition |
| `src/workers/taskWorker.ts` | Polling loop |
| `src/workers/taskRunner.ts` | Job execution + status management |
| `src/jobs/JobFactory.ts` | taskType → Job mapping |
| `src/jobs/DataAnalysisJob.ts` | Geospatial country detection |
| `src/jobs/EmailNotificationJob.ts` | Notification stub |
| `src/models/` | TypeORM entities (Task, Workflow, Result) |
| `src/data/world_data.json` | GeoJSON country polygons |

## Known Issues / Gaps
1. **`dropSchema: true`** in `data-source.ts` — DB is wiped on every restart (dev only, must be removed for production)
2. **No step ordering** — `stepNumber` is persisted but tasks are not executed in order; all are queued at once
3. **No auth middleware** — `bcrypt`/`jsonwebtoken` are installed but no routes are protected
4. **No tests** — no test framework configured
5. **Single-process polling worker** — no dedicated queue (Bull/BullMQ); not horizontally scalable as-is

## Dev Commands
```bash
npm start       # ts-node src/index.ts
npm run dev     # nodemon watch mode
```

## Example API Usage

### POST /analysis
```bash
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client123",
    "geoJson": {
      "type": "Polygon",
      "coordinates": [[
        [-63.624885020050996, -10.311050368263523],
        [-63.624885020050996, -10.367865108370523],
        [-63.61278302732815,  -10.367865108370523],
        [-63.61278302732815,  -10.311050368263523],
        [-63.624885020050996, -10.311050368263523]
      ]]
    }
  }'
```
Response: `{ workflowId, message }` — tasks are queued and processed asynchronously by the worker.

## Design Principles
- **Strategy Pattern** for jobs: adding a new job type only requires creating a class implementing `Job` and registering it in `JobFactory`
- **WorkflowFactory** decouples workflow definition (YAML) from code — steps can be changed without modifying TypeScript
- **TaskRunner** is the single source of truth for task/workflow state transitions; `taskWorker` is purely an orchestration loop
- **Dependency injection**: `TaskRunner` receives a `Repository<Task>` and resolves all other repos via `manager.getRepository()`
