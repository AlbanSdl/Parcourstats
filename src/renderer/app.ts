import { createElement } from "structure/element";
import { Icon } from "components/icon";
import { Activity } from "./structure/activity";
import { selectionAttribute, Selector } from "components/selector";
import { Fragment } from "./structure/fragment";
import { ComputedGraphEntry, DatasetGraphEntry, Graph } from "components/graph";
import { Transition } from "structure/layout";
import { TextField } from "components/textfield";
import { Button, ButtonStyle } from "components/button";
import { AppNotification } from "components/notification";

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
            listener: action => this.updateMenu(action)
        })
        const wrapper = createElement({
            classes: ["wrapper"]
        });
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
        wrapper.append(sideList)
        this.side.append(sideHeaders, wrapper);
        sideList.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const sideAdd = createElement({
            classes: ["add"]
        })
        const sideAddHeader = createElement({
            classes: ["header"]
        })
        sideAddHeader.textContent = this.getLocale("wishes.add.header");
        sideAdd.append(sideAddHeader);
        new TextField({
            placeholder: this.getLocale("wishes.add.name"),
            oninput: () => activateButton(),
            parent: sideAdd,
            required: true,
            id: "wish-add-name"
        });
        const numeric = createElement({
            classes: ["numeric"]
        });
        new TextField({
            placeholder: this.getLocale("wishes.add.session"),
            oninput: () => activateButton(),
            parent: numeric,
            required: true,
            prefilled: new Date().getFullYear().toString(),
            regex: /\d*/,
            id: "wish-add-session"
        });
        new TextField({
            placeholder: this.getLocale("wishes.add.available"),
            oninput: () => activateButton(),
            parent: numeric,
            required: true,
            regex: /\d*/,
            id: "wish-add-available"
        });
        sideAdd.append(numeric);
        const getWishAddFields = () => ({
            name: (root.querySelector('* #wish-add-name') as HTMLInputElement),
            year: (root.querySelector('* #wish-add-session') as HTMLInputElement),
            available: (root.querySelector('* #wish-add-available') as HTMLInputElement)
        })
        const button = new Button(this.getLocale("wishes.add.op"), () => {
            button.enabled = false;
            const stdy = <Study><unknown>Object.fromEntries(Object.entries(getWishAddFields())
                .map(e => [e[0], e[0] === "name" ? e[1].value : parseInt(e[1].value)]));
            this.requestData("insert", "study", stdy)
            .then(res => this.updateStudies(!!res.length ? res : [stdy]))
            .then(() => {
                for (const entry of Object.entries(getWishAddFields()))
                    entry[1].value = entry[0] === "year" ? new Date().getFullYear().toString() : "";
                if (this.fragment instanceof Overview)
                    this.fragment.replace(this.fragment = new Overview(), Transition.NONE);
                this.side.querySelector("[action=wish-list]").toggleAttribute(selectionAttribute, true);
            })
            .catch(err => {
                new AppNotification(this.getLocale("wishes.add.error"), 15000, ["error"]);
                console.error(err);
                button.enabled = true;
                return true;
            })
        }, sideAdd, ButtonStyle.RAISED | ButtonStyle.COMPACT);
        button.enabled = false;
        const activateButton = () => {
            const name = root.querySelector('* #wish-add-name') as HTMLInputElement;
            const session = root.querySelector('* #wish-add-session') as HTMLInputElement;
            const available = root.querySelector('* #wish-add-available') as HTMLInputElement;
            button.enabled = !!name?.checkValidity() && !!session?.checkValidity() && !!available?.checkValidity();
        }
        wrapper.append(sideAdd);
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
            .then(values => this.updateStudies(values))
            .catch(err => {
                const errorPlaceholder = createElement({
                    classes: ["empty"]
                });
                errorPlaceholder.textContent = this.getLocale("wishes.list.error");
                this.side.querySelector('.list')?.append(errorPlaceholder)
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
        const wishListHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-list"
        });
        wishListHeader.textContent = this.getLocale("wishes.list");
        this.sideHeader.append(wishListHeader);
        const wishAddHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-add"
        });
        wishAddHeader.textContent = this.getLocale("wishes.add");
        this.sideHeader.append(wishAddHeader);
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

    private updateStudies(additions: string | Study[]) {
        this.side.querySelector('.list')?.toggleAttribute("loading", false)
        while (!!this.sideList.childrenElements.length) 
            this.sideList.childrenElements.item(0).remove();
        const updateResult = this.update(additions, "sessions");
        if (updateResult.added === 0) {
            const emptyPlaceholder = createElement({
                classes: ["empty"]
            });
            emptyPlaceholder.textContent = updateResult.error ?? this.getLocale("wishes.list.empty");
            this.side.querySelector('.list')?.append(emptyPlaceholder)
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
    }

    private updateMenu(action: string) {
        const items = this.side.querySelectorAll(".wrapper > *");
        for (let i = 0; i < items.length; i++) {
            const item = items.item(i);
            item.toggleAttribute("current", item.classList.contains(action.slice(5)));
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
            const states = Object.values(d).filter(e => (e.user?.length ?? 0) > 0).map(e => e.user!![e.user!.length - 1])
            this.displayValue("accepted", states.filter(rec => rec.application_queued === 0).length.toString())
            this.displayValue("pending", states.filter(rec => rec.application_queued > 0).length.toString())
            this.displayValue("refused", states.filter(rec => rec.application_queued < 0).length.toString())
            let colorVariation = 0;
            for (const study in d) {
                if (!d[study].user) continue;
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
    public replace(fragment: Overview | WishFragment, transition = Transition.SLIDE) {
        super.replace(fragment, transition)
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
            const update = (wish.global?.map(g => g.record_time) ?? [])
                .concat(wish.user?.map(u => u.record_time) ?? [])
                .map(Date.parse).sort().slice(-1)[0];
            this.root.querySelector(".container .title .complement.update .value").textContent = update === undefined ? 
            this.locale("wish.rank.unknown") : new Date(update).toLocaleDateString(undefined, {
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