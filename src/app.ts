import express, { Express, Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { DataSource } from 'typeorm';
import { createAnalysisRouter } from './routes/analysisRoutes';
import { createWorkflowRouter } from './routes/workflowRoutes';
import { createHealthRouter } from './routes/healthRoutes';
import defaultRoute from './routes/defaultRoute';
import { swaggerSpec } from './config/swagger';

export function createApp(dataSource: DataSource): Express {
    const app = express();
    app.use(express.json());

    app.use('/health', createHealthRouter(dataSource));

    app.get('/docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    const v1 = Router();
    v1.use('/analysis', createAnalysisRouter(dataSource));
    v1.use('/workflow', createWorkflowRouter(dataSource));
    app.use('/api/v1', v1);

    // Backwards-compatible aliases for the original spec routes
    app.use('/analysis', createAnalysisRouter(dataSource));
    app.use('/workflow', createWorkflowRouter(dataSource));

    app.use('/', defaultRoute);

    return app;
}
