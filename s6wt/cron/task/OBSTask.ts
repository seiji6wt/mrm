'use strict';

import { OBSCamera } from "../../io/obs/obscamera";
import { Task, TaskProp } from "./task";

const sleep: (ms: number) => Promise<void> = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class OBSTask extends Task {
    private obsc: OBSCamera = new OBSCamera();

    init(prop: TaskProp): void {
        super.init(prop);
        this.obsc = new OBSCamera();

        const env_port = prop.options.obs_websocket_port.startsWith('env:') ? prop.options.obs_websocket_port.substring(4) : ''
        const env_address = prop.options.obs_websocket_address.startsWith('env:') ? prop.options.obs_websocket_address.substring(4) : ''
        const env_password = prop.options.obs_websocket_password.startsWith('env:') ? prop.options.obs_websocket_password.substring(4) : ''
        const env_obs_path = prop.options.obs_path.startsWith('env:') ? prop.options.obs_path.substring(4) : ''

        this.obsc.init({
            obs_websocket_port: env_port ? process.env[env_port] : prop.options.obs_websocket_port,
            obs_websocket_address: env_address ? process.env[env_address] : prop.options.obs_websocket_address,
            obs_websocket_password: env_password ? process.env[env_password] : prop.options.obs_websocket_password,
            obs_path: env_obs_path ? process.env[env_obs_path] : prop.options.obs_path
        });
        this.test();
    }

    async start(): Promise<void> {
        await this.obsc.startOBSProcess();
        await this.obsc.connectOBS();
        await this.obsc.startRecording();
        super.start();
    }

    async stop(): Promise<void> {
        await this.obsc.stopRecording();
        await this.obsc.stopOBSProcess();
        super.stop();
    }

    async test(): Promise<{ status: string, message: string }> {
        console.log('start OBS connection check');
        await this.obsc.startOBSProcess()
        await this.obsc.connectOBS();
        await sleep(1000) // Wait for OBS to start
        await this.obsc.connectOBS()
        await this.obsc.stopOBSProcess()
        console.log('OBS connection checked');

        return { status: 'success', message: 'OBS connection checked' };
    }

}
