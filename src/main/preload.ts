import { contextBridge, ipcRenderer } from "electron";
import { BackendRequest, ClientRequest, ClientSyncRequest } from "../common/window";

contextBridge.exposeInMainWorld('bridge', {
    send: (command: ClientRequest, ...details: any[]): void => {
        switch (command) {
            case ClientRequest.WINDOW_EXIT:
            case ClientRequest.WINDOW_MAXIMIZE:
            case ClientRequest.WINDOW_MINIMIZE:
                ipcRenderer.send(command);
                break;
            case ClientRequest.ERROR_DISPATCH:
                const allowedData = details[0];
                ipcRenderer.send(command,
                    typeof allowedData === "string" ? allowedData : "");
                break;
            case ClientRequest.DATA_REQUEST:
                ipcRenderer.send(command, ...details);
                break;
            default:
                throw new Error(`Cannot send invalid event ${command}`);
        }
    },
    sendSync: (command: ClientSyncRequest, ...details: any[]): any => {
        switch (command) {
            case ClientSyncRequest.LOCALE_GET:
                if (typeof details[0] !== "string") return details[0];
                return ipcRenderer.sendSync(command, details[0]);
            default:
                throw new Error(`Cannot send invalid event ${command}`);
        }
    },
    on: (command: BackendRequest, callback: (...details: any[]) => any): void => {
        switch (command) {
            case BackendRequest.DATA_RESPONSE:
            case BackendRequest.ERROR_DISPATCH:
            case BackendRequest.WINDOW_MAXIMIZED:
                ipcRenderer.on(command, (...args) => callback(...args.slice(1)));
                break;
            default:
                throw new Error(`Cannot listen for invalid event ${command}`);
        }
    }
})