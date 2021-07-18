import { createElement } from "structure/element";
import { AppNotification } from "./notification";
import type { Selector } from "./selector";

export class Adapter<T extends object> {
    public readonly element!: HTMLDivElement;
    private readonly proxier!: ProxyHandler<T>;
    private readonly contents!: Array<{
        proxy: T, revoke: () => void
    }>;
    private op: number = 0;

    constructor(private readonly holder: Adapter.Holder<T>, wrapper: Element) {
        this.proxier = listenChanges((target, key, from) =>
            this.holder.update(target, this.element.querySelector(
                `[adapter-binding=${this.holder.idify(target)}]`), key, from));
        wrapper.appendChild(this.element = createElement({
            classes: ["list", "adapter"]
        }));
        this.contents = [];
        wrapper.append(this.element);
    }

    public async push(on: Selector<any>, ...items: T[]) {
        return ++this.op && Promise.all(items.map(async item => {
            if (this.contents.length <= 0) while (this.element.firstElementChild)
                this.element.firstElementChild.remove();
            const hold = Proxy.revocable<T>(item, this.proxier);
            this.contents.push(hold);
            const holder = await this.holder.bind(hold.proxy);
            holder?.setAttribute("adapter-binding", this.holder.idify(item));
            return [holder, hold.proxy] as const;
        })).then(async opt => {
            if (this.contents.length <= 0) {
                while (this.element.firstElementChild) this.element.firstElementChild.remove();
                const empty = await this.holder.onEmpty()
                if (this.contents.length <= 0) this.element.append(empty);
            }
            opt.filter(element => !!element[0])
                .forEach(element => on.append(element[0], false));
            return opt.map(op => op[1]);
        }).catch(async error => {
            this.raise(error);
            return [] as T[];
        });
    }

    public async raise(error: any) {
        if (!this.contents.length) {
            const opId = this.op;
            const errored = await this.holder.onError(error);
            if (this.op === opId && !!errored) this.element.append(errored);
        } else {
            new AppNotification({
                content: Promise.resolve(this.holder.onError(error))
                    .then(value => value.textContent),
                flags: AppNotification.Type.ERROR
            });
        }
    }

    public async remove(...items: T[]) {
        return ++this.op && Promise.all(items.map(async item => {
            this.holder.onDestroy?.(item);
            this.element.querySelector( `[adapter-binding=${
                this.holder.idify(item)}]`)?.remove();
            this.contents.find(prox => prox.proxy === item)?.revoke?.();
        })).then<void>();
    }

    public get values() {
        return this.contents.map(value => value.proxy);
    }
}

export namespace Adapter {
    export interface Holder<T> {
        bind(item: T): Promise<HTMLElement> | HTMLElement;
        idify(item: T): string;
        onDestroy?(item: T): Promise<void> | void;
        onEmpty(): Promise<HTMLElement> | HTMLElement;
        onError(error: any): Promise<HTMLElement> | HTMLElement;
        update<K extends keyof T>(item: T, element: HTMLElement, property: K, from: T[K]): Promise<void> | void;
    }
}

function listenChanges<T extends object>(
    handler: <K extends keyof T>(target: T, key: K, from: T[K]) => void
): ProxyHandler<T> {
    const handlerInternal = <K extends keyof T, A extends any[]>(
        target: T, key: K, native: (...args: [T, K, ...A]) => void, ...args: A
    ) => {
        const previousValue = JSON.stringify(target[key]);
        return native.call(null, target, key, ...args) &&
            !!(`!${handler(target, key as keyof T, JSON.parse(previousValue))}`);
    }
    return {
        defineProperty: (target, key, descriptor) => handlerInternal(
            target, key as keyof T, Reflect.defineProperty, descriptor
        ),
        deleteProperty: (target, key) => handlerInternal(
            target, key as keyof T, Reflect.deleteProperty
        ),
        set: (target, key, value, receiver) => handlerInternal(
            target, key as keyof T, Reflect.set, value, receiver
        )
    }
}