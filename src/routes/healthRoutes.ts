/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns service health including database connectivity status.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 uptime:
 *                   type: number
 *                   description: Process uptime in seconds
 *                   example: 42.3
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: connected
 *       503:
 *         description: Service is unhealthy
 */
import { Router } from 'express';
import { DataSource } from 'typeorm';

export function createHealthRouter(dataSource: DataSource): Router {
const router = Router();

router.get('/', async (_req, res) => {
    const dbConnected = dataSource.isInitialized;

    if (!dbConnected) {
        res.status(503).json({
            status: 'unhealthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            checks: {
                database: 'unreachable',
            },
        });
        return;
    }

    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        checks: {
            database: 'connected',
        },
    });
});

return router;
}

export default createHealthRouter;
