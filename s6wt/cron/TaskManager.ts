import cron from 'node-cron';
import { Task, ITask, TaskProp } from './task/task';
import { schedule, ScheduledTask } from 'node-cron';

type CronJob = {
    task: ITask;
    start: ScheduledTask;
    stop?: ScheduledTask;
}

export class TaskManager {

    private tasks: Map<string, CronJob> = new Map();

    addTask(task: ITask): void {
        if (this.tasks.has(task.id)) {
            throw new Error(`Task with id ${task.id} already exists.`);
        }

        console.log(`Adding task ${task.name} with id ${task.id} cronStart[${task.cronStart}] / cronStop[${task.cronStop}]...`);
        const cronJob: CronJob = {
            task: task,
            start: cron.schedule(task.cronStart, () => task.start()),
            stop: task.cronStop ? cron.schedule(task.cronStop, () => task.stop()) : undefined
        };

        this.tasks.set(task.id, cronJob);
        // Add to cron
        console.log(`Task ${task.name} added.`);
    }

    removeTask(taskId: string): void {
        if (!this.tasks.has(taskId)) {
            throw new Error(`Task with id ${taskId} does not exist.`);
        }
        // Remove from cron
        const job = this.tasks.get(taskId);
        if (job) {
            job.start.stop();
            job.stop?.stop();
            job.start.destroy();
            job.stop?.destroy();
            this.tasks.delete(taskId);
            console.log(`Task with id ${taskId} removed.`);
        }
    }

    async startAll(): Promise<void> {
        this.tasks.forEach(task => { task.start.start(); task.stop?.start(); });
    }

    async stopAll(): Promise<void> {
        this.tasks.forEach(task => { task.start.stop(); task.stop?.stop(); });
    }

    async destroyAll(): Promise<void> {
        this.tasks.forEach(task => { task.start.destroy(); task.stop?.destroy(); });
    }

    getTaskById(taskId: string): ITask | undefined {
        return this.tasks.get(taskId)?.task;
    }

    getAllTasks(): ITask[] {
        let tasksArray: ITask[] = [];
        this.tasks.forEach(task => tasksArray.push(task.task));
        return tasksArray
    }

    async destroy(): Promise<void> {
        await this.stopAll();
        await this.destroyAll();
        this.tasks.clear();
        console.log('TaskManager destroyed.');
    }
}

