import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus, TaskStatus } from '../types';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';

export class TaskRunner {
    constructor(
        private readonly taskRepository: Repository<Task>,
        private readonly resultRepository: Repository<Result>,
        private readonly workflowRepository: Repository<Workflow>,
    ) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);
        const job = getJobForTaskType(task.taskType);

        try {
            console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);

            // Resolve the output of the dependency task, if one exists.
            let previousResult: unknown;
            if (task.dependsOnTaskId) {
                const depResult = await this.resultRepository.findOne({ where: { taskId: task.dependsOnTaskId } });
                if (depResult?.data) {
                    previousResult = JSON.parse(depResult.data);
                }
            }

            const taskResult = await job.run(task, previousResult);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);
            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult || {});
            await this.resultRepository.save(result);
            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);

        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);

            throw error;
        }

        const currentWorkflow = await this.workflowRepository.findOne({ where: { workflowId: task.workflow.workflowId }, relations: ['tasks'] });

        if (currentWorkflow) {
            const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
            const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

            if (anyFailed) {
                currentWorkflow.status = WorkflowStatus.Failed;
            } else if (allCompleted) {
                currentWorkflow.status = WorkflowStatus.Completed;
            } else {
                currentWorkflow.status = WorkflowStatus.InProgress;
            }

            if (allCompleted || anyFailed) {
                const taskOutputs = await Promise.all(
                    currentWorkflow.tasks.map(async (t) => {
                        const taskResult = await this.resultRepository.findOne({ where: { taskId: t.taskId } });
                        return {
                            taskId: t.taskId,
                            taskType: t.taskType,
                            stepNumber: t.stepNumber,
                            status: t.status,
                            output: taskResult?.data ? JSON.parse(taskResult.data) : null,
                        };
                    })
                );
                currentWorkflow.finalResult = JSON.stringify({ tasks: taskOutputs });
            }

            await this.workflowRepository.save(currentWorkflow);
        }
    }
}