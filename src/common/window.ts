declare global {
    interface Window {
        bridge: ClientBridge
    }
}

export declare interface ProcessBridge {
    send<K extends BackendRequest>(command: K, ...args: RequestArgs<K>): void;
    on<K extends ClientRequest | ClientSyncRequest>(command: K, callback: (...data: RequestArgs<K>) => ResponseArgs<K>): void;
}

export declare interface ClientBridge {
    send<K extends ClientRequest>(command: K, ...args: RequestArgs<K>): void
    sendSync<K extends ClientSyncRequest>(command: K, ...args: RequestArgs<K>): ResponseArgs<K>
    on<K extends BackendRequest>(command: K, callback: (...data: RequestArgs<K>) => ResponseArgs<K>): void;
}

export enum BackendRequest {
    ERROR_DISPATCH = "error",
    WINDOW_MAXIMIZED = "maximized"
}

export enum ClientRequest {
    ERROR_DISPATCH = "error",
    WINDOW_EXIT = "exitapp",
    WINDOW_MINIMIZE = "minimizeapp",
    WINDOW_MAXIMIZE = "maximizeapp"
}

export enum ClientSyncRequest {
    LOCALE_GET = "locale",
}

type Request = BackendRequest | ClientRequest | ClientSyncRequest;
type RequestArgs<T extends Request> = T extends keyof BridgeRequestArgs ? 
    BridgeRequestArgs[T] extends { args: infer R } ? R : void[] : void[];
type ResponseArgs<T extends Request> = T extends keyof BridgeRequestArgs ?
    BridgeRequestArgs[T] extends { return: infer R } ? R : void : void;

interface BridgeRequestArgs {
    "locale": {
        args: [key: string],
        return: string
    },
    "error": {
        args: [message: string]
    },
    "maximized": {
        args: [isMaximized: boolean]
    }
}