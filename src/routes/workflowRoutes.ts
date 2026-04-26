import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus, WorkflowStatus } from '../types';

export function createWorkflowRouter(dataSource: DataSource): Router {
    const router = Router();

    /**
     * @openapi
     * /api/v1/workflow/{id}/status:
     *   get:
     *     summary: Get workflow status
     *     description: Returns the current status of a workflow including completed and total task counts.
     *     tags:
     *       - Workflow
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: The workflow UUID
     *     responses:
     *       200:
     *         description: Workflow status retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 workflowId:
     *                   type: string
     *                   format: uuid
     *                 status:
     *                   $ref: '#/components/schemas/WorkflowStatus'
     *                 completedTasks:
     *                   type: integer
     *                   example: 3
     *                 totalTasks:
     *                   type: integer
     *                   example: 5
     *       404:
     *         description: Workflow not found
     *       500:
     *         description: Internal server error
     */
    async function getWorkflowStatus(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const workflowRepo = dataSource.getRepository(Workflow);

        try {
            const workflow = await workflowRepo.findOne({
                where: { workflowId: id },
                relations: ['tasks'],
            });

            if (!workflow) {
                res.status(404).json({ message: 'Workflow not found' });
                return;
            }

            const totalTasks = workflow.tasks.length;
            const completedTasks = workflow.tasks.filter(
                (task: Task) => task.status === TaskStatus.Completed
            ).length;

            res.status(200).json({
                workflowId: workflow.workflowId,
                status: workflow.status,
                completedTasks,
                totalTasks,
            });
        } catch (error: any) {
            console.error('Error fetching workflow status:', error);
            res.status(500).json({ message: 'Failed to fetch workflow status' });
        }
    }

    /**
     * @openapi
     * /api/v1/workflow/{id}/results:
     *   get:
     *     summary: Get workflow results
     *     description: Returns the final aggregated result of a completed workflow.
     *     tags:
     *       - Workflow
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: The workflow UUID
     *     responses:
     *       200:
     *         description: Workflow results retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 workflowId:
     *                   type: string
     *                   format: uuid
     *                 status:
     *                   $ref: '#/components/schemas/WorkflowStatus'
     *                 finalResult:
     *                   type: string
     *       400:
     *         description: Workflow is not yet completed
     *       404:
     *         description: Workflow not found
     *       500:
     *         description: Internal server error
     */
    async function getWorkflowResults(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const workflowRepo = dataSource.getRepository(Workflow);

        try {
            const workflow = await workflowRepo.findOne({
                where: { workflowId: id },
            });

            if (!workflow) {
                res.status(404).json({ message: 'Workflow not found' });
                return;
            }

            if (workflow.status !== WorkflowStatus.Completed) {
                res.status(400).json({ message: 'Workflow is not yet completed' });
                return;
            }

            res.status(200).json({
                workflowId: workflow.workflowId,
                status: workflow.status,
                finalResult: workflow.finalResult,
            });
        } catch (error: any) {
            console.error('Error fetching workflow results:', error);
            res.status(500).json({ message: 'Failed to fetch workflow results' });
        }
    }

    router.get('/:id/status', getWorkflowStatus);
    router.get('/:id/results', getWorkflowResults);

    return router;
}

export default createWorkflowRouter;
