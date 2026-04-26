import { Job } from './Job';
import { Task } from '../models/Task';

export class EmailNotificationJob implements Job {
    async run(task: Task, previousResult?: unknown): Promise<{ notified: boolean; previousResult?: unknown }> {
        console.log(`Sending email notification for task ${task.taskId}...`);

        if (previousResult !== undefined) {
            console.log(`Notification received prior result:`, previousResult);
        }
        
        // Perform notification work
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Email sent!');

        return { notified: true, previousResult };
    }
}