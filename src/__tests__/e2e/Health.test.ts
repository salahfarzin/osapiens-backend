import request from 'supertest';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { createApp } from '../../app';
import { Express } from 'express';

describe('GET /health', () => {
    useTestDatabase();

    let app: Express;

    beforeAll(() => {
        app = createApp(getDataSource());
    });

    it('should return 200 with healthy status when the database is initialised', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body.checks.database).toBe('connected');
        expect(typeof res.body.uptime).toBe('number');
        expect(typeof res.body.timestamp).toBe('string');
    });
});
