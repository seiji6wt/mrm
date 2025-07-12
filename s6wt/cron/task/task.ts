import { schedule } from "node-cron";
import { v4 as uuidv4 } from 'uuid';

export type TaskProp = {
    id?: string;
    name: string;
    cronStart: string; // Cron expression for task start
    cronStop?: string; // Optional cron expression for task end
    enabled?: boolean;
    options: any; // Additional properties for the task
}


export class Task {
    protected _taskProp?: TaskProp; // <-- changed to protected

    init(prop: TaskProp): void {
        this._taskProp = {
            id: prop.id || uuidv4(),
            name: prop.name,
            cronStart: prop.cronStart,
            cronStop: prop.cronStop,
            enabled: prop.enabled,
            options: prop.options || {}
        };
    }

    get id(): string {
        return this._taskProp?.id!;
    }

    get name(): string {
        return this._taskProp?.name || 'Unnamed Task';
    }

    get cronStart(): string {
        return this._taskProp?.cronStart || '';
    }

    get cronStop(): string | undefined {
        return this._taskProp?.cronStop;
    }

    get enabled(): boolean {
        return this._taskProp?.enabled ?? true;
    }

    private _isRunning: boolean = false;

    get isRunning(): boolean {
        return this._isRunning;
    }

    start(): void {
        if (this.enabled && !this._isRunning) {
            this._isRunning = true; // Logic to start the task
            console.log(`### ${new Date()}: Task ${this.name} started!`);
        }
    }

    stop(): void {
        if (this._isRunning) {
            this._isRunning = false; // Logic to stop the task
            console.log(`### ${new Date()}: Task ${this.name} stopped!`);
        }
    }
}

export interface ITask {
    id: string;
    name: string;
    cronStart: string;
    cronStop?: string;
    enabled: boolean;
    isRunning: boolean;
    start(): void;
    stop(): void;
    init(prop: TaskProp): void
}
