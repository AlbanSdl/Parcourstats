import { ipcMain } from "electron"
import { ParcourStats } from "./index";
import { BridgedRequestType, ProcessBridge } from "../common/window"

export class Ipc implements ProcessBridge {
    constructor(private readonly process: ParcourStats) {}
    send(command: BridgedRequestType, ...args: any[]): void {
        switch(command) {
            case BridgedRequestType.ERROR:
                this.process.window?.webContents?.send(command, args);
                break;
            default:
                throw new Error(`Cannot send invalid event ${command}`);
        }
    }

    on(command: BridgedRequestType, callback: (...args: any[]) => any): void {
        ipcMain.on(command, (ipcEvent, ...args) => {
            const result = callback(...args);
            if (result !== null && result != undefined)
                ipcEvent.returnValue = result;
        })
    }
}