import { createElement } from "structure/element";
import { AppNotification } from "notification";
import type { Selector } from "selector";

export class Adapter<T extends object> {
    public readonly element!: HTMLDivElement;
    private readonly proxier!: ProxyHandler<T>;
    private readonly contents: Array<{
        proxy: T & {
            hidden?: boolean
        }, revoke: () => void
    }> = [];
    private op: number = 0;
    private filterInternal?: (item: T) => boolean;
    private readonly pending: Map<T, () => void> = new Map;

    constructor(private readonly holder: Adapter.Holder<T>, wrapper: Element) {
        this.proxier = listenChanges(async (target, key, from) => {
            const previousLength = this.visibleList.length;
            const op = this.op;
            await this.holder.update(target, this.element.querySelector(`[${
                Adapter.bindingAttribute}="${await this.holder.idify(target)}"]`), key, from)
            if (key === "hidden" && !this.pending.has(target))
                this.contextualize(op, previousLength);
            else {
                const value = this.pending.get(target);
                this.pending.delete(target);
                value.call(null);
            }
        });
        wrapper.appendChild(this.element = createElement({
            classes: ["list", "adapter"]
        }));
    }

    private async contextualize<K>(opId: number, opLength: number, ...value: K[]) {
        if (this.visibleList.length <= 0) {
            const empty = await this.holder.onEmpty(this.contents.length !== 0);
            empty?.classList?.add("context");
            if (this.visibleList.length <= 0) {
                const current = this.element.querySelector(`.context:not([${Adapter.bindingAttribute}])`);
                if (!current) this.element.append(empty);
                else current.replaceWith(empty);
            }
        } else if (opLength <= 0)
            this.element.querySelectorAll(`.context:not([${Adapter.bindingAttribute}])`).forEach(ctx => ctx.remove())
        if (this.op === opId && this.visibleList.length !== opLength) await Promise.resolve(
            this.holder.onLengthUpdate?.(opLength, this.visibleList.length)).catch();
        return value;
    }

    public async push(on?: Selector<any>, ...items: T[]) {
        const opId = ++this.op, opLength = this.visibleList.length;
        return Promise.all(items.map(async item => {
            const hold = Proxy.revocable<T>(item, this.proxier);
            this.contents.push(hold);
            const holder = await this.holder.bind(hold.proxy);
            holder?.setAttribute(Adapter.bindingAttribute, await this.holder.idify(item));
            return [holder, hold.proxy] as const;
        })).then(async opt => Promise.all(opt.map(async element => {
            if (!element[0]) return;
            on?.append(element[0], false)
            const promise = new Promise<void>(res => this.pending.set(element[1], res));
            element[1]["hidden"] = (this.filterInternal ?? (() => false))(element[1]);
            return promise.then(() => element[1]);
        }))).then(data => this.contextualize(opId, opLength, ...data))
        .catch(async error => {
            this.raise(error);
            return [] as T[];
        });
    }

    public async raise(error: any) {
        if (!this.visibleList.length) {
            const opId = this.op;
            const errored = await this.holder.onError(error);
            errored?.classList?.add("context");
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
        const opId = ++this.op;
        const opLength = this.visibleList.length;
        return Promise.all(items.map(async item => {
            this.holder.onDestroy?.(item);
            this.element.querySelector( `[${Adapter.bindingAttribute}="${
                await this.holder.idify(item)}"]`)?.remove();
            this.contents.splice(this.contents.findIndex(
                prox => prox.proxy === item), 1)[0]?.revoke?.();
        })).then(async () => {
            if (this.op === opId && opLength !== this.visibleList.length) await Promise.resolve(
                this.holder.onLengthUpdate?.(opLength, this.visibleList.length)).catch();
        });
    }

    public async filter(hide: (item: T) => boolean) {
        const opId = ++this.op;
        this.filterInternal = hide;
        const length = this.visibleList.length;
        const pending = this.contents.map(it => 
            new Promise<void>(res => this.pending.set(it.proxy, res)));
        for (const item of this) this.filterItem(item);
        await Promise.all(pending);
        await this.contextualize(opId, length);
    }

    public async filterItem(item: T & { hidden?: boolean }) {
        if (this.visibleList.length <= 0) this.element.querySelectorAll(
            `.context:not([${Adapter.bindingAttribute}])`).forEach(child => child.remove())
        item.hidden = this.filterInternal?.call(undefined, item);
    }

    public get asList() {
        return this.contents.map(value => value.proxy);
    }

    public get visibleList() {
        return this.asList.filter(item => item.hidden !== true);
    }

    public *[Symbol.iterator]() {
        for (const entry of this.contents) yield entry.proxy;
    }
}

export namespace Adapter {
    export const bindingAttribute = "adapter-binding";
    export interface Holder<T> {
        bind(item: T): Promise<HTMLElement> | HTMLElement;
        idify(item: T): Promise<string> | string;
        onDestroy?(item: T): Promise<void> | void;
        onEmpty(isFiltered: boolean): Promise<HTMLElement> | HTMLElement;
        onError(error: any): Promise<HTMLElement> | HTMLElement;
        onLengthUpdate?(from: number, to: number): Promise<void> | void;
        update<K extends keyof T>(item: T & { hidden?: boolean; }, element: HTMLElement, property: K, from: T[K]): Promise<void> | void;
    }
}

function listenChanges<T extends object>(
    handler: <K extends keyof T>(target: T, key: K, from: T[K]) => void
): ProxyHandler<T> {
    return {
        set: (target, key, value, receiver) => {
            const previousValue = JSON.stringify([target[key]]);
            return Reflect.set(target, key, value, target) &&
                !!(`!${handler(receiver, key as keyof T, JSON.parse(previousValue)[0])}`);
        }
    }
}