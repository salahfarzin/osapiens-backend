import request from 'supertest';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { createApp } from '../../app';
import { POLYGON_GEO_JSON } from '../helpers/fixtures';
import { Express } from 'express';

describe('POST /api/v1/analysis', () => {
    useTestDatabase();

    let app: Express;

    beforeAll(() => {
        app = createApp(getDataSource());
    });

    const validGeoJson = JSON.parse(POLYGON_GEO_JSON);

    it('should return 202 with a workflowId on valid input', async () => {
        const res = await request(app)
            .post('/api/v1/analysis')
            .send({ clientId: 'client-test', geoJson: validGeoJson });

        expect(res.status).toBe(202);
        expect(typeof res.body.workflowId).toBe('string');
        expect(res.body.workflowId).toHaveLength(36); // UUID length
        expect(res.body.message).toBeDefined();
    });

    it('should persist the workflow so it is queryable via the status endpoint', async () => {
        const res = await request(app)
            .post('/api/v1/analysis')
            .send({ clientId: 'client-persist', geoJson: validGeoJson });

        const statusRes = await request(app).get(`/api/v1/workflow/${res.body.workflowId}/status`);

        expect(statusRes.status).toBe(200);
        expect(statusRes.body.workflowId).toBe(res.body.workflowId);
        expect(statusRes.body.totalTasks).toBeGreaterThan(0);
    });

    it('should return 202 via the backwards-compatible /analysis alias', async () => {
        const res = await request(app)
            .post('/analysis')
            .send({ clientId: 'client-alias', geoJson: validGeoJson });

        expect(res.status).toBe(202);
        expect(typeof res.body.workflowId).toBe('string');
    });
});
