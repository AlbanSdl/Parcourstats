import { createElement } from "structure/element";
import { Icon } from "components/icon";
import { Activity } from "./structure/activity";
import { selectionAttribute, Selector } from "components/selector";
import { Fragment } from "./structure/fragment";
import { ComputedGraphEntry, DatasetGraphEntry, Graph, PreviousBasedComputedGraphEntry } from "components/graph";
import { Transition } from "structure/layout";
import { TextField } from "components/forms/textfield";
import { Button, ButtonStyle } from "components/button";
import { AppNotification } from "components/notification";
import { Switch } from "components/forms/switch";
import { Dropdown } from "components/forms/dropdown";
import { Locale, Query } from "../common/window";

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
    private fragment: Overview | WishFragment | TodayFragment | AboutFragment;
    private loadingState = 0;
    private providers: WeakRef<(d: Data) => void>[] = []
    private lang?: Locale;

    public create() {
        this.createContext();
    }

    protected async onCreate() {
        const root = await super.onCreate();
        window.messenger.send(Query.SETTINGS_GET).then(settings => {
            document.documentElement.setAttribute("theme", !settings.theme ? "dark" : "light");
            return settings;
        })
        .then(settings => this.waitCreation(settings))
        .then(settings => {
            themeSetting.status = !settings.theme
            localeSetting.select(settings.lang, false);
            this.lang = settings.lang;
            filterSetting.status = settings.filter;
            this.side.querySelector(".list")?.toggleAttribute("filtered", settings.filter);
        })
        root.classList.add("home");
        this.getLocale("app.name")
            .then(name => this.title = name);
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
            listener: (_, action) => this.updateMenu(action)
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
            listener: (_, name) => {
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
            classes: ["header"],
            text: await this.getLocale("wishes.add.header")
        })
        sideAdd.append(sideAddHeader);
        new TextField({
            placeholder: await this.getLocale("wishes.add.name"),
            oninput: () => activateButton(),
            parent: sideAdd,
            required: true,
            id: "wish-add-name"
        });
        const numeric = createElement({
            classes: ["numeric"]
        });
        new TextField({
            placeholder: await this.getLocale("wishes.add.session"),
            oninput: () => activateButton(),
            parent: numeric,
            required: true,
            prefilled: new Date().getFullYear().toString(),
            regex: /\d*/,
            id: "wish-add-session"
        });
        new TextField({
            placeholder: await this.getLocale("wishes.add.available"),
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
        const button = new Button(await this.getLocale("wishes.add.op"), () => {
            button.enabled = false;
            const stdy = <Study><unknown>Object.fromEntries(Object.entries(getWishAddFields())
                .map(e => [e[0], e[0] === "name" ? e[1].value : parseInt(e[1].value)]));
            window.messenger.send(Query.DATA, "insert", "study", stdy)
                .then(() => this.updateStudies([stdy]))
                .then(() => {
                    for (const entry of Object.entries(getWishAddFields()))
                        entry[1].value = entry[0] === "year" ? new Date().getFullYear().toString() : "";
                    if (this.fragment instanceof Overview)
                        this.fragment.replace(this.fragment = new Overview(), Transition.NONE);
                    this.side.querySelector("[action=wish-list]").toggleAttribute(selectionAttribute, true);
                })
                .catch(async err => {
                    new AppNotification(await this.getLocale("wishes.add.error"), 15000, ["error"]);
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
        const sideSettings = createElement({
            classes: ["settings"]
        })
        const themeSetting = new Switch({
            label: await this.getLocale("app.settings.theme"),
            oninput: e => {
                window.messenger.send(Query.SETTINGS_SET, "theme", !e.target.checked).catch(async err => {
                    console.error(err);
                    new AppNotification(await this.getLocale("wishes.settings.error"), 1e4, ['error'])
                }).finally(() => document.documentElement.setAttribute("theme", e.target.checked ? "dark" : "light"))
            },
            parent: sideSettings
        });
        const localeSetting = new Dropdown<Locale>({
            label: await this.getLocale("app.settings.lang"),
            onSelect: locale => {
                if (locale !== this.lang) window.messenger.send(Query.SETTINGS_SET, "lang", locale).then(() => {
                    this.clearCachedLocale();
                    const reCreatedActivity = new Home();
                    this.replace(reCreatedActivity).then(() => reCreatedActivity.sideHeader.select("stat-settings"))
                }).catch(async err => {
                    console.error(err);
                    new AppNotification(await this.getLocale("wishes.settings.error"), 1e4, ['error'])
                })
            },
            values: {
                ["Français"]: "fr",
                ["English"]: "en"
            },
            parent: sideSettings
        })
        const filterSetting = new Switch({
            label: await this.getLocale("app.settings.filter"),
            oninput: e => {
                window.messenger.send(Query.SETTINGS_SET, "filter", e.target.checked).catch(async err => {
                    console.error(err);
                    new AppNotification(await this.getLocale("wishes.settings.error"), 1e4, ['error'])
                }).finally(() => {
                    this.side.querySelector(".list")?.toggleAttribute("filtered", e.target.checked);
                });
            },
            parent: sideSettings
        })
        const recordOption = createElement({
            classes: ["record"],
            text: await this.getLocale("app.settings.record")
        })
        recordOption.append(createElement({
            classes: ["description"],
            text: await this.getLocale("app.settings.record.detail")
        }))
        const recordButton = new Button(await this.getLocale("app.settings.record.button"), () => {
            this.changeFragment(new TodayFragment())
        }, recordOption);
        recordButton.enabled = true;
        const aboutProperty = createElement({
            classes: ["about"],
            text: (await Promise.all([this.getLocale("app.settings.about"), this.getLocale("app.name")])).join(" "),
            ripple: true
        })
        aboutProperty.addEventListener('click', () => {
            this.changeFragment(this.fragment instanceof AboutFragment ? new Overview() : new AboutFragment())
        })
        sideSettings.append(recordOption, aboutProperty);
        wrapper.append(sideSettings);
        const container = createElement({
            classes: ["container"]
        });
        root.append(this.side, container);
        const fragProvider = () => new Promise<Data>(res => {
            if (this.loadingState >= 7) res(this.data);
            else this.providers.push(new WeakRef(res));
        });
        this.fragment = new Overview(this, container, fragProvider, async key => this.getLocale(key));

        window.messenger.send(Query.DATA, "select", "study")
            .then((values: Study[]) => this.waitCreation(values))
            .then(values => this.updateStudies(values))
            .catch(async err => {
                this.side.querySelector('.list')?.toggleAttribute("loading", false)
                while (!!this.sideList.childrenElements.length) 
                    this.sideList.childrenElements.item(0).remove();
                const errorPlaceholder = createElement({
                    classes: ["empty"],
                    text: await this.getLocale("wishes.list.error")
                });
                this.side.querySelector('.list')?.append(errorPlaceholder)
                console.error(err);
            })
        window.messenger.send(Query.DATA, "select", "global")
            .then(v => this.waitCreation(v))
            .catch(console.error)
            .then(values => this.update(values || [], "global"))
            .then(() => this.runProviders(LoadingMask.GLOBAL));
            window.messenger.send(Query.DATA, "select", "user")
            .then(v => this.waitCreation(v))
            .catch(console.error)
            .then(values => this.update(values || [], "user"))
            .then(() => this.runProviders(LoadingMask.USER));
        return root;
    }

    private runProviders(mask: LoadingMask) {
        if (this.loadingState < 7) {
            this.loadingState |= mask;
            if (this.loadingState >= 7) {
                for (const wishContainer of this.side.querySelectorAll(".list > .wish")) {
                    const wishData = this.data[wishContainer.getAttribute("name")];
                    if (!wishData?.user || !wishData?.sessions) continue;
                    wishContainer.toggleAttribute("active", wishData.sessions.length > 0 
                        && wishData.sessions[0].year === new Date().getFullYear() 
                        && (wishData.user.map(ur => ur.application_queued).sort()[0] ?? -1) > 0)
                }
                for (const ref of this.providers) 
                    ref.deref()?.(this.data);
                this.providers.splice(0, this.providers.length)
            }
        }
    }

    protected async onCreated() {
        (this.fragment as Overview).create();
        const wishListHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-list",
            text: await this.getLocale("wishes.list")
        });
        this.sideHeader.append(wishListHeader);
        const wishAddHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-add",
            text: await this.getLocale("wishes.add")
        });
        this.sideHeader.append(wishAddHeader);
        const settingsHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "stat-settings",
            text: await this.getLocale("wishes.settings")
        });
        this.sideHeader.append(settingsHeader);
        super.onCreated();
    }

    protected onDestroyed(): void {
        this.sideHeader.stop();
        delete this.sideHeader;
        delete this.side;
    }

    private update(values: Study[], key: "sessions"): values is Exclude<Study[], []>;
    private update(values: GlobalRankRecord[], key: "global"): values is Exclude<GlobalRankRecord[], []>;
    private update(values: UserRankRecord[], key: "user"): values is Exclude<UserRankRecord[], []>;
    private update(values: Study[] | GlobalRankRecord[] | UserRankRecord[], key: "sessions" | "global" | "user") {
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
        return values.length > 0;
    }

    public async insertRecord(type: "global", rec: GlobalRankRecord): Promise<void>;
    public async insertRecord(type: "user", rec: UserRankRecord): Promise<void>;
    public async insertRecord(type: "global" | "user", rec: GlobalRankRecord | UserRankRecord) {
        window.messenger.send(
            Query.DATA,
            "insert",
            type as (typeof rec) extends GlobalRankRecord ? "global" : "user",
            rec as (typeof type) extends "global" ? GlobalRankRecord : UserRankRecord
        ).then(() => {
            this.update([rec], type as (typeof rec) extends GlobalRankRecord ? "global" : "user")
        })
    }

    private async updateStudies(additions: Study[]) {
        const list = this.side.querySelector('.list');
        if (!list) return;
        list.toggleAttribute("loading", false)
        for (const element of list.children)
            if (!element.classList.contains("wish"))
                element.remove();
        const updateResult = this.update(additions, "sessions");
        if (list.children.length === 0 && !updateResult) {
            this.side.querySelector('.list')?.append?.(createElement({
                classes: ["empty"],
                text: await this.getLocale("wishes.list.empty")
            }));
        } else if (updateResult) {
            for (const wish in this.data) {
                if (!this.data[wish].sessions || !additions.find(a => a.name === wish)) continue;
                const sessions = this.data[wish].sessions.sort((a, b) => b.year - a.year);
                const wishContainer = createElement({
                    classes: ["wish"],
                    ripple: true,
                    name: wish
                });
                const wishSession = createElement({
                    classes: ["session"]
                });
                wishSession.textContent = `${
                    await this.getLocale(`wish.session.${sessions.length > 1 ? 'plural' : 'singular'}`)
                }: ${sessions.map(s => s.year).join(", ")}`;
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

    /** @internal */
    changeFragment(fragment: WishFragment | Overview | TodayFragment | AboutFragment) {
        this.fragment?.replace(this.fragment = fragment);
    }
}

class Overview extends Fragment {
    data: () => Promise<Data>;
    locale: (key: string) => Promise<string>;
    private readonly timeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric"
    })
    private graph?: Graph;

    constructor(
        context?: Home,
        container?: HTMLElement,
        data?: () => Promise<Data>,
        locale?: (key: string) => Promise<string>
    ) {
        super();
        this.context = context;
        this.container = container;
        this.data = data;
        this.locale = locale;
    }

    protected async onCreate(from?: Overview | WishFragment | TodayFragment | AboutFragment) {
        const root = await super.onCreate(from);
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
            classes: ["title"],
            text: await this.locale("wishes.overview.abstract.title")
        })
        wrapper.append(absTitle)
        const abs = createElement({
            classes: ["abstract"]
        })
        const accepted = createElement({
            classes: ["entry", "accepted"],
            text: await this.locale("wishes.overview.abstract.accepted")
        });
        accepted.prepend(createElement({
            classes: ["value"]
        }))
        const pending = createElement({
            classes: ["entry", "pending"],
            text: await this.locale("wishes.overview.abstract.pending")
        });
        pending.prepend(createElement({
            classes: ["value"]
        }))
        const refused = createElement({
            classes: ["entry", "refused"],
            text: await this.locale("wishes.overview.abstract.refused")
        });
        refused.prepend(createElement({
            classes: ["value"]
        }))
        abs.append(accepted, pending, refused)
        const today = createElement({
            classes: ["today"],
            text: await this.locale("wishes.overview.today.tip")
        })
        const todayGo = createElement({
            classes: ["go"],
            ripple: true,
            text: await this.locale("wishes.overview.today.letsgo")
        })
        today.append(todayGo);
        wrapper.append(abs, today);
        const graphTitle = createElement({
            classes: ["title"],
            text: await this.locale("wishes.overview.title")
        })
        wrapper.append(graphTitle);
        this.graph = new Graph({
            displayLines: true,
            displayYZero: true,
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
            let index = 0;
            for (const study in d) {
                if (!d[study].user) continue;
                const graphEntry = new DatasetGraphEntry(study, `overview-${index}`)
                const values = new Map(d[study].user
                    .until(record => record.application_queued < 0)
                    .map(rec => [Date.parse(rec.record_time), rec.application_queued]));
                if ([...values.values()].reduce((p, c) => p + c, 0) <= 0) continue;
                index++;
                graphEntry.add(values);
                this.graph?.addEntry(graphEntry);
            }
            this.root.toggleAttribute("loading", false)
            const lastUpdate = new Date(Object.values(d)
                .map(entry => [...entry.global, ...entry.user])
                .reduce((a, b) => [...a, ...b])
                .filter(record => !!record)
                .sort((a, b) => Date.parse(b.record_time) - Date.parse(a.record_time))[0]?.record_time),
                currentDate = new Date();
            if (currentDate.getTime() - lastUpdate.getTime() > 43200000 &&
                lastUpdate.getFullYear() === currentDate.getFullYear() && 
                (lastUpdate.getMonth() !== currentDate.getMonth() || lastUpdate.getDate() !== currentDate.getDate())) {
                    this.root!!.querySelector(".container > .today")?.toggleAttribute("present", true);
                    this.root!!.querySelector(".container > .today > .go")?.addEventListener("click", () => 
                        (this.context as Home).changeFragment(new TodayFragment()))
                }
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
        this.root!!.querySelector(`.${on} .value`)!!.textContent = value;
    }
    public async replace(fragment: Overview | WishFragment | TodayFragment | AboutFragment, transition = Transition.SLIDE) {
        return super.replace(fragment, transition)
    }
}

class WishFragment extends Fragment {
    data: () => Promise<Data>;
    locale: (key: string) => Promise<string>;
    readonly wishName!: string;
    private graph?: Graph;
    private speedGraph?: Graph;
    private readonly timeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric"
    })

    constructor(wishName: string) {
        super();
        this.wishName = wishName;
    }

    protected async onCreate(from: Overview | WishFragment | TodayFragment | AboutFragment) {
        const root = await super.onCreate();
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
            classes: ["complement", "update"],
            text: await this.locale("wish.update.last")
        })
        const cpValue = createElement({
            classes: ["value"]
        })
        complement.append(cpValue);
        title.append(complement);
        wrapper.append(title);
        const overview = createElement({
            classes: ["overview"]
        });
        overview.append(createElement({
            classes: ["overall"],
            text: "-"
        }), createElement({
            classes: ["rank", "user"],
            text: await this.locale("wish.rank.user"),
            position: "-"
        }), createElement({
            classes: ["rank", "abs"],
            text: await this.locale("wish.rank.initial"),
            position: "-"
        }), createElement({
            classes: ["rank", "all"],
            text: await this.locale("wish.rank.all"),
            position: "-"
        }), createElement({
            classes: ["rank", "last"],
            text: await this.locale("wish.rank.last"),
            position: "-"
        }))
        wrapper.append(overview);
        this.graph = new Graph({
            displayLines: true,
            displayYZero: true,
            getAbscissaName: time => this.timeFormat.format(time * 864e5)
        })
        this.speedGraph = new Graph({
            displayLines: true,
            displayYZero: true,
            getAbscissaName: time => this.timeFormat.format(time * 864e5)
        })
        this.graph.attach(wrapper);
        const speedHeader = createElement({
            classes: ["header", "speed"],
            text: await this.locale("wish.graph.speed.header")
        })
        speedHeader.append(createElement({
            classes: ["attachment"],
            text: await this.locale("wish.graph.speed.attachment")
        }))
        wrapper.append(speedHeader)
        this.speedGraph.attach(wrapper);
        return root;
    }
    protected onCreated(): void {
        this.data().then(async data => {
            const wish = data[this.wishName];
            const update = (wish.global?.map(g => g.record_time) ?? [])
                .concat(wish.user?.map(u => u.record_time) ?? [])
                .map(Date.parse)
                .sort()
                .slice(-1)[0];
            this.root.querySelector(".container .title .complement.update .value").textContent = update === undefined ? 
            await this.locale("wish.rank.unknown") : new Date(update).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "numeric"
            });

            const currentYear = new Date().getFullYear();
            const userData = wish.user?.filter(entry => entry.year === currentYear)
                    ?.sort((a, b) => Date.parse(b.record_time) - Date.parse(a.record_time)) ?? [],
                globalData = wish.global?.filter(entry => entry.year === currentYear)
                    ?.sort((a, b) => Date.parse(b.record_time) - Date.parse(a.record_time)) ?? []
            let overall: string;
            let displayedRank: UserRankRecord | undefined;
            let displayGlobalData: GlobalRankRecord | undefined;
            if (userData[0]?.application_queued > 0) {
                overall = await this.locale("wish.status.pending");
                displayedRank = userData[0];
                displayGlobalData = globalData[0];
            }
            else if (userData[0]?.application_queued === 0) {
                overall = await this.locale(userData.length === 1 ? "wish.rank.unknown.accepted" : "wish.status.accepted");
                displayedRank = userData[0];
                displayGlobalData = globalData[0];
            }
            else if (userData[0]?.application_queued === -1) {
                overall = await this.locale(userData.length === 1 ? "wish.rank.unknown.refused" : "wish.status.refused");
                displayedRank = userData[1];
                displayGlobalData = globalData[0];
            } else if (userData[0]?.application_queued === -2) {
                overall = await this.locale("wish.status.resigned");
                displayedRank = userData[1];
                displayGlobalData = globalData[0];
            } else {
                overall = await this.locale("wish.rank.unknown")
                displayedRank = userData[1];
                displayGlobalData = globalData[0];
            }
            this.root.querySelector(".container > .overview > .overall").textContent = overall;
            if (!!displayedRank && userData.length > 1) {
                this.root.querySelector(".container > .overview > .rank.user")?.
                    setAttribute("position", displayedRank.application_queued.toString())
                this.root.querySelector(".container > .overview > .rank.abs")?.
                    setAttribute("position", displayedRank.application_absolute.toString())
            }
            if (!!displayGlobalData) {
                if (!!displayGlobalData.application_all) this.root.querySelector(".container > .overview > .rank.all")?.
                    setAttribute("position", displayGlobalData.application_all.toString())
                if (!!displayGlobalData.application_last) this.root.querySelector(".container > .overview > .rank.last")?.
                    setAttribute("position", displayGlobalData.application_last.toString())
            }

            if ((displayGlobalData?.application_last ?? 0) < 1)
                this.root.toggleAttribute("no-data", true);
            else {
                const userRank = new DatasetGraphEntry(await this.locale("wish.rank.user"), "user-rank");
                userRank.add(new Map(userData.slice().reverse()
                    .until(record => record.application_queued < 0)
                    .map(entry => [
                        Math.trunc(Date.parse(entry.record_time) / 864e5),
                        entry.application_queued
                    ])
                ));
                const allApplications = new DatasetGraphEntry(await this.locale("wish.rank.all"), "app-all");
                allApplications.add(new Map(globalData.map(entry => [
                    Math.trunc(Date.parse(entry.record_time) / 864e5),
                    entry.application_all
                ])));
                const lastAcceptedRank = new DatasetGraphEntry(await this.locale("wish.rank.last"), "app-last");
                lastAcceptedRank.add(new Map(globalData.map(entry => [
                    Math.trunc(Date.parse(entry.record_time) / 864e5),
                    entry.application_last
                ])));
                const renouncingPeopleBehindUser = new ComputedGraphEntry(await this.locale("wish.graph.people.after"), "user-after", 
                    (_, all, user) => all - user, allApplications, userRank)
                this.graph.addEntry(userRank);
                this.graph.addEntry(allApplications);
                this.graph.addEntry(lastAcceptedRank);
                this.graph.addEntry(renouncingPeopleBehindUser);
    
                const size = wish.sessions?.sort((a, b) => b.year - a.year)?.[0]?.available || 1;
                const userRankAdvancementSpeed = new PreviousBasedComputedGraphEntry(await this.locale("wish.graph.speed.user"), "speed-user-rank", 
                    (_, pre, current) => pre === undefined ? pre : (pre - current) / size, userRank)
                const formationAdvancementSpeed = new PreviousBasedComputedGraphEntry(await this.locale("wish.graph.speed.last"), "speed-app-last", 
                    (_, pre, current) => pre === undefined ? 0 : (current - pre) / size, lastAcceptedRank)
                const queueShrinkSpeed = new PreviousBasedComputedGraphEntry(await this.locale("wish.graph.speed.all"), "speed-app-all", 
                    (_, pre, current) => pre === undefined ? 0 : (pre - current) / size, allApplications)
                this.speedGraph.addEntry(userRankAdvancementSpeed);
                this.speedGraph.addEntry(formationAdvancementSpeed);
                this.speedGraph.addEntry(queueShrinkSpeed);
            }
            this.root.toggleAttribute("loading", false)
        })
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
        delete this.graph;
    }
    public async replace(fragment: Overview | WishFragment | TodayFragment | AboutFragment) {
        return super.replace(fragment, Transition.SLIDE, fragment instanceof Overview)
    }
}

class TodayFragment extends Fragment {
    data: () => Promise<Data>;
    locale: (key: string) => Promise<string>;
    public query!: {
        session: Study,
        global?: GlobalRankRecord,
        user?: UserRankRecord,
        todayGlobal?: GlobalRankRecord,
        todayUser?: UserRankRecord
    }[]

    protected async onCreate(from: Overview | WishFragment | TodayFragment | AboutFragment) {
        const root = await super.onCreate(from);
        if (!!from) {
            this.data = from.data;
            this.locale = from.locale;
        }
        root.classList.add("today");
        const container = createElement({
            classes: ["container"]
        });
        const header = createElement({
            classes: ["header"],
            text: await this.locale("wishes.today.header")
        })
        header.append(createElement({
            text: await this.locale("wishes.today.subtitle")
        }));
        const fragmentWrapper = createElement({
            classes: ["wrapper"]
        })
        container.append(header, fragmentWrapper);
        root.append(container);
        return root;
    }
    protected onCreated(): void {
        this.data().then(activityData => {
            const currentYear = new Date().getFullYear();
            this.query = Object.values(activityData).map(entry => ({
                session: entry.sessions?.slice(0)?.sort((a, b) => b.year - a.year)?.[0],
                global: entry.global?.slice(0)?.sort((a, b) => Date.parse(b.record_time) - Date.parse(a.record_time))?.[0],
                user: entry.user?.slice(0)?.sort((a, b) => Date.parse(b.record_time) - Date.parse(a.record_time))?.[0],
            })).filter(entry => (entry.user?.application_queued ?? 1) > 0 && entry.session?.year === currentYear);
            new WishTodayEntryFragment(0).create(this, this.context,
                this.root.querySelector(".container > .wrapper"))
        })
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
    }

    public async replace(fragment: Overview | WishFragment | TodayFragment | AboutFragment) {
        return super.replace(fragment, Transition.SLIDE, fragment instanceof Overview)
    }
}

class WishTodayEntryFragment extends Fragment {
    private readonly index!: number;
    private todayFrag!: TodayFragment;
    private session?: Study;
    private global?: GlobalRankRecord;
    private user?: UserRankRecord;

    constructor(index: number) {
        super();
        this.index = index;
    }

    protected async onCreate(from?: WishTodayEntryFragment) {
        const root = await super.onCreate(from);
        if (!!from) this.todayFrag = from.todayFrag;
        const lastRecord = this.todayFrag!!.query[this.index];
        this.session = lastRecord?.session;
        this.global = lastRecord?.global;
        this.user = lastRecord?.user;
        root.classList.add("record");

        if (!!this.session) {
            const name = createElement({
                classes: ["name"]
            })
            name.textContent = this.session.name;
            const form = createElement({
                classes: ["form"]
            })
            const userRank = new TextField({
                placeholder: await this.todayFrag.locale("wishes.today.user.rank"),
                oninput: () => buttonUpdate(userRank, this.user?.application_queued),
                parent: form,
                regex: /\d+/,
                required: true
            }) as TextField;
            const globalAll = new TextField({
                placeholder: await this.todayFrag.locale("wishes.today.global.all"),
                oninput: () => buttonUpdate(globalAll, this.global?.application_all),
                parent: form,
                regex: /\d+/,
                required: true
            }) as TextField;
            const globalLast = new TextField({
                placeholder: await this.todayFrag.locale("wishes.today.global.last"),
                oninput: () => buttonUpdate(globalLast, this.global?.application_last),
                parent: form,
                regex: /\d+/,
                required: true
            }) as TextField;
            let userAbs: TextField | undefined;
            if (!this.user) {
                userAbs = new TextField({
                    placeholder: await this.todayFrag.locale("wishes.today.user.abs"),
                    oninput: () => buttonUpdate(userAbs),
                    parent: form,
                    regex: /\d+/,
                    required: true
                });
            }
            const quickActions = createElement({
                classes: ["actions", "quick"]
            })
            const button = new Button(await this.todayFrag.locale("wishes.today.next"), () => this.validate());
            const help = createElement({
                classes: ["tip"],
                ripple: true,
                text: "+"
            });
            help.addEventListener('click', () => actions.toggleAttribute("reveal"));
            quickActions.append(button.element, help);
            const actions = createElement({
                classes: ["actions"]
            });
            new Button(await this.todayFrag.locale("wishes.today.discarded"), () => this.validate(-2), actions).enabled = true;
            new Button(await this.todayFrag.locale(!this.user ? "wishes.today.refused" : "wishes.today.closed"), () => this.validate(-1), actions).enabled = true;
            new Button(await this.todayFrag.locale("wishes.today.accepted"), () => this.validate(0), actions).enabled = true;
            const buttonUpdate = async (field: TextField, refValue?: number) => {
                const value = (field.element.firstElementChild as HTMLInputElement).value;
                if (value === "" || !refValue) field.element.removeAttribute("trend");
                else {
                    const trend = parseInt(value) - refValue;
                    field.element.setAttribute("trend", 
                        isNaN(trend) ? await this.todayFrag.locale("wishes.today.invalid") : `${trend > 0 ? '+' : ''}${trend}`)
                }
                button.enabled = (userRank.element.querySelector("input.field") as HTMLInputElement)?.checkValidity()
                    && (globalAll.element.querySelector("input.field") as HTMLInputElement)?.checkValidity()
                    && (globalLast.element.querySelector("input.field") as HTMLInputElement)?.checkValidity()
                    && (!userAbs || (userAbs.element.querySelector("input.field") as HTMLInputElement)?.checkValidity())
            }
            root.append(name, form, quickActions, actions);
        } else {
            root.classList.add("summary")
            const summary = createElement({
                classes: ["summary"]
            })
            summary.append(createElement({
                classes: ["head"],
                text: await this.todayFrag.locale("wishes.today.summary.header.name")
            }), createElement({
                classes: ["head"],
                text: await this.todayFrag.locale("wishes.today.summary.header.status")
            }))
            for (const wish of this.todayFrag.query) {
                let details: HTMLDivElement;
                switch (wish.todayUser.application_queued!!) {
                    case -2:
                        details = createElement({
                            classes: ["update", "state"],
                            text: await this.todayFrag.locale("wishes.today.summary.discarded"),
                            state: "discarded"
                        });
                        break;
                    case -1:
                        details = createElement({
                            classes: ["update", "state"],
                            text: await this.todayFrag.locale("wishes.today.summary.refused"),
                            state: "refused"
                        })
                        break;
                    case 0:
                        details = createElement({
                            classes: ["update", "state"],
                            text: await this.todayFrag.locale("wishes.today.summary.accepted"),
                            state: "accepted"
                        });
                        break;
                    default:
                        details = createElement({
                            classes: ["update", "ranks"]
                        });
                        if (wish.user.application_queued !== wish.todayUser.application_queued) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayUser?.application_queued?.toString(),
                                from: wish.user.application_queued,
                                type: this.todayFrag.locale("wishes.today.user.rank")
                            }))
                        }
                        if (!wish.user) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayUser?.application_absolute?.toString(),
                                type: this.todayFrag.locale("wishes.today.user.abs")
                            }))
                        }
                        if (wish.global.application_all !== wish.todayGlobal.application_all) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayGlobal?.application_all?.toString(),
                                from: wish.global.application_all,
                                type: this.todayFrag.locale("wishes.today.global.all")
                            }))
                        }
                        if (wish.global.application_last !== wish.todayGlobal.application_last) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayGlobal?.application_last?.toString(),
                                from: wish.global.application_last,
                                type: this.todayFrag.locale("wishes.today.global.last")
                            }))
                        }
                        break;
                }
                summary.append(createElement({
                    classes: ["name"],
                    text: wish.session.name
                }), details);
            }
            root.append(summary);
            const button = new Button(await this.todayFrag.locale("wishes.today.summary.save"), async () => {
                const activity = this.context as Home;
                button.enabled = false;
                button.element.addIcon(Icon.LOADING);
                let itemIndex = 2;
                let errors = [];
                for (const wish of this.todayFrag.query) {
                    let errored = false;
                    try {
                        if (!!wish.todayUser) await (this.context as Home).insertRecord("user", wish.todayUser);
                        if (!!wish.todayGlobal) await (this.context as Home).insertRecord("global", wish.todayGlobal);
                    } catch (error) {
                        errored = true;
                        console.error(error);
                        errors.push(wish.session.name);
                    } finally {
                        summary.children.item(itemIndex++)?.setAttribute("save", errored ? "error" : "done")
                        summary.children.item(itemIndex++)?.setAttribute("save", errored ? "error" : "done")
                    }
                }
                activity.changeFragment(new Overview())
                if (errors.length > 0) new AppNotification([
                    this.todayFrag.locale("wishes.today.summary.save.error"),
                    ...errors,
                    this.todayFrag.locale("wishes.today.summary.save.error.retry")
                ].join(" "), -1, ["error"], undefined, () => {
                    activity.changeFragment(new TodayFragment())
                    return true;
                })
                button.element.lastElementChild?.remove();
            }, root);
            button.enabled = true;
        }
        return root;
    }
    private validate(code?: -2 | -1 | 0) {
        const record_date = new Date();
        const record_time = `${
            record_date.getFullYear().toString().padStart(4, "0")
        }-${
            (record_date.getMonth() + 1).toString().padStart(2, "0")
        }-${
            record_date.getDate().toString().padStart(2, "0")
        } ${
            record_date.getHours().toString().padStart(2, "0")
        }:${
            record_date.getMinutes().toString().padStart(2, "0")
        }:${
            record_date.getSeconds().toString().padStart(2, "0")
        }`;
        const entry = this.todayFrag.query[this.index];
        if (code !== undefined) {
            entry.todayUser = {
                ...entry.user,
                application_queued: code,
                record_time
            }
        } else {
            const fields = this.root.querySelectorAll<HTMLInputElement>(".form > .wrapper.text-field > input.field");
            entry.todayUser = {
                ...entry.user,
                application_queued: parseInt(fields.item(0).value),
                application_absolute: parseInt(fields.item(3)?.value) | entry.user.application_absolute,
                record_time
            }
            entry.todayGlobal = {
                ...entry.global,
                application_all: parseInt(fields.item(1).value),
                application_last: parseInt(fields.item(2).value),
                record_time
            }
        }
        this.replace(new WishTodayEntryFragment(this.index + 1));
    }
    protected onCreated(): void {
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
    }
    public async replace(fragment: WishTodayEntryFragment) {
        return super.replace(fragment, this.index !== fragment.index ? Transition.FADE | Transition.SLIDE : Transition.FADE,
            fragment.index < this.index)
    }
    public create(todayFrag: TodayFragment, activity: Activity, container: HTMLDivElement) {
        this.todayFrag = todayFrag;
        this.context = activity;
        this.container = container;
        this.createContext();
    }
}

class AboutFragment extends Fragment {
    data: () => Promise<Data>;
    locale: (key: string) => Promise<string>;

    protected async onCreate(from: Overview | WishFragment | TodayFragment | AboutFragment) {
        const root = await super.onCreate();
        this.data = from.data;
        this.locale = from.locale;
        root.classList.add("about", "loadable");
        root.toggleAttribute("loading", true)
        root.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        
        const container = createElement({
            classes: ["container"],
            text: (await Promise.all([this.locale("app.settings.about"), this.locale("app.name")])).join(" ")
        });

        const thisApp = createElement({
            text: await this.locale("app.settings.about.this")
        })
        const coreDeps = createElement({
            classes: ["deps", "core"],
            text: await this.locale("app.settings.about.libs.core")
        })
        coreDeps.append(createElement({
            classes: ["separator"]
        }))
        const depsList = createElement({
            classes: ["deps"]
        })
        container.append(thisApp, coreDeps, createElement({
            classes: ["libhead"],
            title: await this.locale("app.settings.about.libs"),
            text: await this.locale("app.settings.about.libs.expl")
        }), depsList);
        root.append(container);
        return root;
    }
    protected onCreated(): void {
        this.root.toggleAttribute("loading", false);
        window.messenger.send(Query.CONTEXT).catch(async err => {
            console.error(err);
            const erroredVersion = await this.locale("app.settings.about.libs.unknown")
            return {
                appVersion: erroredVersion,
                electronVersion: erroredVersion,
                nodeJsVersion: erroredVersion,
                chromiumVersion: erroredVersion,
                dependencies: undefined as {
                    [name: string]: {
                        version: string;
                        description?: string;
                        author?: string;
                        license?: string;
                    };
                }
            }
        }).then(async context => {
            this.root.querySelector(".container").setAttribute("version", context.appVersion);
            this.root.querySelector(".container > .deps.core")?.append(createElement({
                tag: "div",
                name: "Electron",
                version: context.electronVersion
            }), createElement({
                tag: "div",
                name: "Chromium",
                version: context.chromiumVersion
            }), createElement({
                tag: "div",
                name: "NodeJS",
                version: context.nodeJsVersion
            }))
            if (!context.dependencies) {
                this.root.querySelector(".container > .deps:not(.core)").append(createElement({
                    classes: ["error"],
                    text: await this.locale("app.settings.about.libs.error")
                }))
            } else {
                for (const name in context.dependencies) {
                    const lib = context.dependencies[name];
                    const wrapper = createElement({
                        classes: ["dep", "wrapper"]
                    });
                    wrapper.append(createElement({
                        classes: ["version"],
                        text: lib.version
                    }), createElement({
                        classes: ["name"],
                        text: name
                    }), createElement({
                        classes: ["desc"],
                        text: lib.description
                    }), createElement({
                        classes: ["author"],
                        text: lib.author
                    }), createElement({
                        classes: ["licence"],
                        text: lib.license
                    }));
                    this.root.querySelector(".container > .deps:not(.core)").append(wrapper);
                }
            }
        });
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
    }
    public async replace(fragment: Overview | WishFragment | TodayFragment | AboutFragment) {
        return super.replace(fragment, Transition.SLIDE, true)
    }
}