import { ClientSyncRequest } from "../../common/window";
import { createElement } from "./element";

export abstract class Activity {
    private readonly cachedLocales: Map<string, string> = new Map();
    public root?: HTMLDivElement;

    /** Called just before the activity is added to view */
    public abstract onCreate(from?: Activity): void;
    /** Called just after the activity has been added to view */
    public abstract onCreated(): void;
    /** Called just after the activity has been removed from view */
    public abstract onDestroyed(): void;

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