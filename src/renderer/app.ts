import { createElement } from "structure/element";
import { Icon } from "components/icon";
import { Activity } from "./structure/activity";
import { Selector } from "components/selector";
import { Fragment } from "./structure/fragment";
import { DatasetGraphEntry, Graph } from "components/graph";

interface Data {
    [name: string]: {
        sessions?: Study[],
        global?: GlobalRankRecord[],
        user?: UserRankRecord[]
    }
};

enum LoadingMask {
    STUDY = 0b001,
    GLOBAL = 0b010,
    USER = 0b100
}

export class Home extends Activity {
    private side: HTMLElement;
    private sideHeader: Selector<string>;
    private sideList: Selector<string>;
    private readonly data: Data = {};
    private fragment: Overview;
    private loadingState = 0;
    private providers: WeakRef<(d: Data) => void>[] = []

    public create() {
        this.createContext();
    }

    protected onCreate(): HTMLDivElement {
        const root = super.onCreate();
        root.classList.add("home");
        this.title = this.getLocale("app.name")
        root.classList.add("home");
        this.side = createElement({
            classes: ["side"]
        });
        const sideHeaders = createElement({
            classes: ["headers"]
        })
        this.sideHeader = new Selector({
            container: sideHeaders,
            extractor: e => e?.getAttribute?.("action"),
            isUnique: true,
            neverEmpty: true,
            listener: console.log
        })
        const sideList = createElement({
            classes: ["list", "loadable"]
        })
        this.sideList = new Selector({
            container: sideList,
            extractor: e => e?.getAttribute?.("name"),
            isUnique: true,
            listener: console.log
        })
        this.side.append(sideHeaders, sideList);
        sideList.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const container = createElement({
            classes: ["container"]
        });
        root.append(this.side, container);
        const fragProvider = () => new Promise<Data>(res => {
            if (this.loadingState >= 8) res(this.data);
            else this.providers.push(new WeakRef(res));
        });
        this.fragment = new Overview(this, container, fragProvider, key => this.getLocale(key));

        this.requestData("select", "study")
            .then(async v => await this.waitCreation(v))
            .catch(err => {
                console.error(err);
                return this.getLocale("wishes.list.error");
            })
            .then(values => {
                while (!!this.sideList.childrenElements.length) 
                    this.sideList.childrenElements.item(0).remove();
                const updateResult = this.update(values, "sessions");
                if (updateResult.added === 0) {
                    const emptyPlaceholder = createElement({
                        classes: ["empty"]
                    });
                    emptyPlaceholder.textContent = updateResult.error ?? this.getLocale("wishes.list.empty");
                    this.side.lastElementChild.append(emptyPlaceholder)
                } else {
                    for (const wish in this.data) {
                        if (!this.data[wish].sessions) continue;
                        const wishContainer = createElement({
                            classes: ["wish"],
                            ripple: true,
                            name: wish
                        });
                        const wishSession = createElement({
                            classes: ["session"]
                        });
                        wishSession.textContent = `${this.getLocale(`wish.session.${
                            this.data[wish].sessions.length > 1 ? 'plural' : 'singular'}`)}: ${
                            this.data[wish].sessions.map(s => s.year).sort().join(", ")}`;
                        wishContainer.append(wishSession);
                        this.sideList.append(wishContainer)
                    }
                }
                this.runProviders(LoadingMask.STUDY);
            })
            .catch(err => {
                const errorPlaceholder = createElement({
                    classes: ["empty"]
                });
                errorPlaceholder.textContent = this.getLocale("wishes.list.error");
                this.side.lastElementChild.append(errorPlaceholder)
                console.error(err);
            })
        this.requestData("select", "global")
            .then(async v => await this.waitCreation(v))
            .catch(console.error)
            .then(values => this.update(values || [], "global"))
            .then(() => this.runProviders(LoadingMask.GLOBAL));
        this.requestData("select", "user")
            .then(async v => await this.waitCreation(v))
            .catch(console.error)
            .then(values => this.update(values || [], "user"))
            .then(() => this.runProviders(LoadingMask.USER));
        return root;
    }

    private runProviders(mask: LoadingMask) {
        if (this.loadingState < 7) {
            this.loadingState |= mask;
            if (this.loadingState >= 7) {
                for (const ref of this.providers) 
                    ref.deref()?.(this.data);
                this.providers.splice(0, this.providers.length)
            }
        }
    }

    protected onCreated(): void {
        (this.fragment as Overview).create();
        const wishHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-list"
        });
        wishHeader.textContent = this.getLocale("wishes.list");
        this.sideHeader.append(wishHeader);
        super.onCreated();
    }

    protected onDestroyed(): void {
        this.sideHeader.stop();
        delete this.sideHeader;
        delete this.side;
    }

    private update(values: string | Study[], key: "sessions"): { added: number; error?: string }
    private update(values: string | GlobalRankRecord[], key: "global"): { added: number; error?: string }
    private update(values: string | UserRankRecord[], key: "user"): { added: number; error?: string }
    private update(values: string | Study[] | GlobalRankRecord[] | UserRankRecord[], key: "sessions" | "global" | "user") {
        if (typeof values !== "string" && !!values.length) {
            for (const wish of values) {
                if (wish.name in this.data) {
                    const entries = this.data[wish.name]!![key];
                    if (!entries)
                        this.data[wish.name][key] = [wish];
                    else if (
                        (key === "sessions" && !(<Study[]>entries).find(s => s.year === wish.year))
                        || ((key === "global" || key === "user") && !(<(GlobalRankRecord | UserRankRecord)[]>entries)
                            .find(s => s.record_time === (<GlobalRankRecord | UserRankRecord>wish).record_time))
                    ) entries.push(wish);
                } else this.data[wish.name] = {
                    [key]: [wish]
                };
            }
        }
        return {
            added: typeof values === "string" ? 0 : values.length,
            error: typeof values === "string" ? values : undefined
        }
    }
}

class Overview extends Fragment {
    private data: () => Promise<Data>;
    private locale: (key: string) => string;
    private readonly timeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric"
    })
    private graph?: Graph;

    constructor(
        context?: Home,
        container?: HTMLElement,
        data?: () => Promise<Data>,
        locale?: (key: string) => string
    ) {
        super();
        this.context = context;
        this.container = container;
        this.data = data;
        this.locale = locale;
    }

    protected onCreate(from?: Fragment): HTMLDivElement {
        const root = super.onCreate(from);
        root.classList.add("overview", "loadable");
        root.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const wrapper = createElement({
            classes: ["container"]
        });
        root.prepend(wrapper);
        const absTitle = createElement({
            classes: ["title"]
        })
        absTitle.textContent = this.locale("wishes.overview.abstract.title")
        wrapper.append(absTitle)
        const abs = createElement({
            classes: ["abstract"]
        })
        const accepted = createElement({
            classes: ["entry", "accepted"]
        });
        accepted.textContent = this.locale("wishes.overview.abstract.accepted");
        accepted.prepend(createElement({
            classes: ["value"]
        }))
        const pending = createElement({
            classes: ["entry", "pending"]
        });
        pending.textContent = this.locale("wishes.overview.abstract.pending");
        pending.prepend(createElement({
            classes: ["value"]
        }))
        const refused = createElement({
            classes: ["entry", "refused"]
        });
        refused.textContent = this.locale("wishes.overview.abstract.refused");
        refused.prepend(createElement({
            classes: ["value"]
        }))
        abs.append(accepted, pending, refused)
        wrapper.append(abs);
        const graphTitle = createElement({
            classes: ["title"]
        })
        graphTitle.textContent = this.locale("wishes.overview.title")
        const graphTitleWarn = createElement({
            classes: ["item"]
        })
        graphTitleWarn.textContent = this.locale("wishes.overview.title.warn")
        graphTitle.append(graphTitleWarn);
        wrapper.append(graphTitle);
        this.graph = new Graph({
            displayLines: true,
            getAbscissaName: time => this.timeFormat.format(time)
        })
        this.graph.attach(wrapper);
        return root;
    }
    protected onCreated(): void {
        this.displayValue("accepted", "-");
        this.displayValue("pending", "-");
        this.displayValue("refused", "-");
        this.data().then(d => {
            const states = Object.values(d).map(e => e.user?.[e.user!.length - 1])
            this.displayValue("accepted", states.filter(rec => rec.application_queued === 0).length.toString())
            this.displayValue("pending", states.filter(rec => rec.application_queued > 0).length.toString())
            this.displayValue("refused", states.filter(rec => rec.application_queued < 0).length.toString())
            let colorVariation = 0;
            for (const study in d) {
                const graphEntry = new DatasetGraphEntry(study, `overview-${colorVariation}`)
                const values = new Map(d[study].user.map(rec => [Date.parse(rec.record_time), rec.application_queued]));
                if ([...values.values()].reduce((p, c) => p + c, 0) <= 0) continue;
                graphEntry.add(values);
                const chosenColor = colorVariation++ % 5;
                graphEntry.color = `var(--color-${
                    chosenColor == 0 ? "accent" :
                    chosenColor == 1 ? "red" :
                    chosenColor == 2 ? "yellow" :
                    chosenColor == 3 ? "green" :
                    "dark-red"
                })`;
                this.graph?.addEntry(graphEntry);
            }
            this.root.querySelector(".loader")?.remove();
        }).catch(console.error)
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
        delete this.graph;
    }

    public create() {
        this.createContext();
    }

    private displayValue(on: "accepted" | "pending" | "refused", value: string) {
        this.root!!.querySelector(`.${on} .value`).textContent = value;
    }
}