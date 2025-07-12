'use strict';

import express from 'express';
import cron, { schedule } from 'node-cron';
import fs from 'fs';
import path from 'path';
import { TaskManager } from './s6wt/cron/TaskManager';
import { OBSTask } from './s6wt/cron/task/OBSTask';
import { ITask, Task } from './s6wt/cron/task/task';


const app = express();

// Load Schedules from JSON file
const schedulesFilePath = path.join(`${process.cwd()}/conf`, 'Schedules.json');
let schedules: any = [];

function loadSchedules() {
    if (fs.existsSync(schedulesFilePath)) {
        const data = fs.readFileSync(schedulesFilePath, 'utf-8');
        schedules = JSON.parse(data);
        console.log('Schedules loaded:', schedules);
    }
}

function saveSchedules() {
    fs.writeFileSync(schedulesFilePath, JSON.stringify(schedules, null, 2), 'utf-8');
}

// Load schedules at startup
loadSchedules();

app.use(express.json());


// API endpoints
// app.post('/api/start-recording', async (req, res) => {
//     const result = await startRecording();
//     res.json(result);
// });

// app.post('/api/stop-recording', async (req, res) => {
//     const result = await stopRecording();
//     res.json(result);
// });

// app.post('/api/start-recording-time', async (req, res) => {
//     const result = await startRecording();
//     res.json(result);
// });

// app.post('/api/set-recording-schedule', (req, res) => {
//     const { start, stop } = req.body;
//     if (!start || !stop) {
//         return res.status(400).json({ status: 'error', message: 'start and stop cron expressions are required' });
//     }
//     setRecordingSchedule(start, stop);
//     res.json({ status: 'success', message: 'recording schedule updated', start, stop });
// });

const taskManager = new TaskManager();

// Start the Express server
const PORT = 6000;
app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    schedules.forEach((schedule: any) => {
        console.log(`Loading task: ${schedule.name} with class: ${schedule.class} and cronStart: ${schedule.start}`);
        const taskProp = {
            name: schedule.name || 'Unnamed Task',
            cronStart: schedule.cronStart,
            cronStop: schedule.cronStop,
            enabled: schedule.enabled ?? true,
            options: schedule.options || {}
        }
        const classMap: Record<string, new () => Task> = {
            OBSTask: OBSTask,
            Task: Task
        };
        const task: ITask = new classMap[schedule.class]();
        if (!task) {
            console.error(`Task class ${schedule.class} not found.`);
            return;
        }
        if (taskProp.cronStart.startsWith('check:')) {
            const min = Number(taskProp.cronStart.substring(6)) * 60 * 1000; // Convert minutes to milliseconds
            const nextCheck = new Date(new Date().getTime() + min);
            taskProp.cronStart = `${nextCheck.getMinutes()} ${nextCheck.getHours()} * * *`; // Set cron to next hour
        }
        if (taskProp.cronStop && taskProp.cronStop.startsWith('check:')) {
            const min = Number(taskProp.cronStop.substring(6)) * 60 * 1000; // Convert minutes to milliseconds
            const nextCheck = new Date(new Date().getTime() + min);
            taskProp.cronStop = `${nextCheck.getMinutes()} ${nextCheck.getHours()} * * *`; // Set cron to next hour
        }
        task.init(taskProp);
        taskManager.addTask(task);
    });

});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await taskManager.stopAll();
    await taskManager.destroyAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down server...');
    await taskManager.stopAll();
    await taskManager.destroyAll();
    process.exit(0);
});
