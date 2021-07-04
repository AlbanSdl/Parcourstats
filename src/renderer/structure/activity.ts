import { Query } from "../../common/window";
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
    protected root?: HTMLDivElement;
    protected get container() {
        return document.getElementById("app-container");
    }

    protected onCreate(_?: Activity): HTMLDivElement | Promise<HTMLDivElement> {
        return createElement({
            classes: ["activity"]
        })
    }

    protected onCreated(): void | Promise<void> {
        this.creationLock.created = true;
        this.creationLock.locks.forEach(res => res());
        delete this.creationLock.locks;
    }

    protected onDestroy(): void | Promise<void> {
    }

    protected async waitCreation<T = void>(this: Activity, value?: T): Promise<T> {
        return new Promise(res => {
            if (this.creationLock.created) res(value);
            else this.creationLock.locks.push(() => res(value));
        });
    }

    protected set title(title: string) {
        document.querySelector("#app-bar .title").textContent = title;
    }

    protected clearCachedLocale() {
        this.cachedLocales.clear();
    }

    protected async getLocale(stringId: string) {
        return this.cachedLocales.get(stringId) ?? window.messenger.send(Query.LOCALIZE, stringId).then(localized => {
            this.cachedLocales.set(stringId, localized);
            return localized;
        })
    }
}