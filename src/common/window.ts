declare global {
    interface Window {
        bridge: ClientBridge
    }
}

export declare interface ProcessBridge {
    send<K extends BackendRequest>(command: K, ...args: RequestArgs<K>): void;
    on<K extends ClientRequest | ClientSyncRequest>(command: K, callback: (context: {
        reply: ReplyFunction<K>,
        args: RequestArgs<K>
    }) => ResponseArgs<K>): void;
}

export declare interface ClientBridge {
    send<K extends ClientRequest>(command: K, ...args: RequestArgs<K>): void
    sendSync<K extends ClientSyncRequest>(command: K, ...args: RequestArgs<K>): ResponseArgs<K>
    on<K extends BackendRequest>(command: K, callback: (...data: RequestArgs<K>) => ResponseArgs<K>): void;
}

export enum BackendRequest {
    DATA_RESPONSE = "data_response",
    ERROR_DISPATCH = "error",
    WINDOW_MAXIMIZED = "maximized"
}

export enum ClientRequest {
    DATA_REQUEST = "data_request",
    ERROR_DISPATCH = "error",
    WINDOW_EXIT = "exitapp",
    WINDOW_MINIMIZE = "minimizeapp",
    WINDOW_MAXIMIZE = "maximizeapp"
}

export enum ClientSyncRequest {
    LOCALE_GET = "locale",
}

type Request = BackendRequest | ClientRequest | ClientSyncRequest;
type RequestArgs<T extends Request> = T extends keyof BridgeRequestMap ? 
    BridgeRequestMap[T] extends { args: [...infer R] } ? R : void[] : void[];
type ResponseArgs<T extends Request> = T extends keyof BridgeRequestMap ?
    BridgeRequestMap[T] extends { return: infer R } ? R : void : void;
type ReplyWith<T extends Request> = Request & (T extends keyof BridgeRequestMap ?
    BridgeRequestMap[T] extends { replyWith: infer R } ? R : void : void);
type ReplyFunction<T extends Request> = (command: ReplyWith<T>, ...args: RequestArgs<ReplyWith<T>>) => void;

interface BridgeRequestMap {
    "locale": {
        args: [key: string],
        return: string
    },
    "error": {
        args: [message: string]
    },
    [BackendRequest.WINDOW_MAXIMIZED]: {
        args: [isMaximized: boolean]
    },
    [BackendRequest.DATA_RESPONSE]: {
        args: [opId: string, content: Study[] | GlobalRankRecord[] | UserRankRecord[] | string]
    },
    [ClientRequest.DATA_REQUEST]: {
        args: [op: "select", opId: string, table: "study" | "global" | "user", year?: number]
        | [op: "insert", opId: string, table: "study", entry: Study]
        | [op: "insert", opId: string, table: "global", entry: GlobalRankRecord]
        | [op: "insert", opId: string, table: "user", entry: UserRankRecord],
        replyWith: BackendRequest.DATA_RESPONSE
    },
    [ClientRequest.WINDOW_MAXIMIZE]: {
        replyWith: BackendRequest.WINDOW_MAXIMIZED
    }
}