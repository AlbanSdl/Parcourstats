declare global {
    interface Window {
        messenger: Recipient<"front">
    }
}

type RecipientSide = "back" | "front";
type RemoteRecipientSide<S extends RecipientSide> = Exclude<RecipientSide, S>;
type SidedQuery<Side extends RecipientSide> = keyof {
    [K in keyof ArgsMapping as Side extends keyof ArgsMapping[K] ? K : never]: unknown;
}
type SendableQuery<Side extends RecipientSide> = keyof {
    [K in keyof ArgsMapping as Side extends keyof ArgsMapping[K] ? 
        ArgsMapping[K][RemoteRecipientSide<Side>] extends [any] ? K : never : never]: unknown;
}
type SidedQueryArguments<S extends RecipientSide, Q extends SidedQuery<RecipientSide>> = S extends keyof ArgsMapping[Q] ?
    ArgsMapping[Q][S] extends [...infer R] ? R : [void] : [void];
type RawRequest<T = unknown> = [channelId: number, healthy: boolean, ...args: T[]];

export abstract class Recipient<S extends RecipientSide> {
    readonly #openedChannels: Map<
        number, {
            onSuccess: (...value: SidedQueryArguments<RemoteRecipientSide<S>, SidedQuery<S>>) => void;
            onError: (errorMessage?: string) => void;
        }
    > = new Map;
    #modifier = 1;
    #sent = false;
    #listenedQueries: Set<Query> = new Set;
    #placeholders: Set<Query> = new Set;

    public async send<Q extends SendableQuery<S>>(
        query: Q, ...args: SidedQueryArguments<S, Q>
    ): Promise<SidedQueryArguments<RemoteRecipientSide<S>, Q>[0]> {
        if (!this.canSend(query, ...args))
            throw new Error(`Cannot send invalid message (#${query})`);
        this.#sent = true;
        return new Promise((res, rej) => {
            const id = this.generateId();
            this.#openedChannels.set(id, {
                onSuccess: res as any,
                onError: rej
            });
            if (!this.#listenedQueries.has(query) && !this.#placeholders.has(query)) {
                this.#placeholders.add(query);
                this.setupListener(query, () => {
                    throw new Error("Unhandled event")
                })
            }
            this.sendInternal(query, id, true, ...args);
        });
    }

    public on<Q extends SendableQuery<RemoteRecipientSide<S>>>(
        query: Q, action: (...args: SidedQueryArguments<RemoteRecipientSide<S>, Q>) => Promise<SidedQueryArguments<S, Q>[0]>
    ) {
        if (this.#placeholders.has(query)) {
            this.#placeholders.delete(query);
            this.unregisterInternal(query);
        }
        this.#listenedQueries.add(query);
        this.setupListener(query, action);
    }

    private setupListener<Q extends SidedQuery<RemoteRecipientSide<S>>>(
        query: Q, action: (...args: SidedQueryArguments<RemoteRecipientSide<S>, Q>) => Promise<SidedQueryArguments<S, Q>[0]>
    ) {
        this.registerInternal(query, async (reply, id, healthy, ...args) => {
            try {
                if (!this.#sent) {
                    this.#modifier = Math.sign(id) * -1;
                    this.#sent = true;
                }
                if (this.#openedChannels.has(id)) {
                    const channel = this.#openedChannels.get(id);
                    this.#openedChannels.delete(id);
                    if (healthy) channel.onSuccess(...args as any)
                    else channel.onError(args[0] as string)
                }
                else if (this.canReceive(query, ...args)) {
                    const result = await action(...args as any);
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

    protected abstract canSend(query: Query, ...args: unknown[]): query is SendableQuery<S>;
    protected abstract canReceive(query: Query, ...args: unknown[]): query is SidedQuery<RemoteRecipientSide<S>>;
    protected abstract sendInternal(query: Query, ...request: RawRequest): void;
    protected abstract registerInternal(
        query: Query, callback: (reply: (query: Query, ...request: RawRequest) => void, ...request: RawRequest) => void
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
    DATA = "dtr",
    LOCALIZE = "loc",
    OPEN_EXTERNAL = "ext",
    SETTINGS_GET = "get",
    SETTINGS_SET = "set",
    WINDOW_EXIT = "wex",
    WINDOW_MAXIMIZE = "max",
    WINDOW_MINIMIZE = "min"
}

interface ArgsMapping {
    [Query.DATA]: {
        front: [op: "select", table: "study" | "global" | "user", year?: number]
        | [op: "insert", table: "study", entry: Study]
        | [op: "insert", table: "global", entry: GlobalRankRecord]
        | [op: "insert", table: "user", entry: UserRankRecord];
        back: [content: void | Study[] | GlobalRankRecord[] | UserRankRecord[]];
    },
    [Query.LOCALIZE]: {
        front: [key: string];
        back: [localized: string];
    }
    [Query.OPEN_EXTERNAL]: {
        front: [uri: `${string}://${string}`];
        back: [void];
    },
    [Query.SETTINGS_GET]: {
        front: [void];
        back: [
            settings: {
                lang?: "fr" | "en";
                filter?: boolean;
                session_bounds?: [Date, Date];
                theme?: boolean;
            }
        ];
    },
    [Query.SETTINGS_SET]: {
        front: [property: "lang", locale: "fr" | "en"]
        | [property: "theme", useLightTheme: boolean]
        | [property: "filter", isFiltered: boolean]
        | [property: "session_bounds", from: Date, to: Date];
        back: [void]
    },
    [Query.WINDOW_EXIT]: {
        front: [void];
        back: [void];
    },
    [Query.WINDOW_MAXIMIZE]: {
        front: [void];
        back: [isMaximized: boolean];
    },
    [Query.WINDOW_MINIMIZE]: {
        front: [void];
        back: [void];
    }
}