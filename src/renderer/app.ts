import { createElement } from "structure/element";
import { Icon } from "components/icon";
import { Activity } from "./structure/activity";
import { Selector } from "components/selector";
import { Fragment } from "./structure/fragment";
import { ComputedGraphEntry, DatasetGraphEntry, Graph } from "components/graph";
import { Transition } from "structure/layout";

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
    private fragment: Overview | WishFragment;
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
            classes: ["list", "loadable"],
            loading: true
        })
        this.sideList = new Selector({
            container: sideList,
            extractor: e => e?.getAttribute?.("name"),
            isUnique: true,
            listener: name => {
                const frag = !!name ? new WishFragment(name) : new Overview;
                this.fragment.replace(frag);
                this.fragment = frag;
            }
        })
        this.side.append(sideHeaders, sideList);
        sideList.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const container = createElement({
            classes: ["container"]
        });
        root.append(this.side, container);
        const fragProvider = () => new Promise<Data>(res => {
            if (this.loadingState >= 7) res(this.data);
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
                this.side.lastElementChild.toggleAttribute("loading", false)
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
    data: () => Promise<Data>;
    locale: (key: string) => string;
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

    protected onCreate(from?: Overview | WishFragment): HTMLDivElement {
        const root = super.onCreate(from);
        if (!!from) {
            this.data = from.data;
            this.locale = from.locale;
        }
        root.classList.add("overview", "loadable");
        root.toggleAttribute("loading", true)
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
            this.root.toggleAttribute("loading", false)
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
    public replace(fragment: Overview | WishFragment) {
        super.replace(fragment, Transition.SLIDE)
    }
}

class WishFragment extends Fragment {
    data: () => Promise<Data>;
    locale: (key: string) => string;
    readonly wishName!: string;
    private graph?: Graph;
    private readonly timeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric"
    })

    constructor(wishName: string) {
        super();
        this.wishName = wishName;
    }

    protected onCreate(from: Overview | WishFragment): HTMLDivElement {
        const root = super.onCreate();
        this.data = from.data;
        this.locale = from.locale;
        root.classList.add("wish", "loadable");
        root.toggleAttribute("loading", true)
        root.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const wrapper = createElement({
            classes: ["container"]
        });
        root.prepend(wrapper);
        const title = createElement({
            classes: ["title"]
        })
        title.textContent = this.wishName;
        const complement = createElement({
            classes: ["complement", "update"]
        })
        complement.textContent = this.locale("wish.update.last")
        const cpValue = createElement({
            classes: ["value"]
        })
        complement.append(cpValue);
        title.append(complement);
        const initRank = createElement({
            classes: ["complement", "initial"]
        })
        initRank.textContent = this.locale("wish.rank.initial")
        const initRankValue = createElement({
            classes: ["value"]
        })
        initRank.append(initRankValue);
        title.append(initRank);
        wrapper.append(title)
        this.graph = new Graph({
            displayLines: true,
            getAbscissaName: time => this.timeFormat.format(time * 864e5)
        })
        this.graph.attach(wrapper);
        return root;
    }
    protected onCreated(): void {
        this.data().then(data => {
            const wish = data[this.wishName];
            const updates = (wish.global?.map(g => g.record_time) ?? [])
                .concat(wish.user?.map(u => u.record_time) ?? [])
                .map(rec => new Date(rec)).sort().slice(-1);
            this.root.querySelector(".container .title .complement.update .value").textContent = updates?.[0].toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "numeric"
            });
            const initialRank = wish.user?.[0]?.application_absolute;
            this.root.querySelector(".container .title .complement.initial .value").textContent = 
                (typeof initialRank !== "number" ? this.locale("wish.rank.unknown") : initialRank > 0 ? initialRank.toString() :
                this.locale(initialRank === 0 ? "wish.rank.unknown.accepted" : "wish.rank.unknown.refused"));
            if ((initialRank ?? 0) < 1) this.root.toggleAttribute("no-data", true);
            const userRank = new DatasetGraphEntry(this.locale("wish.rank.user"), "user-rank");
            userRank.add(new Map(wish.user?.map(entry => [
                Math.trunc(Date.parse(entry.record_time) / 864e5),
                entry.application_queued
            ])));
            userRank.color = "var(--color-yellow)";
            const allApplications = new DatasetGraphEntry(this.locale("wish.rank.all"), "app-all");
            allApplications.add(new Map(wish.global?.filter(entry => entry.year === new Date().getFullYear())?.map(entry => [
                Math.trunc(Date.parse(entry.record_time) / 864e5),
                entry.application_all
            ])));
            allApplications.color = "var(--color-red)";
            const lastAcceptedRank = new DatasetGraphEntry(this.locale("wish.rank.last"), "app-last");
            lastAcceptedRank.add(new Map(wish.global?.filter(entry => entry.year === new Date().getFullYear()).map(entry => [
                Math.trunc(Date.parse(entry.record_time) / 864e5),
                entry.application_last
            ])));
            lastAcceptedRank.color = "var(--color-green)";
            const renouncingPeopleBehindUser = new ComputedGraphEntry(this.locale("wish.graph.people.after"), "ren-after", 
                (_, all, user) => all - user, allApplications, userRank)
            renouncingPeopleBehindUser.color = "var(--color-dark-red)";
            this.graph.addEntry(userRank);
            this.graph.addEntry(allApplications);
            this.graph.addEntry(lastAcceptedRank);
            this.graph.addEntry(renouncingPeopleBehindUser);
            this.root.toggleAttribute("loading", false)
        })
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
        delete this.graph;
    }
    public replace(fragment: Overview | WishFragment) {
        super.replace(fragment, Transition.SLIDE, fragment instanceof Overview)
    }
}