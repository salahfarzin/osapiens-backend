import { ReportGenerationJob } from '../../jobs/ReportGenerationJob';
import { Task } from '../../models/Task';
import { Result } from '../../models/Result';
import { makeTask } from '../helpers/fixtures';
import { TaskStatus, TaskType } from '../../types';
import { DataSource } from 'typeorm';

/** Minimal Result-like object returned by the mocked repository. */
function makeResult(data: string | null, resultId = 'result-uuid'): Pick<Result, 'resultId' | 'taskId' | 'data'> {
    return { resultId, taskId: 'task-uuid', data };
}

describe('ReportGenerationJob', () => {
    let job: ReportGenerationJob;
    let mockTaskRepo: { find: jest.Mock };
    let mockResultRepo: { findOne: jest.Mock };

    beforeEach(() => {
        mockTaskRepo = { find: jest.fn() };
        mockResultRepo = { findOne: jest.fn() };

        const mockDataSource = {
            getRepository: (entity: unknown) => {
                if (entity === Task) {
                    return mockTaskRepo;
                }

                if (entity === Result) {
                    return mockResultRepo;
                }

                throw new Error(
                    `Unexpected entity passed to getRepository: ${typeof entity === 'function' ? entity.name : JSON.stringify(entity)}`,
                );
            },
        } as unknown as DataSource;

        job = new ReportGenerationJob(mockDataSource);
    });

    describe('completed preceding tasks', () => {
        it('falls back to the raw string when result data is not valid JSON', async () => {
            const currentTask = makeTask({ taskId: 'current' });
            const preceding = makeTask({ taskId: 'task-1', taskType: TaskType.Analysis, resultId: 'r1', status: TaskStatus.Completed });
            mockTaskRepo.find.mockResolvedValue([preceding, currentTask]);
            mockResultRepo.findOne.mockResolvedValue(makeResult('raw-non-json-text'));

            const report = await job.run(currentTask);

            expect(report.tasks[0].output).toBe('raw-non-json-text');
        });

        it('sets output to null when the result record has no data', async () => {
            const currentTask = makeTask({ taskId: 'current' });
            const preceding = makeTask({ taskId: 'task-1', taskType: TaskType.Analysis, resultId: 'r1', status: TaskStatus.Completed });
            mockTaskRepo.find.mockResolvedValue([preceding, currentTask]);
            mockResultRepo.findOne.mockResolvedValue(makeResult(null));

            const report = await job.run(currentTask);

            expect(report.tasks[0].output).toBeNull();
        });

        it('sets output to null when the result record cannot be found in the database', async () => {
            const currentTask = makeTask({ taskId: 'current' });
            const preceding = makeTask({ taskId: 'task-1', taskType: TaskType.Analysis, resultId: 'r1', status: TaskStatus.Completed });
            mockTaskRepo.find.mockResolvedValue([preceding, currentTask]);
            mockResultRepo.findOne.mockResolvedValue(null);

            const report = await job.run(currentTask);

            expect(report.tasks[0].output).toBeNull();
        });
    });

    describe('failed preceding tasks', () => {
        it('does not query the result repository for failed tasks (they have no resultId)', async () => {
            const currentTask = makeTask({ taskId: 'current' });
            const failedTask  = makeTask({ taskId: 'failed-task', status: TaskStatus.Failed });
            mockTaskRepo.find.mockResolvedValue([failedTask, currentTask]);

            await job.run(currentTask);

            expect(mockResultRepo.findOne).not.toHaveBeenCalled();
        });

        it('sets output to null for a preceding task that is still in progress (no result yet)', async () => {
            const currentTask    = makeTask({ taskId: 'current' });
            const inProgressTask = makeTask({ taskId: 'task-running', taskType: TaskType.Analysis, status: TaskStatus.InProgress });
            mockTaskRepo.find.mockResolvedValue([inProgressTask, currentTask]);

            const report = await job.run(currentTask);

            expect(report.tasks).toHaveLength(1);
            expect(report.tasks[0].output).toBeNull();
            expect(mockResultRepo.findOne).not.toHaveBeenCalled();
        });
    });
});
