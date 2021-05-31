import { contextBridge, ipcRenderer } from "electron";
import { BridgedRequestType } from "../common/window";

contextBridge.exposeInMainWorld('bridge', {
    send: (command: BridgedRequestType, ...details: any[]): void => {
        switch (command) {
            case BridgedRequestType.APP_LIFECYCLE_EXIT:
            case BridgedRequestType.APP_LIFECYCLE_MAXIMIZE:
            case BridgedRequestType.APP_LIFECYCLE_MINIMIZE:
                ipcRenderer.send(command);
                break;
            case BridgedRequestType.ERROR:
                ipcRenderer.send(command, details[0]);
                break;
            default:
                throw new Error(`Cannot send invalid event ${command}`);
        }
    },
    sendSync: (command: BridgedRequestType, ...details: any[]): any => {
        switch (command) {
            case BridgedRequestType.GET_LOCALE:
                return ipcRenderer.sendSync(command, details[0]);
            default:
                throw new Error(`Cannot send invalid event ${command}`);
        }
    },

    on: (command: BridgedRequestType, callback: (...details: any[]) => any): void => {
        switch (command) {
            case BridgedRequestType.ERROR:
                ipcRenderer.on(command, callback);
                break;
            default:
                throw new Error(`Cannot listen for invalid event ${command}`);
        }
    }
})