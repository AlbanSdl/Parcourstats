import { BackendRequest, ClientRequest, ClientSyncRequest } from "../../common/window";
import { createElement } from "./element";
import { Layout } from "./layout";

export abstract class Activity extends Layout {
    private readonly cachedLocales: Map<string, string> = new Map();
    private readonly creationLock: {
        created: boolean
        locks: (() => void)[]
    } = {
        created: false,
        locks: []
    }
    private readonly pendingDataRequests: {
        [opId: string]: {
            res: (value: Study[] | GlobalRankRecord[] | UserRankRecord[]) => void,
            rej: (msg: string) => void
        }
    } = {};
    private readonly pendingSettingsRequests: {
        [opId: string]: {
            res: (settings: {
                lang?: "fr" | "en",
                filter?: boolean,
                session_bounds?: [Date, Date]
            }) => void,
            rej: (msg: Error) => void
        }
    } = {};
    protected root?: HTMLDivElement;
    protected get container() {
        return document.getElementById("app-container");
    }

    protected onCreate(_?: Activity): HTMLDivElement {
        window.bridge.on(BackendRequest.DATA_RESPONSE, 
            (...args) => this.handleDataStream(...args))
        window.bridge.on(BackendRequest.SETTINGS_GET, (opId, settings) => {
            if ("name" in settings) this.pendingSettingsRequests[opId]?.rej(settings as Error);
            else this.pendingSettingsRequests[opId]?.res(settings);
            delete this.pendingSettingsRequests[opId];
        })
        return createElement({
            classes: ["activity"]
        })
    }

    protected onCreated(): void {
        this.creationLock.created = true;
        this.creationLock.locks.forEach(res => res());
        delete this.creationLock.locks;
    }

    protected onDestroy(): void {
        const entries = Object.values(this.pendingDataRequests);
        if (entries.length > 0) {
            const errorMsg = this.getLocale("app.op.abort.destroyed")
            for (const control of entries) control.rej(errorMsg);
        }
        window.bridge.unregister(BackendRequest.DATA_RESPONSE);
    }

    private handleDataStream(opId: string, content: Error | Study[] | GlobalRankRecord[] | UserRankRecord[]) {
        if (opId in this.pendingDataRequests) {
            const breakpoint = this.pendingDataRequests[opId];
            delete this.pendingDataRequests[opId];
            if ("name" in content) breakpoint.rej(`${content}`);
            else breakpoint.res(content)
        }
    }

    protected async waitCreation<T>(this: Activity, value: T): Promise<T> {
        return new Promise(res => {
            if (this.creationLock.created) res(value);
            else this.creationLock.locks.push(() => res(value));
        });
    }

    protected get settings(): Promise<{lang?: "fr" | "en", filter?: boolean, session_bounds?: [Date, Date]}> {
        return new Promise((res, rej) => {
            let id: string;
            while (!id || id in this.pendingSettingsRequests)
                id = Math.trunc(Math.random() * 1000).toString();
            this.pendingSettingsRequests[id] = {res, rej};
            window.bridge.send(ClientRequest.SETTINGS_GET, id);
        })
    }

    protected async requestData(operation: "select", type: "study", year?: number): Promise<Study[]>
    protected async requestData(operation: "select", type: "global", year?: number): Promise<GlobalRankRecord[]>
    protected async requestData(operation: "select", type: "user", year?: number): Promise<UserRankRecord[]>
    protected async requestData(operation: "insert", type: "study", entry: Study): Promise<[]>
    protected async requestData(operation: "insert", type: "global", entry: GlobalRankRecord): Promise<[]>
    protected async requestData(operation: "insert", type: "user", entry: UserRankRecord): Promise<[]>
    protected async requestData(operation: "select" | "insert", type: "study" | "global" | "user", data?: number | Study | GlobalRankRecord | UserRankRecord) {
        return new Promise((res, rej) => {
            let id: string;
            while (!id || id in this.pendingDataRequests) id = Math.trunc(Math.random() * 1000).toString();
            this.pendingDataRequests[id] = {res, rej};
            if (operation === "select") {
                if (operation === "select" && (typeof data === "number" || typeof data === "undefined"))
                    window.bridge.send(ClientRequest.DATA_REQUEST, operation, id, type, data);
                else {
                    rej(this.getLocale("app.op.error.wrong"))
                    delete this.pendingDataRequests[id];
                }
            } else {
                if (typeof data === "object")
                    window.bridge.send(ClientRequest.DATA_REQUEST, operation, id, type, data);
                else {
                    rej(this.getLocale("app.op.error.wrong"))
                    delete this.pendingDataRequests[id];
                }
            }
        });
    }

    protected set title(title: string) {
        document.querySelector("#app-bar .title").textContent = title;
    }

    protected getLocale(stringId: string): string {
        const cached = this.cachedLocales.get(stringId);
        if (cached == null)
            this.cachedLocales.set(stringId, window.bridge.sendSync(ClientSyncRequest.LOCALE_GET, stringId));
        return cached ?? this.cachedLocales.get(stringId);
    }
}