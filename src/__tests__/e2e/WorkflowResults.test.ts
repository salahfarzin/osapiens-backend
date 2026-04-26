import request from 'supertest';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { seedWorkflow } from '../helpers/seeds';
import { createApp } from '../../app';
import { WorkflowStatus } from '../../types';
import { Express } from 'express';

describe('GET /api/v1/workflow/:id/results', () => {
    useTestDatabase();

    let app: Express;

    beforeAll(() => {
        app = createApp(getDataSource());
    });

    it('should return 404 when the workflow does not exist', async () => {
        const res = await request(app).get('/api/v1/workflow/non-existent-id/results');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Workflow not found');
    });

    it('should return 400 when the workflow is not yet completed', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);

        const res = await request(app).get(`/api/v1/workflow/${workflow.workflowId}/results`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Workflow is not yet completed');
    });

    it('should return 400 when the workflow has failed status', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        await ds.getRepository('workflows').update(workflow.workflowId, {
            status: WorkflowStatus.Failed,
        });

        const res = await request(app).get(`/api/v1/workflow/${workflow.workflowId}/results`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Workflow is not yet completed');
    });

    it('should return 200 with finalResult when the workflow is completed', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const finalResult = 'Aggregated workflow results go here';
        await ds.getRepository('workflows').update(workflow.workflowId, {
            status: WorkflowStatus.Completed,
            finalResult,
        });

        const res = await request(app).get(`/api/v1/workflow/${workflow.workflowId}/results`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            workflowId: workflow.workflowId,
            status: WorkflowStatus.Completed,
            finalResult,
        });
    });

    it('should return finalResult as null when completed with no result set', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        await ds.getRepository('workflows').update(workflow.workflowId, {
            status: WorkflowStatus.Completed,
        });

        const res = await request(app).get(`/api/v1/workflow/${workflow.workflowId}/results`);

        expect(res.status).toBe(200);
        expect(res.body.workflowId).toBe(workflow.workflowId);
        expect(res.body.status).toBe(WorkflowStatus.Completed);
        expect(res.body.finalResult).toBeNull();
    });
});
