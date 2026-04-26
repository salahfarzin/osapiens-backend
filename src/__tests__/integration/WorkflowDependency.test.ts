import { Task } from '../../models/Task';
import { Workflow } from '../../models/Workflow';
import { Result } from '../../models/Result';
import { TaskRunner } from '../../workers/taskRunner';
import { TaskStatus, TaskType, WorkflowStatus } from '../../types';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { seedWorkflow, seedTask, fetchTask } from '../helpers/seeds';
import { POLYGON_GEO_JSON } from '../helpers/fixtures';

useTestDatabase();

describe('Task dependency chain (integration)', () => {
    it('PolygonAreaJob output is passed as previousResult to EmailNotificationJob', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const task1 = await seedTask(ds, workflow, {
            taskType: TaskType.PolygonArea,
            stepNumber: 1,
            geoJson: POLYGON_GEO_JSON,
        });
        const task2 = await seedTask(ds, workflow, {
            taskType: TaskType.Notification,
            stepNumber: 2,
            dependsOnTaskId: task1.taskId,
            geoJson: POLYGON_GEO_JSON,
        });

        const runner = new TaskRunner(ds.getRepository(Task));
        await runner.run(await fetchTask(ds, task1.taskId));
        await runner.run(await fetchTask(ds, task2.taskId));

        // Task1: real PolygonAreaJob produced an area
        const task1Result = await ds.getRepository(Result).findOneOrFail({ where: { taskId: task1.taskId } });
        const areaOutput = JSON.parse(task1Result.data ?? '') as { area: number; unit: string };
        expect(areaOutput.unit).toBe('m2');
        expect(areaOutput.area).toBeGreaterThan(0);

        // Task2: received task1's real output as previousResult
        const task2Result = await ds.getRepository(Result).findOneOrFail({ where: { taskId: task2.taskId } });
        const notificationOutput = JSON.parse(task2Result.data ?? '');
        expect(notificationOutput.notified).toBe(true);
        expect(notificationOutput.previousResult).toEqual(areaOutput);

        const finalWorkflow = await ds.getRepository(Workflow).findOne({
            where: { workflowId: workflow.workflowId },
        });
        expect(finalWorkflow?.status).toBe(WorkflowStatus.Completed);
    });

    it('PolygonAreaJob result is persisted with correct area and unit', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const task1 = await seedTask(ds, workflow, {
            taskType: TaskType.PolygonArea,
            stepNumber: 1,
            geoJson: POLYGON_GEO_JSON,
        });

        const runner = new TaskRunner(ds.getRepository(Task));
        await runner.run(await fetchTask(ds, task1.taskId));

        const savedResult = await ds.getRepository(Result).findOneOrFail({ where: { taskId: task1.taskId } });
        const parsed = JSON.parse(savedResult.data ?? '');
        expect(parsed).toMatchObject({ unit: 'm2' });
        expect(parsed.area).toBeGreaterThan(0);
    });

    it('the worker query only surfaces tasks whose dependency has completed', async () => {
        // Task1 is still Queued; task2 depends on task1
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const task1 = await seedTask(ds, workflow, { stepNumber: 1, status: TaskStatus.Queued });
        await seedTask(ds, workflow, {
            stepNumber: 2,
            status: TaskStatus.Queued,
            dependsOnTaskId: task1.taskId,
        });

        const readyTask = await ds.getRepository(Task)
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.workflow', 'workflow')
            .where('task.status = :status', { status: TaskStatus.Queued })
            .andWhere(
                `(task.dependsOnTaskId IS NULL OR EXISTS (` +
                    `SELECT 1 FROM tasks dep ` +
                    `WHERE dep.taskId = task.dependsOnTaskId ` +
                    `AND dep.status = :completedStatus` +
                    `))`,
                { completedStatus: TaskStatus.Completed }
            )
            .orderBy('task.stepNumber', 'ASC')
            .getOne();

        // Only task1 (no dependency) is eligible; task2 is blocked
        expect(readyTask).not.toBeNull();
        expect(readyTask?.taskId).toBe(task1.taskId);
    });

    it('task2 becomes eligible after task1 completes', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const task1 = await seedTask(ds, workflow, { stepNumber: 1 });
        const task2 = await seedTask(ds, workflow, {
            stepNumber: 2,
            dependsOnTaskId: task1.taskId,
        });

        // Mark task1 as completed
        await ds.getRepository(Task).update(task1.taskId, { status: TaskStatus.Completed });

        const readyTask = await ds.getRepository(Task)
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.workflow', 'workflow')
            .where('task.status = :status', { status: TaskStatus.Queued })
            .andWhere(
                `(task.dependsOnTaskId IS NULL OR EXISTS (` +
                    `SELECT 1 FROM tasks dep ` +
                    `WHERE dep.taskId = task.dependsOnTaskId ` +
                    `AND dep.status = :completedStatus` +
                    `))`,
                { completedStatus: TaskStatus.Completed }
            )
            .orderBy('task.stepNumber', 'ASC')
            .getOne();

        expect(readyTask).not.toBeNull();
        expect(readyTask?.taskId).toBe(task2.taskId);
    });
});
