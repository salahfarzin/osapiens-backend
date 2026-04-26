import * as fs from 'node:fs';
import { WorkflowFactory } from '../../workflows/WorkflowFactory';
import { Task } from '../../models/Task';
import { TaskStatus, WorkflowStatus } from '../../types';
import { useTestDatabase, getDataSource } from '../helpers/testDb';
import { DUMMY_CLIENT_ID, DUMMY_GEO_JSON, makeWorkflowYaml } from '../helpers/fixtures';

jest.mock('node:fs', () => ({
    ...jest.requireActual<typeof import('node:fs')>('node:fs'),
    readFileSync: jest.fn(),
}));

describe('WorkflowFactory', () => {
    useTestDatabase();
    let factory: WorkflowFactory;

    beforeAll(() => {
        factory = new WorkflowFactory(getDataSource());
    });

    beforeEach(() => {
        (fs.readFileSync as jest.Mock).mockReset();
    });

    describe('independent tasks (no dependsOn)', () => {
        it('creates a workflow with status Initial', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([{ taskType: 'analysis', stepNumber: 1 }])
            );

            const workflow = await factory.createWorkflowFromYAML(
                'any.yml',
                DUMMY_CLIENT_ID,
                DUMMY_GEO_JSON
            );

            expect(workflow.status).toBe(WorkflowStatus.Initial);
            expect(workflow.clientId).toBe(DUMMY_CLIENT_ID);
        });

        it('creates all tasks with Queued status and null dependsOnTaskId', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([
                    { taskType: 'analysis', stepNumber: 1 },
                    { taskType: 'notification', stepNumber: 2 },
                ])
            );

            await factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON);

            const tasks = await getDataSource()
                .getRepository(Task)
                .find({ order: { stepNumber: 'ASC' } });

            expect(tasks).toHaveLength(2);
            tasks.forEach(t => {
                expect(t.status).toBe(TaskStatus.Queued);
                expect(t.dependsOnTaskId).toBeNull();
            });
        });
    });

    describe('dependent tasks (with dependsOn)', () => {
        it('sets dependsOnTaskId to the taskId of the referenced step', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([
                    { taskType: 'analysis', stepNumber: 1 },
                    { taskType: 'notification', stepNumber: 2, dependsOn: 1 },
                ])
            );

            await factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON);

            const tasks = await getDataSource()
                .getRepository(Task)
                .find({ order: { stepNumber: 'ASC' } });

            expect(tasks[0].dependsOnTaskId).toBeNull();
            expect(tasks[1].dependsOnTaskId).toBe(tasks[0].taskId);
        });

        it('wires a 3-step linear chain correctly', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([
                    { taskType: 'analysis', stepNumber: 1 },
                    { taskType: 'notification', stepNumber: 2, dependsOn: 1 },
                    { taskType: 'report', stepNumber: 3, dependsOn: 2 },
                ])
            );

            await factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON);

            const tasks = await getDataSource()
                .getRepository(Task)
                .find({ order: { stepNumber: 'ASC' } });

            expect(tasks).toHaveLength(3);
            expect(tasks[0].dependsOnTaskId).toBeNull();
            expect(tasks[1].dependsOnTaskId).toBe(tasks[0].taskId);
            expect(tasks[2].dependsOnTaskId).toBe(tasks[1].taskId);
        });

        it('resolves dependencies correctly even when YAML steps are listed out of order', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([
                    { taskType: 'notification', stepNumber: 2, dependsOn: 1 }, // listed first
                    { taskType: 'analysis', stepNumber: 1 },
                ])
            );

            await factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON);

            const tasks = await getDataSource()
                .getRepository(Task)
                .find({ order: { stepNumber: 'ASC' } });

            expect(tasks[0].stepNumber).toBe(1);
            expect(tasks[1].stepNumber).toBe(2);
            expect(tasks[1].dependsOnTaskId).toBe(tasks[0].taskId);
        });

        it('creates all tasks with Queued status regardless of dependencies', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([
                    { taskType: 'analysis', stepNumber: 1 },
                    { taskType: 'notification', stepNumber: 2, dependsOn: 1 },
                ])
            );

            await factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON);

            const tasks = await getDataSource().getRepository(Task).find();

            expect(tasks.every(t => t.status === TaskStatus.Queued)).toBe(true);
        });
    });

    describe('error handling', () => {
        it('throws when dependsOn references an undefined step number', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([{ taskType: 'analysis', stepNumber: 1, dependsOn: 99 }])
            );

            await expect(
                factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON)
            ).rejects.toThrow('dependsOn: 99');
        });

        it('throws when dependsOn is a forward reference (dependency step has higher stepNumber)', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(
                makeWorkflowYaml([
                    { taskType: 'analysis', stepNumber: 1, dependsOn: 2 }, // step 2 doesn't exist yet
                    { taskType: 'notification', stepNumber: 2 },
                ])
            );

            await expect(
                factory.createWorkflowFromYAML('any.yml', DUMMY_CLIENT_ID, DUMMY_GEO_JSON)
            ).rejects.toThrow('dependsOn: 2');
        });
    });
});
