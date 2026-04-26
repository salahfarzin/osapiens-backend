import type { Job } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { TaskStatus } from '../types';
import { Repository } from 'typeorm';

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
    private readonly taskRepository: Repository<Task>;
    private readonly resultRepository: Repository<Result>;

    constructor(
        taskRepository: Repository<Task>,
        resultRepository: Repository<Result>,
    ) {
        this.taskRepository = taskRepository;
        this.resultRepository = resultRepository;
    }

    async run(task: Task, _previousResult?: unknown): Promise<Report> {
        console.log(`Generating report for workflow ${task.workflow.workflowId}...`);

        const workflowTasks = await this.taskRepository.find({
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
                    const result = await this.resultRepository.findOne({
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
