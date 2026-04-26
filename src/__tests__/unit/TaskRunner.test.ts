import { Repository } from 'typeorm';
import { Task } from '../../models/Task';
import { Workflow } from '../../models/Workflow';
import { Result } from '../../models/Result';
import { TaskRunner } from '../../workers/taskRunner';
import { TaskStatus, WorkflowStatus } from '../../types';
import * as JobFactory from '../../jobs/JobFactory';
import { makeTask, makeWorkflow, DUMMY_TASK_ID } from '../helpers/fixtures';

jest.mock('../../jobs/JobFactory');

describe('TaskRunner', () => {
    let mockJob: { run: jest.Mock };
    let mockResultRepo: { findOne: jest.Mock; save: jest.Mock };
    let mockWorkflowRepo: { findOne: jest.Mock; save: jest.Mock };
    let mockTaskRepo: Repository<Task>;
    let runner: TaskRunner;

    beforeEach(() => {
        mockJob = { run: jest.fn().mockResolvedValue({ output: 'result' }) };
        (JobFactory.getJobForTaskType as jest.Mock).mockReturnValue(mockJob);

        mockResultRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest
                .fn()
                .mockResolvedValue({ resultId: 'result-uuid', taskId: DUMMY_TASK_ID, data: '{}' }),
        };

        mockWorkflowRepo = {
            findOne: jest
                .fn()
                .mockResolvedValue(makeWorkflow([{ taskId: DUMMY_TASK_ID, status: TaskStatus.Completed }])),
            save: jest.fn().mockResolvedValue({}),
        };

        mockTaskRepo = {
            save: jest.fn().mockImplementation(async (t: Task) => t),
            manager: {
                getRepository: jest.fn().mockImplementation((entity: unknown) => {
                    if (entity === Result) return mockResultRepo;
                    if (entity === Workflow) return mockWorkflowRepo;
                }),
            },
        } as unknown as Repository<Task>;

        runner = new TaskRunner(mockTaskRepo);
    });

    describe('dependency resolution', () => {
        it('does not query Result and passes undefined to job when task has no dependency', async () => {
            const task = makeTask({ dependsOnTaskId: null });

            await runner.run(task);

            expect(mockResultRepo.findOne).not.toHaveBeenCalled();
            expect(mockJob.run).toHaveBeenCalledWith(task, undefined);
        });

        it('fetches the dependency result and passes its parsed data as previousResult', async () => {
            const depData = { country: 'Brazil' };
            mockResultRepo.findOne.mockResolvedValue({
                resultId: 'dep-result',
                taskId: 'dep-task-id',
                data: JSON.stringify(depData),
            });

            const task = makeTask({ dependsOnTaskId: 'dep-task-id' });

            await runner.run(task);

            expect(mockResultRepo.findOne).toHaveBeenCalledWith({
                where: { taskId: 'dep-task-id' },
            });
            expect(mockJob.run).toHaveBeenCalledWith(task, depData);
        });

        it('passes undefined as previousResult when the dependency result row does not exist', async () => {
            mockResultRepo.findOne.mockResolvedValue(null);

            const task = makeTask({ dependsOnTaskId: 'dep-task-id' });

            await runner.run(task);

            expect(mockJob.run).toHaveBeenCalledWith(task, undefined);
        });
    });

    describe('task status transitions', () => {
        it('sets status to InProgress before the job runs', async () => {
            let statusAtFirstSave: TaskStatus | undefined;
            (mockTaskRepo.save as jest.Mock).mockImplementationOnce(async (t: Task) => {
                statusAtFirstSave = t.status;
                return t;
            });

            await runner.run(makeTask());

            expect(statusAtFirstSave).toBe(TaskStatus.InProgress);
        });

        it('sets status to Completed after a successful job run', async () => {
            const task = makeTask();

            await runner.run(task);

            expect(task.status).toBe(TaskStatus.Completed);
        });

        it('sets status to Failed when the job throws', async () => {
            mockJob.run.mockRejectedValue(new Error('job error'));

            const task = makeTask();
            await expect(runner.run(task)).rejects.toThrow();

            expect(task.status).toBe(TaskStatus.Failed);
        });

        it('rethrows the original job error', async () => {
            mockJob.run.mockRejectedValue(new Error('downstream failure'));

            await expect(runner.run(makeTask())).rejects.toThrow('downstream failure');
        });
    });

    describe('workflow status update', () => {
        it('marks the workflow as Completed when every task has completed', async () => {
            mockWorkflowRepo.findOne.mockResolvedValue(
                makeWorkflow([{ taskId: DUMMY_TASK_ID, status: TaskStatus.Completed }])
            );

            await runner.run(makeTask());

            expect(mockWorkflowRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ status: WorkflowStatus.Completed })
            );
        });

        it('marks the workflow as InProgress when other tasks are still queued', async () => {
            mockWorkflowRepo.findOne.mockResolvedValue(
                makeWorkflow([
                    { taskId: DUMMY_TASK_ID, status: TaskStatus.Completed },
                    { taskId: 'other-task', status: TaskStatus.Queued },
                ])
            );

            await runner.run(makeTask());

            expect(mockWorkflowRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ status: WorkflowStatus.InProgress })
            );
        });

        it('marks the workflow as Failed when any task has failed', async () => {
            mockWorkflowRepo.findOne.mockResolvedValue(
                makeWorkflow([
                    { taskId: DUMMY_TASK_ID, status: TaskStatus.Completed },
                    { taskId: 'sibling-task', status: TaskStatus.Failed },
                ])
            );

            await runner.run(makeTask());

            expect(mockWorkflowRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ status: WorkflowStatus.Failed })
            );
        });

        it('does not update workflow status when the job itself fails', async () => {
            mockJob.run.mockRejectedValue(new Error('job error'));

            await expect(runner.run(makeTask())).rejects.toThrow();

            expect(mockWorkflowRepo.save).not.toHaveBeenCalled();
        });
    });
});
