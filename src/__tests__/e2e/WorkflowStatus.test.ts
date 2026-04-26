import request from 'supertest';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { seedWorkflow, seedTask } from '../helpers/seeds';
import { createApp } from '../../app';
import { TaskStatus, WorkflowStatus } from '../../types';
import { Express } from 'express';

describe('GET /api/v1/workflow/:id/status', () => {
    useTestDatabase();

    let app: Express;

    beforeAll(() => {
        app = createApp(getDataSource());
    });

    it('should return 404 when the workflow does not exist', async () => {
        const res = await request(app).get('/api/v1/workflow/non-existent-id/status');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Workflow not found');
    });

    it('should return 200 with status and task counts when the workflow exists', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        await seedTask(ds, workflow, { status: TaskStatus.Completed });
        await seedTask(ds, workflow, { status: TaskStatus.Completed, stepNumber: 2 });
        await seedTask(ds, workflow, { status: TaskStatus.Queued, stepNumber: 3 });

        const res = await request(app).get(`/api/v1/workflow/${workflow.workflowId}/status`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            workflowId: workflow.workflowId,
            status: WorkflowStatus.InProgress,
            completedTasks: 2,
            totalTasks: 3,
        });
    });

    it('should return 200 with zero task counts when the workflow has no tasks', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);

        const res = await request(app).get(`/api/v1/workflow/${workflow.workflowId}/status`);

        expect(res.status).toBe(200);
        expect(res.body.completedTasks).toBe(0);
        expect(res.body.totalTasks).toBe(0);
    });

    it('should return 200 via the backwards-compatible /workflow/:id/status alias', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);

        const res = await request(app).get(`/workflow/${workflow.workflowId}/status`);

        expect(res.status).toBe(200);
        expect(res.body.workflowId).toBe(workflow.workflowId);
    });
});
