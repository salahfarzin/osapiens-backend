import { Task } from '../../models/Task';
import { Workflow } from '../../models/Workflow';
import { TaskStatus, TaskType, WorkflowStatus } from '../../types';
import * as yaml from 'js-yaml';

export const DUMMY_CLIENT_ID = 'test-client';
export const DUMMY_GEO_JSON = JSON.stringify({ type: 'Point', coordinates: [0, 0] });

export const POLYGON_GEO_JSON = JSON.stringify({
    type: 'Polygon',
    coordinates: [[
        [-63.624885020050996, -10.311050368263523],
        [-63.624885020050996, -10.367865108370523],
        [-63.61278302732815,  -10.367865108370523],
        [-63.61278302732815,  -10.311050368263523],
        [-63.624885020050996, -10.311050368263523],
    ]],
});

const WORKFLOW_ID = 'workflow-uuid';
export const DUMMY_TASK_ID = 'task-uuid';

export function makeTask(overrides: Partial<Task> = {}): Task {
    return Object.assign(new Task(), {
        taskId: DUMMY_TASK_ID,
        clientId: 'client-1',
        geoJson: DUMMY_GEO_JSON,
        status: TaskStatus.Queued,
        taskType: TaskType.Analysis,
        stepNumber: 1,
        dependsOnTaskId: null,
        workflow: { workflowId: WORKFLOW_ID } as Workflow,
        ...overrides,
    });
}

export function makeWorkflow(tasks: Pick<Task, 'taskId' | 'status'>[] = []): Workflow {
    return Object.assign(new Workflow(), {
        workflowId: WORKFLOW_ID,
        clientId: 'client-1',
        status: WorkflowStatus.InProgress,
        tasks: tasks.map(t => makeTask({ taskId: t.taskId, status: t.status })),
    });
}

interface WorkflowYamlStep {
    taskType: string;
    stepNumber: number;
    dependsOn?: number;
}

export function makeWorkflowYaml(steps: WorkflowYamlStep[]): string {
    return yaml.dump({ name: 'test_workflow', steps });
}
