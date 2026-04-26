/**
 * @openapi
 * /api/v1/analysis:
 *   post:
 *     summary: Submit a geospatial analysis workflow
 *     description: Creates a new workflow from the default YAML definition and queues all tasks for async processing.
 *     tags:
 *       - Analysis
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - geoJson
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: client123
 *               geoJson:
 *                 type: object
 *                 description: A valid GeoJSON geometry (Polygon recommended)
 *                 example:
 *                   type: Polygon
 *                   coordinates: [[[-63.62, -10.31], [-63.62, -10.37], [-63.61, -10.37], [-63.61, -10.31], [-63.62, -10.31]]]
 *     responses:
 *       202:
 *         description: Workflow created and tasks queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflowId:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
import { Router } from 'express';
import { DataSource } from 'typeorm';
import { WorkflowFactory } from '../workflows/WorkflowFactory'; // Create a folder for factories if you prefer
import path from 'node:path';

export function createAnalysisRouter(dataSource: DataSource): Router {
const router = Router();
const workflowFactory = new WorkflowFactory(dataSource);

router.post('/', async (req, res) => {
    const { clientId, geoJson } = req.body;
    const workflowFile = path.join(__dirname, '../workflows/example_workflow.yml');

    try {
        const workflow = await workflowFactory.createWorkflowFromYAML(workflowFile, clientId, JSON.stringify(geoJson));

        res.status(202).json({
            workflowId: workflow.workflowId,
            message: 'Workflow created and tasks queued from YAML definition.'
        });
    } catch (error: any) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ message: 'Failed to create workflow' });
    }
});

return router;
}

export default createAnalysisRouter;