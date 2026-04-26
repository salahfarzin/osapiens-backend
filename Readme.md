# Backend Coding Challenge

This repository demonstrates a backend architecture that handles asynchronous tasks, workflows, and job execution using TypeScript, Express.js, and TypeORM. The project showcases how to:

- Define and manage entities such as `Task` and `Workflow`.
- Use a `WorkflowFactory` to create workflows from YAML configurations.
- Implement a `TaskRunner` that executes jobs associated with tasks and manages task and workflow states.
- Run tasks asynchronously using a background worker.

## Key Features

1. **Entity Modeling with TypeORM**
   - **Task Entity:** Represents an individual unit of work with attributes like `taskType`, `status`, `progress`, and references to a `Workflow`.
   - **Workflow Entity:** Groups multiple tasks into a defined sequence or steps, allowing complex multi-step processes.

2. **Workflow Creation from YAML**
   - Use `WorkflowFactory` to load workflow definitions from a YAML file.
   - Dynamically create workflows and tasks without code changes by updating YAML files.

3. **Asynchronous Task Execution**
   - A background worker (`taskWorker`) continuously polls for `queued` tasks.
   - The `TaskRunner` runs the appropriate job based on a task's `taskType`.

4. **Robust Status Management**
   - `TaskRunner` updates the status of tasks (from `queued` to `in_progress`, `completed`, or `failed`).
   - Workflow status is evaluated after each task completes, ensuring you know when the entire workflow is `completed` or `failed`.

5. **Dependency Injection and Decoupling**
   - `TaskRunner` takes in only the `Task` and determines the correct job internally.
   - `TaskRunner` handles task state transitions, leaving the background worker clean and focused on orchestration.

6. **Interdependent Tasks**
   - Tasks may declare a `dependsOnTaskId`; the worker will not start a task until its dependency has completed.

7. **Final Workflow Results**
   - After all tasks finish, the `Workflow.finalResult` field is populated with an aggregated JSON summary of every task's output.

## Project Structure

```
src
├─ models/
│   ├─ world_data.json  # Contains world data for analysis
│   
├─ models/
│   ├─ Result.ts        # Defines the Result entity
│   ├─ Task.ts          # Defines the Task entity
│   ├─ Workflow.ts      # Defines the Workflow entity
│   
├─ jobs/
│   ├─ Job.ts           # Job interface
│   ├─ JobFactory.ts    # getJobForTaskType function for mapping taskType to a Job
│   ├─ TaskRunner.ts    # Handles job execution & task/workflow state transitions
│   ├─ DataAnalysisJob.ts (example)
│   ├─ EmailNotificationJob.ts (example)
│
├─ workflows/
│   ├─ WorkflowFactory.ts  # Creates workflows & tasks from a YAML definition
│
├─ workers/
│   ├─ taskWorker.ts    # Background worker that fetches queued tasks & runs them
│
├── routes/
│   ├── analysisRoutes.ts        # POST /analysis
│   ├── workflowRoutes.ts        # GET  /workflow/:id/status, GET /workflow/:id/results
│   ├── healthRoutes.ts          # GET  /health
│   └── defaultRoute.ts          # GET  / (renders README)
│
├── config/
│   └── swagger.ts               # OpenAPI 3.0 spec config (swagger-jsdoc)
│
├── types/
│   ├── index.ts                 # Barrel export
│   ├── TaskStatus.ts            # enum TaskStatus
│   ├── WorkflowStatus.ts        # enum WorkflowStatus
│   └── TaskType.ts              # const TaskType + type alias
│
├── data-source.ts               # TypeORM DataSource configuration
└── index.ts                     # Express server bootstrap + worker start
```

## Getting Started

### Prerequisites
- Node.js (LTS recommended)
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/backend-coding-challenge.git
   cd backend-coding-challenge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start        # ts-node (single run)
   npm run dev      # nodemon watch mode
   ```

   The server starts on **http://localhost:3000**. The background worker starts automatically after the database initialises.

### Interactive API Documentation

Once the server is running, open **http://localhost:3000/docs** in your browser to explore and test all endpoints via the Swagger UI.

The raw OpenAPI spec is available at **http://localhost:3000/docs.json**.

---

## API Reference

### `POST /api/v1/analysis`

Creates a new workflow from the default YAML definition and queues all tasks for async processing.

**Request body:**
```json
{
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
}
```

**Response `202`:**
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "message": "Workflow created and tasks queued from YAML definition."
}
```

**curl example:**
```bash
curl -X POST http://localhost:3000/api/v1/analysis \
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

---

### `GET /api/v1/workflow/:id/status`

Returns the current status of a workflow, including the count of completed and total tasks.

**Path parameter:** `id` — the `workflowId` UUID returned by `POST /api/v1/analysis`.

**Response `200`:**
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "status": "in_progress",
  "completedTasks": 2,
  "totalTasks": 4
}
```

| Field | Description |
|---|---|
| `status` | One of `initial`, `in_progress`, `completed`, `failed` |
| `completedTasks` | Number of tasks whose status is `completed` |
| `totalTasks` | Total number of tasks in the workflow |

**Response `404`** — workflow ID does not exist:
```json
{ "message": "Workflow not found" }
```

**curl example:**
```bash
curl http://localhost:3000/api/v1/workflow/3433c76d-f226-4c91-afb5-7dfc7accab24/status
```

---

### `GET /api/v1/workflow/:id/results`

Returns the final aggregated result of a completed workflow.

**Path parameter:** `id` — the `workflowId` UUID returned by `POST /api/v1/analysis`.

**Response `200`:**
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "status": "completed",
  "finalResult": "Aggregated workflow results go here"
}
```

**Response `400`** — workflow exists but is not yet completed:
```json
{ "message": "Workflow is not yet completed" }
```

**Response `404`** — workflow ID does not exist:
```json
{ "message": "Workflow not found" }
```

**curl example:**
```bash
curl http://localhost:3000/api/v1/workflow/3433c76d-f226-4c91-afb5-7dfc7accab24/results
```

---

### `GET /health`

Returns service health including database connectivity. Load balancers and orchestrators (e.g. Kubernetes liveness probes) should use this endpoint.

**Response `200` — healthy:**
```json
{
  "status": "healthy",
  "uptime": 42.3,
  "timestamp": "2026-04-26T10:00:00.000Z",
  "checks": {
    "database": "connected"
  }
}
```

**Response `503` — unhealthy (database not initialised):**
```json
{
  "status": "unhealthy",
  "uptime": 0.1,
  "timestamp": "2026-04-26T10:00:00.000Z",
  "checks": {
    "database": "unreachable"
  }
}
```

**curl example:**
```bash
curl http://localhost:3000/health
```

---

## Workflow YAML Format

```yaml
name: "example_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 2
  - taskType: "polygon"
    stepNumber: 3
  - taskType: "report"
    stepNumber: 4
    dependsOn: 3
```

| Field | Required | Description |
|---|---|---|
| `taskType` | yes | One of `analysis`, `notification`, `polygon`, `report` |
| `stepNumber` | yes | Ordering hint; also used as the dependency reference key |
| `dependsOn` | no | `stepNumber` of the task that must complete first |

---

## Job Types

| `taskType` | Class | Description |
|---|---|---|
| `analysis` | `DataAnalysisJob` | Uses `@turf/boolean-within` to detect which country the polygon falls within |
| `notification` | `EmailNotificationJob` | Stub — simulates a 500 ms notification delay |
| `polygon` | `PolygonAreaJob` | Calculates polygon area in m² using `@turf/area` |
| `report` | `ReportGenerationJob` | Aggregates outputs of all preceding tasks into a structured JSON report |

### Adding a new Job

1. Create `src/jobs/MyNewJob.ts` implementing the `Job` interface:
   ```ts
   export class MyNewJob implements Job {
       async run(task: Task): Promise<any> {
           // ...
       }
   }
   ```
2. Register it in `src/jobs/JobFactory.ts`:
   ```ts
   my_type: () => new MyNewJob(),
   ```
3. Add the new `taskType` value to `src/types/TaskType.ts`.

---

## Testing

The project uses [Jest](https://jestjs.io/) with [ts-jest](https://kulshekhar.github.io/ts-jest/).

### Commands

| Command | Description |
|---|---|
| `npm test` | Run all tests (unit + integration + e2e) |
| `npm run test:unit` | Unit tests only (fast, no database) |
| `npm run test:integration` | Integration tests only (in-memory SQLite) |
| `npm run test:e2e` | E2E HTTP route tests (supertest + in-memory SQLite) |
| `npm run test:watch` | Watch mode — re-run on file changes |
| `npm test -- --coverage` | Full coverage report |

### Test Structure

```
src/__tests__/
├── unit/
│   ├── PolygonAreaJob.test.ts                        # PolygonAreaJob happy path + error branches
│   ├── ReportGenerationJob.test.ts                   # ReportGenerationJob unit tests
│   └── TaskRunner.test.ts                            # TaskRunner state transitions
├── integration/
│   ├── ReportGenerationJob.integration.test.ts       # Full DB round-trip for report aggregation
│   ├── WorkflowDependency.test.ts                    # Dependency-ordering integration tests
│   └── WorkflowFactory.test.ts                       # YAML parsing + entity creation
├── e2e/
│   ├── Health.test.ts                                # GET /health response shape + DB check
│   ├── WorkflowStatus.test.ts                        # GET /api/v1/workflow/:id/status (200, 404)
│   └── Analysis.test.ts                             # POST /api/v1/analysis + persistence check
└── helpers/
    ├── fixtures.ts    # In-memory object builders (no DB required)
    ├── seeds.ts       # DB seed helpers for integration and e2e tests
    └── testDb.ts      # Reusable DB lifecycle hooks (useTestDatabase / getDataSource)
```

### Test layers

| Layer | Scope | DB | Speed |
|---|---|---|---|
| **unit** | Single class/function in isolation (mocks external deps) | none | fastest |
| **integration** | Multiple classes wired together against real DB | in-memory SQLite | fast |
| **e2e** | Full HTTP request → response through the Express app | in-memory SQLite | fast |

### Testing the new features end-to-end

#### 1. Automated (no server needed)

```bash
# All layers
npm test

# E2E only
npm run test:e2e

# With coverage
npm test -- --coverage
```

#### 2. Manual against a running server

```bash
# Start the server
npm run dev

# Submit a workflow and capture the workflowId
WORKFLOW_ID=$(curl -s -X POST http://localhost:3000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client123",
    "geoJson": {"type":"Polygon","coordinates":[[
      [-63.624885020050996,-10.311050368263523],
      [-63.624885020050996,-10.367865108370523],
      [-63.61278302732815,-10.367865108370523],
      [-63.61278302732815,-10.311050368263523],
      [-63.624885020050996,-10.311050368263523]
    ]]}
  }' | jq -r '.workflowId')

# Poll status (worker processes tasks every 5 s)
curl http://localhost:3000/api/v1/workflow/$WORKFLOW_ID/status

# Fetch results once completed
curl http://localhost:3000/api/v1/workflow/$WORKFLOW_ID/results

# Health check
curl http://localhost:3000/health
```

#### 3. Swagger UI

Open **http://localhost:3000/docs** — use the "Try it out" button on any endpoint to send live requests directly from the browser.


- Define and manage entities such as `Task` and `Workflow`.
- Use a `WorkflowFactory` to create workflows from YAML configurations.
- Implement a `TaskRunner` that executes jobs associated with tasks and manages task and workflow states.
- Run tasks asynchronously using a background worker.

## Key Features

1. **Entity Modeling with TypeORM**  
   - **Task Entity:** Represents an individual unit of work with attributes like `taskType`, `status`, `progress`, and references to a `Workflow`.
   - **Workflow Entity:** Groups multiple tasks into a defined sequence or steps, allowing complex multi-step processes.

2. **Workflow Creation from YAML**  
   - Use `WorkflowFactory` to load workflow definitions from a YAML file.
   - Dynamically create workflows and tasks without code changes by updating YAML files.

3. **Asynchronous Task Execution**  
   - A background worker (`taskWorker`) continuously polls for `queued` tasks.
   - The `TaskRunner` runs the appropriate job based on a task’s `taskType`.

4. **Robust Status Management**  
   - `TaskRunner` updates the status of tasks (from `queued` to `in_progress`, `completed`, or `failed`).
   - Workflow status is evaluated after each task completes, ensuring you know when the entire workflow is `completed` or `failed`.

5. **Dependency Injection and Decoupling**  
   - `TaskRunner` takes in only the `Task` and determines the correct job internally.
   - `TaskRunner` handles task state transitions, leaving the background worker clean and focused on orchestration.

