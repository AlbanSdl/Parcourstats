import type { Page } from "page";
import { Button, ButtonStyle } from "components/button";
import { Dropdown } from "components/forms/dropdown";
import { Switch } from "components/forms/switch";
import { TextField } from "components/forms/textfield";
import { Icon } from "components/icon";
import { AppNotification } from "components/notification";
import { Selector, selectionAttribute } from "components/selector";
import { Activity } from "structure/activity";
import { createElement } from "structure/element";
import { Transition } from "structure/layout";
import { Locale, Query } from "../../common/window";
import { Overview } from "fragments/overview";
import { AboutFragment } from "fragments/about";
import { TodayFragment } from "fragments/record";
import { WishFragment } from "fragments/wish";

enum LoadingMask {
    STUDY = 0b001,
    GLOBAL = 0b010,
    USER = 0b100
}

export class Home extends Activity {
    private side: HTMLElement;
    private sideHeader: Selector<string>;
    private sideList: Selector<string>;

    private readonly data: LoadedData = {};
    private fragment: Page<Home, LoadedData>;

    private loadingState = 0;
    private providers: WeakRef<(d: LoadedData) => void>[] = [];

    private lang?: Locale;

    public create() {
        this.createContext();
    }

    protected async onCreate() {
        const root = await super.onCreate();
        this.initDataLoading();
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
        sideList.setIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const sideAdd = createElement({
            classes: ["add"]
        })
        const sideAddHeader = createElement({
            classes: ["header"],
            text: this.getLocale("wishes.add.header")
        })
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
                    new AppNotification({
                        content: this.getLocale("wishes.add.error"),
                        duration: 15e3,
                        flags: AppNotification.Type.ERROR
                    });
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
            label: this.getLocale("app.settings.theme"),
            oninput: e => {
                window.messenger.send(Query.SETTINGS_SET, "theme", !e.target.checked).catch(async err => {
                    console.error(err);
                    new AppNotification({
                        content: this.getLocale("wishes.settings.error"),
                        duration: 1e4,
                        flags: AppNotification.Type.ERROR
                    })
                }).finally(() => document.documentElement.setAttribute("theme", e.target.checked ? "dark" : "light"))
            },
            parent: sideSettings
        });
        const localeSetting = new Dropdown<Locale>({
            label: this.getLocale("app.settings.lang"),
            onSelect: locale => {
                if (locale !== this.lang) window.messenger.send(Query.SETTINGS_SET, "lang", locale).then(() => {
                    this.clearCachedLocale();
                    const reCreatedActivity = new Home();
                    this.replace(reCreatedActivity).then(() => reCreatedActivity.sideHeader.select("stat-settings"))
                }).catch(async err => {
                    console.error(err);
                    new AppNotification({
                        content: this.getLocale("wishes.settings.error"),
                        duration: 1e4,
                        flags: AppNotification.Type.ERROR
                    })
                })
            },
            values: {
                ["Français"]: "fr",
                ["English"]: "en"
            },
            parent: sideSettings
        })
        const filterSetting = new Switch({
            label: this.getLocale("app.settings.filter"),
            oninput: e => {
                window.messenger.send(Query.SETTINGS_SET, "filter", e.target.checked).catch(async err => {
                    console.error(err);
                    new AppNotification({
                        content: this.getLocale("wishes.settings.error"),
                        duration: 1e4,
                        flags: AppNotification.Type.ERROR
                    })
                }).finally(() => {
                    this.side.querySelector(".list")?.toggleAttribute("filtered", e.target.checked);
                });
            },
            parent: sideSettings
        })
        const recordOption = createElement({
            classes: ["record"],
            text: this.getLocale("app.settings.record")
        })
        recordOption.append(createElement({
            classes: ["description"],
            text: this.getLocale("app.settings.record.detail")
        }))
        const recordButton = new Button(this.getLocale("app.settings.record.button"), () => {
            this.changeFragment(new TodayFragment())
        }, recordOption);
        recordButton.enabled = true;
        const aboutProperty = createElement({
            classes: ["about"],
            text: Promise.all([this.getLocale("app.settings.about"), 
                this.getLocale("app.name")]).then(values => values.join(" ")),
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
        const fragProvider = () => new Promise<LoadedData>(res => {
            if (this.loadingState >= 7) res(this.data);
            else this.providers.push(new WeakRef(res));
        });
        this.fragment = new Overview(this, container, fragProvider, async key => this.getLocale(key));
        return root;
    }

    private async initDataLoading() {
        await window.messenger.send(Query.READY);
        await Promise.all([
            window.messenger.send(Query.DATA, "select", "study")
                .then((values: Study[]) => this.waitCreation(values))
                .then(values => this.updateStudies(values))
                .catch(async err => {
                    this.side.querySelector('.list')?.toggleAttribute("loading", false)
                    while (!!this.sideList.childrenElements.length) 
                        this.sideList.childrenElements.item(0).remove();
                    const errorPlaceholder = createElement({
                        classes: ["empty"],
                        text: this.getLocale("wishes.list.error")
                    });
                    this.side.querySelector('.list')?.append(errorPlaceholder)
                    console.error(err);
                }),
            window.messenger.send(Query.DATA, "select", "global")
                .then(v => this.waitCreation(v))
                .catch(console.error)
                .then(values => this.update(values || [], "global"))
                .then(() => this.runProviders(LoadingMask.GLOBAL)),
            window.messenger.send(Query.DATA, "select", "user")
                .then(v => this.waitCreation(v))
                .catch(console.error)
                .then(values => this.update(values || [], "user"))
                .then(() => this.runProviders(LoadingMask.USER))
        ]);
        await this.waitCreation();
        const splash = this.container?.querySelector(".splash");
        if (!!splash) for (const child of splash.children) {
            child.querySelectorAll("animate, animateTransform").forEach(
            (anim: SVGAnimateElement | SVGAnimateTransformElement) => {
                const started = anim.getAttribute("begin") !== "indefinite";
                if (started) (<any>anim).endElementAt(anim.getCurrentTime());
                else if (anim.parentElement?.parentElement?.id !== "splash-clip") (<any>anim).beginElement();
                else setTimeout(() => (<any>anim).beginElement(), 500);
            });
        }
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
            text: this.getLocale("wishes.list")
        });
        this.sideHeader.append(wishListHeader);
        const wishAddHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-add",
            text: this.getLocale("wishes.add")
        });
        this.sideHeader.append(wishAddHeader);
        const settingsHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "stat-settings",
            text: this.getLocale("wishes.settings")
        });
        this.sideHeader.append(settingsHeader);
        super.onCreated();
    }

    protected onDestroyed(): void {
        this.sideList.stop();
        this.sideHeader.stop();
        delete this.sideList;
        delete this.sideHeader;
        delete this.side;
    }

    private update(values: Study[], key: "sessions"): boolean;
    private update(values: GlobalRankRecord[], key: "global"): boolean;
    private update(values: UserRankRecord[], key: "user"): boolean;
    private update(values: Study[] | GlobalRankRecord[] | UserRankRecord[], key: "sessions" | "global" | "user") {
        const vals: LoadedType[] = values.map((entry: RemoteData) => "record_time" in entry ? Object.assign(entry, {
            record_time: Date.parse(entry.record_time)
        }) : entry);
        for (const wish of vals) {
            if (wish.name in this.data) {
                const entries = this.data[wish.name]!![key];
                if (!entries)
                    this.data[wish.name][key] = [wish];
                else if (
                    (key === "sessions" && !(<Study[]>entries).find(s => s.year === wish.year))
                    || ((key === "global" || key === "user") && !(<(LoadedType<GlobalRankRecord | UserRankRecord>)[]>entries)
                        .find(s => s.record_time === (<LoadedType<GlobalRankRecord | UserRankRecord>>wish).record_time))
                ) entries.push(wish);
            } else this.data[wish.name] = {
                [key]: [wish]
            };
        }
        return vals.length > 0;
    }

    public async insertRecord(type: "global", rec: GlobalRankRecord): Promise<void>;
    public async insertRecord(type: "user", rec: UserRankRecord): Promise<void>;
    public async insertRecord(type: "global" | "user", rec: GlobalRankRecord | UserRankRecord) {
        return window.messenger.send(
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
                text: this.getLocale("wishes.list.empty")
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
                wishContainer.append(createElement({
                    classes: ["session"],
                    text: this.getLocale(`wish.session.${sessions.length > 1 ? 'plural' : 'singular'}`).then(
                        localized => `${localized}: ${sessions.map(s => s.year).join(", ")}`)
                }));
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
    changeFragment(fragment: Page<Home, LoadedData>) {
        this.fragment?.replace(this.fragment = fragment);
    }
}