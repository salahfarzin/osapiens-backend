import { Task } from '../../models/Task';
import { Workflow } from '../../models/Workflow';
import { TaskStatus, TaskType } from '../../types';

export const DUMMY_GEO_JSON = JSON.stringify({ type: 'Point', coordinates: [0, 0] });

const WORKFLOW_ID = 'workflow-uuid';
const TASK_ID = 'task-uuid';

export function makeTask(overrides: Partial<Task> = {}): Task {
    return Object.assign(new Task(), {
        taskId: TASK_ID,
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
