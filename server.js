'use strict';

const express = require('express');
const cron = require('node-cron');
const OBSWebSocket = require('obs-websocket-js').default;
const fs = require('fs');
const path = require('path');
const { log } = require('console');
const app = express();
let obs = null

// Load Schedules from JSON file
const schedulesFilePath = path.join(`${__dirname}/conf`, 'Schedules.json');
let Schedules = { recording: { start: '', stop: '' } };

function loadSchedules() {
    if (fs.existsSync(schedulesFilePath)) {
        const data = fs.readFileSync(schedulesFilePath, 'utf-8');
        Schedules = JSON.parse(data);
        console.log('Schedules loaded:', Schedules);
    }
}

function saveSchedules() {
    fs.writeFileSync(schedulesFilePath, JSON.stringify(Schedules, null, 2), 'utf-8');
}

// Load schedules at startup
loadSchedules();

app.use(express.json());

// connect OBS WebSocket
async function connectOBS() {
    try {
        if (obs && obs.socket.connected) {
            log('OBS WebSocket is already connected');
            return;
        }
        obs = new OBSWebSocket();
        let obs_websocket_address = process.env.OBS_WEBSOCKET_ADDRESS;
        let obs_websocket_password = process.env.OBS_WEBSOCKET_PASSWORD;
        console.log('Connecting to OBS WebSocket at', obs_websocket_address);
        console.log('Using password:', obs_websocket_password ? '******' : 'none');

        await obs.connect(obs_websocket_address, obs_websocket_password);
        console.log('connected to OBS WebSocket at', obs_websocket_address);
    } catch (error) {
        console.error('Could not connect to OBS WebSocket:', error);
    }
}


// start recording
async function startRecording() {
    try {
        await connectOBS();
        await obs.call('StartRecord');
        console.log('recording started');
        return { status: 'success', message: 'start recording' };
    } catch (error) {
        console.error('start recording error:', error);
        return { status: 'error', message: error.message };
    }
}

// stop recording
async function stopRecording() {
    try {
        await connectOBS();
        await obs.call('StopRecord');
        await obs.disconnect();
        obs = null;
        console.log('Recording stopped');
        return { status: 'success', message: 'stop recording' };
    } catch (error) {
        console.error('stop recording error:', error);
        return { status: 'error', message: error.message };
    }
}

// set up cron schedules
function setupSchedules() {
    cron.schedule(Schedules.recording.start, async () => {
        console.log('Schedule: Start Recording');
        await startRecording();
    });

    cron.schedule(Schedules.recording.stop, async () => {
        console.log('Schedule: Stop Recording');
        await stopRecording();
    });

    console.log('Schedules have been set');
}

function setRecordingSchedule(start, stop) {
    Schedules.recording.start = start;
    Schedules.recording.stop = stop;
    saveSchedules();

    // Clear existing schedules
    cron.getTasks().forEach(task => task.stop());

    // Set new schedules
    setupSchedules();
}


// APIエンドポイント
app.post('/api/start-recording', async (req, res) => {
    const result = await startRecording();
    res.json(result);
});

app.post('/api/stop-recording', async (req, res) => {
    const result = await stopRecording();
    res.json(result);
});

// APIエンドポイント
app.post('/api/start-recording-time', async (req, res) => {
    const result = await startRecording();
    res.json(result);
});


// APIエンドポイント: 録画スケジュール設定
app.post('/api/set-recording-schedule', (req, res) => {
    const { start, stop } = req.body;
    if (!start || !stop) {
        return res.status(400).json({ status: 'error', message: 'start and stop cron expressions are required' });
    }
    setRecordingSchedule(start, stop);
    res.json({ status: 'success', message: 'recording schedule updated', start, stop });
});



// Start the Express server
const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    await connectOBS();
    await obs.disconnect();
    obs = null;
    setupSchedules();
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    if (obs && obs.socket.connected) {
        await obs.disconnect();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down server...');
    if (obs && obs.socket.connected) {
        await obs.disconnect();
    }
    process.exit(0);
});
