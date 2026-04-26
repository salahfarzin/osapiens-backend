import {AppDataSource} from '../data-source';
import {Task} from '../models/Task';
import { Result } from '../models/Result';
import { Workflow } from '../models/Workflow';
import { TaskRunner } from './taskRunner';
import { TaskStatus } from '../types';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(
        taskRepository,
        AppDataSource.getRepository(Result),
        AppDataSource.getRepository(Workflow),
    );

    while (true) {
        const task = await taskRepository
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.workflow', 'workflow')
            .where('task.status = :status', { status: TaskStatus.Queued })
            .andWhere(
                `(task.dependsOnTaskId IS NULL OR EXISTS (
                    SELECT 1 FROM tasks dep 
                    WHERE dep.taskId = task.dependsOnTaskId 
                    AND dep.status = :completedStatus
                ))`,
                { completedStatus: TaskStatus.Completed }
            )
            .orderBy('task.stepNumber', 'ASC')
            .getOne();

        if (task) {
            try {
                await taskRunner.run(task);

            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}