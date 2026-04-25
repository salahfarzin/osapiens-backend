import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { ReportGenerationJob } from './ReportGenerationJob';
import { TaskType } from '../types';

const jobMap: Record<string, () => Job> = {
    [TaskType.Analysis]: () => new DataAnalysisJob(),
    [TaskType.Notification]: () => new EmailNotificationJob(),
    [TaskType.PolygonArea]: () => new PolygonAreaJob(),
    [TaskType.Report]: () => new ReportGenerationJob(),
};

export function getJobForTaskType(taskType: string): Job {
    const jobFactory = jobMap[taskType];
    if (!jobFactory) {
        throw new Error(`No job found for task type: ${taskType}`);
    }
    return jobFactory();
}