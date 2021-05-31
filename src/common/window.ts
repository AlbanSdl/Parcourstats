declare global {
    interface Window {
        bridge: ClientBridge
    }
}

export declare interface ProcessBridge {
    send(command: BridgedRequestType.ERROR, details: string): void;
    on(command: BridgedRequestType.APP_LIFECYCLE_EXIT
        | BridgedRequestType.APP_LIFECYCLE_MAXIMIZE
        | BridgedRequestType.APP_LIFECYCLE_MINIMIZE,
        callback: () => void): void;
    on(command: BridgedRequestType.ERROR, callback: (details: string) => void): void;
    on(command: BridgedRequestType.GET_LOCALE, callback: (key: string) => string): void;
}

export declare interface ClientBridge {
    send(command: BridgedRequestType.APP_LIFECYCLE_EXIT 
        | BridgedRequestType.APP_LIFECYCLE_MAXIMIZE 
        | BridgedRequestType.APP_LIFECYCLE_MINIMIZE): void;
    send(command: BridgedRequestType.ERROR, details: string): void;
    sendSync(command: BridgedRequestType.GET_LOCALE, key: string): string;
    on(command: BridgedRequestType.ERROR, callback: (data: string) => any): void;
}

export enum BridgedRequestType {
    GET_LOCALE = "locale",
    ERROR = "error",
    APP_LIFECYCLE_EXIT = "exitapp",
    APP_LIFECYCLE_MINIMIZE = "minimizeapp",
    APP_LIFECYCLE_MAXIMIZE = "maximizeapp",
}