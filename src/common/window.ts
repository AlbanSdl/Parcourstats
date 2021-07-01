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
    unregister(command: BackendRequest): void;
}

export enum BackendRequest {
    DATA_RESPONSE = "data_response",
    ERROR_DISPATCH = "error",
    SETTINGS_GET = "settingg",
    SETTINGS_SET = "settings",
    WINDOW_MAXIMIZED = "maximized"
}

export enum ClientRequest {
    DATA_REQUEST = "data_request",
    ERROR_DISPATCH = "error",
    OPEN_EXTERNAL = "external",
    SETTINGS_GET = "settingqg",
    SETTINGS_SET = "settingqs",
    WINDOW_EXIT = "exitapp",
    WINDOW_MINIMIZE = "minimizeapp",
    WINDOW_MAXIMIZE = "maximizeapp"
}

export enum ClientSyncRequest {
    LOCALE_GET = "locale",
}

type Request = BackendRequest | ClientRequest | ClientSyncRequest;
type RequestArgs<T extends Request> = T extends keyof BridgeRequestMap ? ArgsOf<BridgeRequestMap[T]> : void[];
type ArgsOf<T> = T extends { args: readonly [...infer R] } ? R : void[]
type ResponseArgs<T extends Request> = T extends keyof BridgeRequestMap ?
    BridgeRequestMap[T] extends { return: infer R } ? R : void : void;
type ReplyWith<T extends Request> = Request & (T extends keyof BridgeRequestMap ?
    BridgeRequestMap[T] extends { replyWith: infer R } ? R : void : void);
type ReplyFunction<T extends Request> = (command: ReplyWith<T>, ...args: RequestArgs<ReplyWith<T>>) => void;

interface BridgeRequestMap {
    [ClientSyncRequest.LOCALE_GET]: {
        args: readonly [key: string],
        return: string
    },
    "error": {
        args: readonly [message: string]
    },
    [BackendRequest.WINDOW_MAXIMIZED]: {
        args: readonly [isMaximized: boolean]
    },
    [BackendRequest.DATA_RESPONSE]: {
        args: readonly [opId: string, content: Study[] | GlobalRankRecord[] | UserRankRecord[] | Error]
    },
    [BackendRequest.SETTINGS_GET]: {
        args: readonly [
            opId: string,
            settings: {
                lang?: "fr" | "en";
                filter?: boolean;
                session_bounds?: [Date, Date]
            }
        ]
    },
    [BackendRequest.SETTINGS_SET]: {
        args: readonly [opId: string, errorMessage?: string]
    },
    [ClientRequest.DATA_REQUEST]: {
        args: readonly [op: "select", opId: string, table: "study" | "global" | "user", year?: number]
        | readonly [op: "insert", opId: string, table: "study", entry: Study]
        | readonly [op: "insert", opId: string, table: "global", entry: GlobalRankRecord]
        | readonly [op: "insert", opId: string, table: "user", entry: UserRankRecord],
        replyWith: BackendRequest.DATA_RESPONSE
    },
    [ClientRequest.WINDOW_MAXIMIZE]: {
        replyWith: BackendRequest.WINDOW_MAXIMIZED
    },
    [ClientRequest.SETTINGS_GET]: {
        args: readonly [opId: string]
        replyWith: BackendRequest.SETTINGS_GET
    },
    [ClientRequest.SETTINGS_SET]: {
        args: readonly [opId: string, property: "lang", locale: "fr" | "en"]
        | readonly [opId: string, property: "filter", isFiltered: boolean]
        | readonly [opId: string, property: "session_bounds", from: Date, to: Date],
        replyWith: BackendRequest.SETTINGS_SET;
    },
    [ClientRequest.OPEN_EXTERNAL]: {
        args: readonly [uri: `${string}://${string}`]
    }
}