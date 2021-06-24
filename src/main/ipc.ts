import { ipcMain } from "electron"
import { ParcourStats } from "./index";
import { BackendRequest, ClientRequest, ClientSyncRequest, ProcessBridge } from "../common/window"

export class Ipc implements ProcessBridge {
    constructor(private readonly process: ParcourStats) { }

    send(command: BackendRequest, ...args: any[]): void {
        this.process.window?.webContents?.send(command, ...args);
    }

    on(command: ClientRequest | ClientSyncRequest, callback: (context: {
        reply: () => void,
        args: any
    }) => any): void {
        ipcMain.on(command, (ipcEvent, ...args) => {
            const result = callback({
                reply: ipcEvent.reply as () => void,
                args
            });
            if (result !== null && result != undefined)
                ipcEvent.returnValue = result;
        })
    }
}