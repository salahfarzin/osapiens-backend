import { DataSource } from 'typeorm';
import { Task } from '../../models/Task';
import { Result } from '../../models/Result';
import { Workflow } from '../../models/Workflow';
import { TaskStatus, WorkflowStatus, TaskType } from '../../types';

export async function seedWorkflow(
    dataSource: DataSource,
    clientId = 'client-1',
): Promise<Workflow> {
    const repo = dataSource.getRepository(Workflow);
    return repo.save(repo.create({ clientId, status: WorkflowStatus.InProgress }));
}

export async function seedTask(
    dataSource: DataSource,
    workflow: Workflow,
    overrides: Partial<Task> = {},
): Promise<Task> {
    const repo = dataSource.getRepository(Task);
    return repo.save(
        repo.create({
            clientId: workflow.clientId,
            geoJson: '{}',
            status: TaskStatus.Queued,
            taskType: TaskType.Analysis,
            stepNumber: 1,
            workflow,
            ...overrides,
        }),
    );
}

export async function seedResult(
    dataSource: DataSource,
    task: Task,
    data: unknown,
): Promise<Result> {
    const resultRepo = dataSource.getRepository(Result);
    const saved = await resultRepo.save(
        resultRepo.create({ taskId: task.taskId, data: JSON.stringify(data) }),
    );
    await dataSource.getRepository(Task).update(task.taskId, { resultId: saved.resultId });
    return saved;
}
