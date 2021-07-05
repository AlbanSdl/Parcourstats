import { contextBridge, ipcRenderer } from "electron";
import { Query, Recipient } from "../common/window";

class FrontendIpc extends Recipient<"front"> {
    protected canSend(query: Query, ...args: unknown[]): boolean {
        switch (query) {
            case Query.CONTEXT:
            case Query.WINDOW_EXIT:
            case Query.WINDOW_MAXIMIZE:
            case Query.WINDOW_MINIMIZE:
                return args.length === 0;
            case Query.OPEN_EXTERNAL:
                const allowedData = args[0];
                return typeof allowedData === "string";
            case Query.DATA:
            case Query.SETTINGS_GET:
            case Query.SETTINGS_SET:
                return true;
            case Query.LOCALIZE:
                return typeof args[0] === "string";
            default:
                return false;
        }
    }
    protected canReceive(query: Query, ..._args: unknown[]): boolean {
        switch (query) {
            case Query.CONTEXT:
            case Query.DATA:
            case Query.LOCALIZE:
            case Query.OPEN_EXTERNAL:
            case Query.WINDOW_MAXIMIZE:
            case Query.SETTINGS_GET:
            case Query.SETTINGS_SET:
                return true;
        }
        return false;
    }
    protected sendInternal(query: Query, channelId: number, healthy: boolean, ...args: unknown[]): void {
        ipcRenderer.send(query, channelId, healthy, ...args);
    }
    protected registerInternal(query: Query, callback: any): void {
        ipcRenderer.on(query, (_, channelId, healthy, ...args) => callback(
            (query: Query, id: number, h: boolean, ...args: unknown[]) => this.sendInternal(query, id, h, ...args),
            channelId,
            healthy,
            ...args
        ));
    }
    protected unregisterInternal(query: Query): void {
        ipcRenderer.removeAllListeners(query!!);
    }
}

const front = new FrontendIpc();
contextBridge.exposeInMainWorld('messenger', {
    send: (query: any, ...args: any[]) => front.send(query, ...args),
    on: (query: any, action: any) => front.on(query, action),
    unregister: (query: any) => front.unregister(query)
})