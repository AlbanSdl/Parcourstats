import { ipcMain } from "electron"
import { Query, Recipient } from "../common/window";
import { ParcourStats } from "./index";

export class Ipc extends Recipient<"back"> {
    constructor(private readonly process: ParcourStats) {
        super();
    }
    protected canSend(query: Query): query is Query.LOCALIZE | Query.OPEN_EXTERNAL | Query.SETTINGS_GET | Query.WINDOW_MAXIMIZE {
        return true;
    }
    protected canReceive(query: Query): query is Query {
        return true;
    }
    protected sendInternal(query: Query, ...args: unknown[]): void {
        this.process.window?.webContents?.send(query, ...args);
    }
    protected registerInternal(query: Query, callback: (reply: (query: Query, channelId: number, healthy: boolean, ...args: unknown[]) => void, channelId: number, healthy: boolean, ...args: unknown[]) => void): void {
        ipcMain.on(query, (ipcEvent, channelId, healthy, ...args) => {
            callback(
                ipcEvent.reply as (query: Query, channelId: number, healthy: boolean, ...args: unknown[]) => void,
                channelId,
                healthy,
                ...args
            );
        })
    }
    protected unregisterInternal(query: Query): void {
        ipcMain.removeAllListeners(query!!);
    }
}