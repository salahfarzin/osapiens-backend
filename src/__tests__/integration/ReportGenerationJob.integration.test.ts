import { ReportGenerationJob } from '../../jobs/ReportGenerationJob';
import { TaskStatus, TaskType } from '../../types';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { seedWorkflow, seedTask, seedResult } from '../helpers/seeds';

useTestDatabase();

describe('ReportGenerationJob (integration)', () => {
    let job: ReportGenerationJob;

    beforeEach(() => {
        job = new ReportGenerationJob(getDataSource());
    });

    it('returns the workflow ID in the report', async () => {
        const workflow = await seedWorkflow(getDataSource());
        const reportTask = await seedTask(getDataSource(), workflow, { taskType: TaskType.Report, stepNumber: 2 });

        const report = await job.run(reportTask);

        expect(report.workflowId).toBe(workflow.workflowId);
    });

    it('returns an empty tasks list when there are no other tasks', async () => {
        const workflow = await seedWorkflow(getDataSource());
        const reportTask = await seedTask(getDataSource(), workflow, { taskType: TaskType.Report, stepNumber: 1 });

        const report = await job.run(reportTask);

        expect(report.tasks).toEqual([]);
    });

    it('includes a completed preceding task with its parsed result output', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const step1 = await seedTask(ds, workflow, {
            taskType: TaskType.PolygonArea,
            stepNumber: 1,
            status: TaskStatus.Completed,
        });
        await seedResult(ds, step1, { area: 8_000_000, unit: 'm2' });
        const reportTask = await seedTask(ds, workflow, { taskType: TaskType.Report, stepNumber: 2 });

        const report = await job.run(reportTask);

        expect(report.tasks).toHaveLength(1);
        expect(report.tasks[0]).toMatchObject({
            taskId: step1.taskId,
            type: TaskType.PolygonArea,
            output: { area: 8_000_000, unit: 'm2' },
        });
    });

    it('includes a failed preceding task with error information', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const failedTask = await seedTask(ds, workflow, {
            taskType: TaskType.Analysis,
            stepNumber: 1,
            status: TaskStatus.Failed,
        });
        const reportTask = await seedTask(ds, workflow, { taskType: TaskType.Report, stepNumber: 2 });

        const report = await job.run(reportTask);

        expect(report.tasks).toHaveLength(1);
        expect(report.tasks[0].taskId).toBe(failedTask.taskId);
        expect(report.tasks[0].output).toMatchObject({
            error: expect.stringContaining(failedTask.taskId),
        });
    });

    it('excludes the report task itself from the tasks list', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const reportTask = await seedTask(ds, workflow, { taskType: TaskType.Report, stepNumber: 1 });

        const report = await job.run(reportTask);

        const ids = report.tasks.map((t) => t.taskId);
        expect(ids).not.toContain(reportTask.taskId);
    });

    it('returns tasks ordered by stepNumber ascending as persisted in SQLite', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        // Insert in reverse order to verify DB ordering, not insertion order.
        const step2 = await seedTask(ds, workflow, { taskType: TaskType.Analysis, stepNumber: 2, status: TaskStatus.Completed });
        const step1 = await seedTask(ds, workflow, { taskType: TaskType.PolygonArea,  stepNumber: 1, status: TaskStatus.Completed });
        await seedResult(ds, step2, { country: 'Brazil' });
        await seedResult(ds, step1, { area: 500 });
        const reportTask = await seedTask(ds, workflow, { taskType: TaskType.Report, stepNumber: 3 });

        const report = await job.run(reportTask);

        expect(report.tasks).toHaveLength(2);
        expect(report.tasks[0].taskId).toBe(step1.taskId);
        expect(report.tasks[1].taskId).toBe(step2.taskId);
    });

    it('aggregates both completed and failed tasks in the same report', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const okTask = await seedTask(ds, workflow, {
            taskType: TaskType.PolygonArea,
            stepNumber: 1,
            status: TaskStatus.Completed,
        });
        await seedResult(ds, okTask, { area: 1234 });
        const failedTask = await seedTask(ds, workflow, {
            taskType: TaskType.Analysis,
            stepNumber: 2,
            status: TaskStatus.Failed,
        });
        const reportTask = await seedTask(ds, workflow, { taskType: TaskType.Report, stepNumber: 3 });

        const report = await job.run(reportTask);

        expect(report.tasks).toHaveLength(2);
        const okReport   = report.tasks.find((t) => t.taskId === okTask.taskId);
        const failReport = report.tasks.find((t) => t.taskId === failedTask.taskId);
        expect(okReport?.output).toMatchObject({ area: 1234 });
        expect(failReport?.output).toMatchObject({ error: expect.any(String) });
    });

    it('always sets finalReport to the standard summary string', async () => {
        const ds = getDataSource();
        const workflow = await seedWorkflow(ds);
        const reportTask = await seedTask(ds, workflow, { taskType: TaskType.Report, stepNumber: 1 });

        const report = await job.run(reportTask);

        expect(report.finalReport).toBe('Aggregated data and results');
    });

    it('isolates results to the correct workflow — tasks from another workflow are not included', async () => {
        const ds = getDataSource();
        const workflowA = await seedWorkflow(ds, 'client-A');
        const workflowB = await seedWorkflow(ds, 'client-B');
        const taskB = await seedTask(ds, workflowB, { taskType: TaskType.PolygonArea, stepNumber: 1, status: TaskStatus.Completed });
        await seedResult(ds, taskB, { area: 9999 });
        const reportTask = await seedTask(ds, workflowA, { taskType: TaskType.Report, stepNumber: 1 });

        const report = await job.run(reportTask);

        expect(report.tasks).toEqual([]);
    });
});
