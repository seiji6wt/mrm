'use strict';

import OBSWebSocket from 'obs-websocket-js';
import { log } from 'console';
import { schedule } from 'node-cron';
import { spawn, exec, execSync, ChildProcess } from 'child_process';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RETRY_LIMIT = 6; // Maximum number of retries for OBS connection
const RETRY_DELAY = 2000; // Delay between retries in milliseconds

type OBSCameraProp = {
    obs_websocket_address: string;
    obs_websocket_port: string;
    obs_websocket_password: string;
    obs_path: string;
};

export class OBSCamera {
    private obs: any = null;
    private obsProcess: ChildProcess | null = null;
    private outputFilename: string = '';
    private inprogress: boolean = false;
    public prop: OBSCameraProp;

    constructor() {
        this.prop = {
            obs_websocket_address: "",
            obs_websocket_port: "",
            obs_websocket_password: "",
            obs_path: "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe"
        };
    }

    init(prop: Partial<OBSCameraProp>) {
        this.inprogress = false;
        this.prop.obs_websocket_address = prop.obs_websocket_address || this.prop.obs_websocket_address;
        this.prop.obs_websocket_port = prop.obs_websocket_port || this.prop.obs_websocket_port;
        this.prop.obs_websocket_password = prop.obs_websocket_password || this.prop.obs_websocket_password;
        this.prop.obs_path = prop.obs_path || this.prop.obs_path;
    }

    // connect OBS WebSocket
    async connectOBS(retryCount: number = 0): Promise<void> {

        try {
            if (this.obs && this.obs.connected) {
                log('OBS WebSocket is already connected');
                return;
            }

            this.obs = new OBSWebSocket();
            const url = `${this.prop.obs_websocket_address}:${this.prop.obs_websocket_port}`;
            console.log('Connecting to OBS WebSocket at', url);
            console.log('Using password:', this.prop.obs_websocket_password ? '******' : 'none');
            await this.obs.connect(url, this.prop.obs_websocket_password);
            console.log('connected to OBS WebSocket at', url);
        } catch (error: any) {
            console.error('Could not connect to OBS WebSocket:', error);
            if (retryCount < RETRY_LIMIT) {
                retryCount++;
                console.log(`Retrying connection (${retryCount}/${RETRY_LIMIT})...`);
                await sleep(RETRY_DELAY);
                return this.connectOBS(retryCount); // Retry connection
            }
            throw error;
        }
    }

    // start recording
    async startRecording(): Promise<{ status: string; message: string }> {
        try {
            await this.connectOBS();
            this.obs.on('RecordStateChanged', (data: any) => {
                if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
                    console.log('recording stopped');
                    this.outputFilename = data.outputPath;
                    console.log('output filename:', data.outputPath);
                }
            });
            await this.obs.call('StartRecord');
            console.log('recording started');
            this.inprogress = true;
            return { status: 'success', message: 'start recording' };
        } catch (error: any) {
            console.error('start recording error:', error);
            throw { status: 'error', message: error.message };
        }
    }

    // stop recording
    async stopRecording(): Promise<{ status: string; message: string }> {
        try {
            if (this.obs && !this.obs.connected) {
                await this.connectOBS();
                console.log('stopping recording');
                const status = await this.obs.call('GetRecordStatus');
                if (status.outputActive) {
                    await this.obs.call('StopRecord');
                }
                await this.obs.disconnect();
            }
            this.obs = null;
            this.inprogress = false;
            return { status: 'success', message: 'stop recording' };
        } catch (error: any) {
            console.error('stop recording error:', error);
            throw { status: 'error', message: error.message };
        }
    }

    // Start OBS Studio process
    async startOBSProcess(): Promise<void> {
        const parts = this.prop.obs_path.split(/[/\\]/);
        const obsCmd = parts.pop()!;
        const obsPath = parts.join('/');

        const isObsRunning = (): boolean => {
            try {
                const result = execSync('tasklist').toString();
                return result.toLowerCase().includes(obsCmd.toLowerCase());
            } catch (e) {
                console.error('Failed to check OBS process:', e);
                return false;
            }
        };

        if (this.obsProcess || isObsRunning()) {
            console.log('OBS process is already running.');
            return;
        }
        const args = ['--disable-shutdown-check', '--startrecording--minimize-to-tray'];
        this.obsProcess = spawn(obsCmd, args, { cwd: obsPath, detached: true, stdio: 'ignore' });
        if (this.obsProcess && this.obsProcess.pid) {
            console.log(`OBS process started. PID: ${this.obsProcess.pid}`);
        } else {
            console.error('Failed to start OBS process.');
            throw new Error('Failed to start OBS process.');
        }
        this.obsProcess.unref();
    }

    // Stop OBS Studio process
    async stopOBSProcess(): Promise<void> {
        if (!this.obsProcess) {
            console.log('OBS process is not running or some one started.');
            return;
        }
        try {
            process.kill(this.obsProcess.pid!);
            console.log('OBS process stopped.');
        } catch (err) {
            console.error('Failed to stop OBS process:', err);
        }
        this.obsProcess = null;
    }
}


// let obs = new OBSCamera();
// obs.init({
//     obs_websocket_address: 'ws://localhost',
//     obs_websocket_port: '4455',
//     obs_websocket_password: process.env.OBS_WEBSOCKET_PASSWORD || '',
//     obs_path: 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe'
// });
// obs.startOBSProcess().then(() => {
//     console.log('OBS process started.');
//     sleep(1000).then(() => {
//         obs.connectOBS().then(() => {
//             console.log('Connected to OBS WebSocket.');
//             sleep(1000).then(() => {
//                 obs.startRecording().then(() => {
//                     console.log('Recording started.');
//                     sleep(1000).then(() => {
//                         obs.stopRecording().then(() => {
//                             console.log('Recording stopped.');
//                             obs.stopOBSProcess().then(() => {
//                                 console.log('OBS process stopped.');
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// });



// // // Start OBS Studio process
// await sleep(1000); // Wait for OBS to start
// await obs.startRecording(); // Start recording
// await sleep(1000); // Wait for recording to start
// await obs.stopRecording(); // Stop recording
// await sleep(1000); // Wait for recording to stop
// await obs.stopOBSProcess(); // Stop OBS Studio process
// process.exit(0); // Exit the process






