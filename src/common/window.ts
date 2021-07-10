declare global {
    interface Window {
        messenger: Recipient<"front">
    }
}

type RecipientSide = "back" | "front";
type SendableQuery<S extends RecipientSide> = keyof {
    [K in keyof Args as S extends keyof Args[K] ? K : never]: unknown;
}
type SendableQueryArguments<S extends RecipientSide, Q extends SendableQuery<RecipientSide>> = S extends keyof Args[Q] ?
    Args[Q][S] extends [any, ...infer R] ? R : never : never;

type RemoteRecipientSide<S extends RecipientSide> = Exclude<RecipientSide, S>;
type RemoteQueryResponse<S extends RecipientSide, Q extends SendableQuery<RemoteRecipientSide<S>>> = 
    RemoteRecipientSide<S> extends keyof Args[Q] ? Args[Q][RemoteRecipientSide<S>] extends [infer R, ...any] ? R : never : never;

type RawRequest<T extends any[] = any> = [channelId: number, healthy: true, ...args: T]
    | [channelId: number, healthy: false, ...args: [string]];

export abstract class Recipient<S extends RecipientSide> {
    readonly #openedChannels: Map<
        number, {
            onSuccess: (value: RemoteQueryResponse<RemoteRecipientSide<S>, SendableQuery<S>>) => void;
            onError: (errorMessage?: string) => void;
        }
    > = new Map;
    #modifier = 1;
    #sent = false;
    #listenedQueries: Set<Query> = new Set;
    #placeholders: Set<Query> = new Set;

    public async send<Q extends SendableQuery<S>>(
        query: Q, ...args: SendableQueryArguments<S, Q>
    ): Promise<RemoteQueryResponse<RemoteRecipientSide<S>, Q>> {
        if (!this.canSend(query, ...args))
            throw new Error(`Cannot send invalid message (#${query})`);
        this.#sent = true;
        return new Promise((res, rej) => {
            const id = this.generateId();
            this.#openedChannels.set(id, {
                onSuccess: res as () => void,
                onError: rej
            });
            if (!this.#listenedQueries.has(query) && !this.#placeholders.has(query)) {
                this.#placeholders.add(query);
                this.setupListener(query);
            }
            this.sendInternal(query, id, true, ...args);
        });
    }

    public on<Q extends SendableQuery<RemoteRecipientSide<S>>>(
        query: Q, action: (...args: SendableQueryArguments<RemoteRecipientSide<S>, Q>) => Promise<RemoteQueryResponse<S, Q>>
    ) {
        if (this.#placeholders.has(query)) {
            this.#placeholders.delete(query);
            this.unregisterInternal(query);
        }
        this.#listenedQueries.add(query);
        this.setupListener(query, action);
    }

    private setupListener<Q extends SendableQuery<RemoteRecipientSide<S>>>(
        query: Q, action: (...args: SendableQueryArguments<RemoteRecipientSide<S>, Q>) => Promise<RemoteQueryResponse<S, Q>>
    ): void;
    private setupListener<Q extends SendableQuery<S>>(
        query: Q
    ): void;
    private setupListener<Q extends SendableQuery<S> | SendableQuery<RemoteRecipientSide<S>>>(
        query: Q, action?: Q extends SendableQuery<RemoteRecipientSide<S>> ?
            ((...args: SendableQueryArguments<RemoteRecipientSide<S>, Q>) => Promise<RemoteQueryResponse<S, Q>>) : never
    ) {
        this.registerInternal(query, async (reply, ...[id, healthy, ...args]) => {
            try {
                if (!this.#sent) {
                    this.#modifier = Math.sign(id) * -1;
                    this.#sent = true;
                }
                if (this.#openedChannels.has(id)) {
                    const channel = this.#openedChannels.get(id);
                    this.#openedChannels.delete(id);
                    if (healthy) channel.onSuccess(args[0] as 
                        RemoteQueryResponse<RemoteRecipientSide<S>, SendableQuery<S>>)
                    else channel.onError(args[0] as string)
                }
                else if (!action) throw new Error(`No event handler has been registered for event ${query}`);
                else if (this.canReceive(query, ...args as SendableQueryArguments<RemoteRecipientSide<S>, Q>)) {
                    const result = await (action as ((...args: SendableQueryArguments<RemoteRecipientSide<S>, Q>) => Promise<RemoteQueryResponse<S, Q>>))
                        (...args as SendableQueryArguments<RemoteRecipientSide<S>, Q>) as RemoteQueryResponse<S, Q>;
                    if (healthy) reply(query, id, true, result);
                }
                else if (healthy) throw new Error("Invalid event");
                else console.warn("Error captured from remote:", args[0])
            } catch (error) {
                reply(query, id, false, `${error}`)
            }
        });
    }

    public unregister(query: SendableQuery<RemoteRecipientSide<S>>) {
        this.#listenedQueries.delete(query);
        this.unregisterInternal(query);
    }

    protected abstract canSend<Q extends SendableQuery<S>>(
        query: Q,
        ...args: SendableQueryArguments<S, Q>
    ): boolean;
    protected abstract canReceive<Q extends SendableQuery<RemoteRecipientSide<S>>>(
        query: Q,
        ...args: SendableQueryArguments<RemoteRecipientSide<S>, Q>
    ): boolean;
    protected abstract sendInternal<Q extends SendableQuery<S>>(
        query: Q,
        ...request: RawRequest<SendableQueryArguments<S, Q>>
    ): void;
    protected abstract sendInternal<Q extends SendableQuery<RemoteRecipientSide<S>>>(
        query: Q,
        ...request: RawRequest<[RemoteQueryResponse<RemoteRecipientSide<S>, Q>]>
    ): void;
    protected abstract registerInternal<Q extends SendableQuery<S>>(
        query: Q, callback: (reply: undefined, ...request: RawRequest<[RemoteQueryResponse<RemoteRecipientSide<S>, Q>]>) => void
    ): void;
    protected abstract registerInternal<Q extends SendableQuery<RemoteRecipientSide<S>>>(
        query: Q, callback: (reply: (
            query: Q,
            ...request: RawRequest<[RemoteQueryResponse<S, Q>]>
        ) => void, ...request: RawRequest<SendableQueryArguments<RemoteRecipientSide<S>, Q>>) => void
    ): void;
    protected abstract unregisterInternal(query: Query): void;

    private generateId() {
        let id: number;
        while (id === undefined || this.#openedChannels.has(id)) {
            if (id === 0) throw new Error("Should not use id 0")
            id = (Math.trunc(Math.random() * 1e3) + 1) * this.#modifier;
        }
        return id;
    }
}

export enum Query {
    CONTEXT = "ctx",
    DATA = "dtr",
    LOCALIZE = "loc",
    OPEN_EXTERNAL = "ext",
    READY = "rdy",
    SETTINGS_GET = "get",
    SETTINGS_SET = "set",
    WINDOW_EXIT = "wex",
    WINDOW_MAXIMIZE = "max",
    WINDOW_MINIMIZE = "min"
}

interface Args {
    [Query.CONTEXT]: {
        front: [res: {
            appVersion: string,
            electronVersion: string,
            nodeJsVersion: string,
            chromiumVersion: string,
            dependencies: {
                [name: string]: {
                    version: string,
                    description?: string,
                    author?: string,
                    license?: string
                }
            }
        }]
    }
    [Query.DATA]: {
        front: [res: Study[], op: "select", table: "study", year?: number]
        | [res: GlobalRankRecord[], op: "select", table: "global", year?: number]
        | [res: UserRankRecord[], op: "select", table: "user", year?: number]
        | [res: void, op: "insert", table: "study", value: Study]
        | [res: void, op: "insert", table: "global", value: GlobalRankRecord]
        | [res: void, op: "insert", table: "user", value: UserRankRecord]
    },
    [Query.LOCALIZE]: {
        front: [res: string, key: string]
    }
    [Query.OPEN_EXTERNAL]: {
        front: [res: void, uri: `${string}://${string}`]
    }
    [Query.READY]: {
        front: [res: void]
    }
    [Query.SETTINGS_GET]: {
        front: [res: {
            lang: Locale,
            filter: boolean,
            theme: boolean
        }]
    }
    [Query.SETTINGS_SET]: {
        front: [res: void, property: "lang", locale: Locale]
        | [res: void, property: "filter", isFiltered: boolean]
        | [res: void, property: "theme", useLightTheme: boolean]
    }
    [Query.WINDOW_EXIT]: {
        front: [res: void]
    }
    [Query.WINDOW_MAXIMIZE]: {
        front: [res: boolean]
        back: [res: void, isMaximized: boolean]
    }
    [Query.WINDOW_MINIMIZE]: {
        front: [res: void]
    }
}

export type Locale = "en" | "fr";