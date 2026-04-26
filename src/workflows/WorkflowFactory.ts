import fs from 'node:fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus, WorkflowStatus } from '../types';

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    dependsOn?: number;
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {
    constructor(private readonly dataSource: DataSource) {}

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson - The geoJson data string for tasks (customize as needed).
     * @returns A promise that resolves to the created Workflow.
     */
    async createWorkflowFromYAML(filePath: string, clientId: string, geoJson: string): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;
        const workflowRepository = this.dataSource.getRepository(Workflow);
        const taskRepository = this.dataSource.getRepository(Task);
        const workflow = new Workflow();

        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;

        const savedWorkflow = await workflowRepository.save(workflow);

        const sortedSteps = [...workflowDef.steps].sort((a, b) => a.stepNumber - b.stepNumber);

        const stepToTaskId = new Map<number, string>();

        for (const step of sortedSteps) {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.workflow = savedWorkflow;

            if (step.dependsOn !== undefined) {
                const depTaskId = stepToTaskId.get(step.dependsOn);
                if (!depTaskId) {
                    throw new Error(
                        `Step ${step.stepNumber} declares dependsOn: ${step.dependsOn}, but that step has not been defined (or has a higher stepNumber).`
                    );
                }
                task.dependsOnTaskId = depTaskId;
            }

            const saved = await taskRepository.save(task);
            stepToTaskId.set(step.stepNumber, saved.taskId);
        }

        return savedWorkflow;
    }
}