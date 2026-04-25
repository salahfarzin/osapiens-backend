import type { Job } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { AppDataSource } from '../data-source';
import { TaskStatus } from '../types';
import { DataSource } from 'typeorm';

export interface TaskReport {
    taskId: string;
    type: string;
    output: unknown;
}

export interface Report {
    workflowId: string;
    tasks: TaskReport[];
    finalReport: string;
}

export class ReportGenerationJob implements Job {
    private readonly dataSource: DataSource;

    constructor(dataSource: DataSource = AppDataSource) {
        this.dataSource = dataSource;
    }

    async run(task: Task): Promise<Report> {
        console.log(`Generating report for workflow ${task.workflow.workflowId}...`);

        const taskRepository = this.dataSource.getRepository(Task);
        const resultRepository = this.dataSource.getRepository(Result);

        // Fetch all tasks for this workflow ordered by step, excluding the current task
        const workflowTasks = await taskRepository.find({
            where: { workflow: { workflowId: task.workflow.workflowId } },
            order: { stepNumber: 'ASC' },
        });

        // Include all preceding tasks — completed ones (have a resultId) and failed ones
        const precedingTasks = workflowTasks.filter(
            (item) => item.taskId !== task.taskId,
        );

        const taskReports: TaskReport[] = await Promise.all(
            precedingTasks.map(async (t): Promise<TaskReport> => {
                let output: unknown = null;

                if (t.resultId != null) {
                    const result = await resultRepository.findOne({
                        where: { resultId: t.resultId },
                    });

                    if (result?.data) {
                        try {
                            output = JSON.parse(result.data);
                        } catch {
                            output = result.data;
                        }
                    }
                } else if (t.status === TaskStatus.Failed) {
                    output = { error: `Task ${t.taskId} failed` };
                }

                return { taskId: t.taskId, type: t.taskType, output };
            }),
        );

        return {
            workflowId: task.workflow.workflowId,
            tasks: taskReports,
            finalReport: 'Aggregated data and results',
        };
    }
}
