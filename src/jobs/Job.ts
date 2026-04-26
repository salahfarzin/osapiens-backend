import {Task} from "../models/Task";

export interface Job {
    run(task: Task, previousResult?: unknown): Promise<unknown>;
}