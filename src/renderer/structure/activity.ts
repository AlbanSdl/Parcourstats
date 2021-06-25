import { BackendRequest, ClientRequest, ClientSyncRequest } from "../../common/window";
import { createElement } from "./element";

export abstract class Activity {
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
    public root?: HTMLDivElement;

    /** Called just before the activity is added to view */
    public onCreate(_?: Activity): void {
        window.bridge.on(BackendRequest.DATA_RESPONSE, 
            (...args) => this.handleDataStream(...args))
    }

    /** Called just after the activity has been added to view */
    public onCreated(): void {
        this.creationLock.created = true;
        this.creationLock.locks.forEach(res => res());
        delete this.creationLock.locks;
    }

    /** Called just before the next activity is inflated to the view */
    public onDestroy(): void {
        const entries = Object.values(this.pendingDataRequests);
        if (entries.length > 0) {
            const errorMsg = this.getLocale("app.op.abort.destroyed")
            for (const control of entries) control.rej(errorMsg);
        }
        window.bridge.unregister(BackendRequest.DATA_RESPONSE);
    }

    /** Called just after the activity has been removed from view */
    public abstract onDestroyed(): void;

    private handleDataStream(opId: string, content: string | Study[] | GlobalRankRecord[] | UserRankRecord[]) {
        if (opId in this.pendingDataRequests) {
            const breakpoint = this.pendingDataRequests[opId];
            delete this.pendingDataRequests[opId];
            if (typeof content === "string") breakpoint.rej(content)
            else if (!Object.keys(content).length) breakpoint.rej(`${content}`);
            else breakpoint.res(content)
        }
    }

    protected async waitCreation<T>(this: Activity, value: T): Promise<T> {
        return new Promise(res => {
            if (this.creationLock.created) res(value);
            else this.creationLock.locks.push(() => res(value));
        });
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

    public set title(title: string) {
        document.querySelector("#app-bar .title").textContent = title;
    }

    public getLocale(stringId: string): string {
        const cached = this.cachedLocales.get(stringId);
        if (cached == null)
            this.cachedLocales.set(stringId, window.bridge.sendSync(ClientSyncRequest.LOCALE_GET, stringId));
        return cached ?? this.cachedLocales.get(stringId);
    }

    protected next(to: Activity, transition: Transition = Transition.NONE, invertTransition: boolean = false) {
        applyTransitionStyles(this.root!!, transition, false, invertTransition).then(() => {
            document.body.removeChild(this.root!!)
            delete this.root;
            this.onDestroyed();
        });
        this.cachedLocales.forEach(to.cachedLocales.set)
        this.onDestroy();
        to.createContext(this, transition, invertTransition);
    }

    protected createContext(from?: Activity, transition: Transition = Transition.NONE, invertTransition: boolean = false) {
        this.root = createElement({
            classes: ["activity"]
        });
        this.onCreate(from);
        document.getElementById("app-container").appendChild(this.root);
        applyTransitionStyles(this.root, transition, true, invertTransition);
        this.onCreated();
    }
}

export enum Transition {
    NONE = 0b00,
    SLIDE = 0b01,
    FADE = 0b10
}

async function applyTransitionStyles(root: HTMLDivElement, transition: Transition, isOpening: false, invert: boolean): Promise<void>;
function applyTransitionStyles(root: HTMLDivElement, transition: Transition, isOpening: true, invert: boolean): void;
function applyTransitionStyles(root: HTMLDivElement, transition: Transition, isOpening: boolean, invert: boolean): Promise<void> | void {
    const applied = [Transition.SLIDE, Transition.FADE].filter(tr => tr & transition).map(tr => Transition[tr].toLowerCase());
    const regularDirection = invert ? !isOpening : isOpening;
    const direction = regularDirection ? "in" : "out";
    applied.forEach(attr => root.setAttribute(attr, direction))
    if (isOpening) {
        root.getBoundingClientRect();
        applied.forEach(root.removeAttribute)
    } else if (applied.length > 0) {
        return new Promise(res => {
            setTimeout(() => {
                applied.forEach(attr => root.getAttribute(attr) === direction ? root.removeAttribute(attr) : 0)
                res();
            }, 500);
        })
    } else {
        applied.forEach(attr => root.getAttribute(attr) === direction ? root.removeAttribute(attr) : 0)
        return Promise.resolve();
    }
}