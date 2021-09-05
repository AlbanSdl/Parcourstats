import type { Page } from "page";
import { Button, ButtonStyle } from "components/button";
import { Dropdown } from "components/forms/dropdown";
import { Switch } from "components/forms/switch";
import { TextField } from "components/forms/textfield";
import { AppNotification } from "components/notification";
import { Selector } from "components/selector";
import { Activity } from "structure/activity";
import { createElement } from "structure/element";
import { Transition } from "structure/layout";
import { Locale, Query } from "../../common/window";
import { Overview } from "fragments/overview";
import { AboutFragment } from "fragments/about";
import { TodayFragment } from "fragments/record";
import { WishFragment } from "fragments/wish";
import { Adapter } from "components/adapter";
import { Formation } from "formation";
import { scheduler } from "scheduler";

export class Home extends Activity {
    private side: HTMLElement;
    private sideHeader: Selector<string>;
    private sideList: Selector<string>;

    private formations?: Adapter<Formation>;
    private readonly providers: WeakRef<(adapter: Adapter<Formation>) => void>[] = [];

    private fragment: Page<Home, Adapter<Formation>>;
    private lang?: Locale;

    public create() {
        this.createContext();
    }

    protected async onCreate() {
        const root = await super.onCreate();
        this.initDataLoading();
        window.messenger.send(Query.SETTINGS_GET)
            .then(settings => this.waitCreation(settings))
            .then(settings => {
                themeSetting.status = !settings.theme
                localeSetting.select(settings.lang, false);
                this.lang = settings.lang;
                filterSetting.status = settings.filter;
            })
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
            listener: (_, action) => this.side.querySelectorAll(".wrapper > *").forEach(item => 
                item.toggleAttribute("current", item.classList.contains(action.slice(5))))
        })
        const wrapper = createElement({
            classes: ["wrapper"]
        });
        const activity = this;
        this.formations = new Adapter({
            bind(formation) {
                const wishContainer = createElement({
                    classes: ["wish"],
                    ripple: true
                });
                wishContainer.append(createElement({
                    classes: ["session"],
                    text: activity.getLocale(`wish.session.${formation.sessions.length > 1 ? 'plural' : 'singular'}`).then(
                        localized => `${localized}: ${formation.sessions.map(s => s.year).join(", ")}`)
                }));
                return wishContainer;
            },
            idify(item) {
                return item.name
            },
            getSearchString() {
                return activity.getLocale("wishes.list.search");
            },
            matches(item, value) {
                return item.name.toLowerCase().includes(value.toLowerCase())
            },
            update(item, element, property) {
                if (property === <string>"hidden")
                    element.toggleAttribute("filtered", item.hidden === true);
            },
            onEmpty(isFiltered) {
                const placeholder = createElement({
                    classes: ["empty"],
                    text: activity.getLocale(`wishes.list.empty${isFiltered ? ".filtered" : ""}`)
                })
                new Button(
                    activity.getLocale(`wishes.list.empty${isFiltered ? ".filtered" : ""}.action`),
                    () => activity.sideHeader.select(isFiltered ? "stat-settings" : "wish-add"),
                    placeholder
                ).enabled = true;
                return placeholder;
            },
            onError(error) {
                console.error(error);
                return createElement({
                    classes: ["empty"],
                    text: activity.getLocale("wishes.list.error")
                })
            },
            onLengthUpdate() {
                recordButton.enabled = !!activity.formations.asList.find(formation => 
                    (formation.latestUserRecord?.queued ?? 1) > 0);
            }
        }, wrapper);
        this.sideList = new Selector({
            container: this.formations.element,
            extractor: e => e?.getAttribute?.("adapter-binding"),
            isUnique: true,
            listener: (_, name) => {
                const frag = !!name ? new WishFragment(name) : new Overview;
                this.fragment.replace(frag);
                this.fragment = frag;
            }
        })
        this.side.append(sideHeaders, wrapper);
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
            this.insert("study", stdy)
                .then(() => {
                    for (const entry of Object.entries(getWishAddFields()))
                        entry[1].value = entry[0] === "year" ? new Date().getFullYear().toString() : "";
                    if (this.fragment instanceof Overview)
                        this.fragment.replace(this.fragment = new Overview(), Transition.NONE);
                    this.sideHeader.select("wish-list");
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
                    this.formations?.filter(formation => filterSetting.status && (formation.year !== new Date().getFullYear() || 
                        (formation.latestUserRecord?.queued ?? 1) <= 0))
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
        const recordButton = new Button(this.getLocale("app.settings.record.button"),
            () => this.changeFragment(new TodayFragment()), recordOption);
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
        this.fragment = new Overview(this, container, () => new Promise<Adapter<Formation>>(res => {
            if (this.formations?.clean === false) res(this.formations);
            else this.providers.push(new WeakRef(res));
        }), async key => this.getLocale(key));
        return root;
    }

    private async initDataLoading() {
        await window.messenger.send(Query.READY);
        const values = (await Promise.all([
            window.messenger.send(Query.DATA, "select", "study")
                .catch(async err => {
                    this.formations.raise(this.getLocale("wishes.list.error"));
                    console.error(err);
                }),
            window.messenger.send(Query.DATA, "select", "global")
                .catch(console.error),
            window.messenger.send(Query.DATA, "select", "user")
                .catch(console.error)
        ]))?.flat();
        const asList: Formation[] = [];
        for (const value of values) {
            if (!value) continue;
            let current = asList.find(list => list.name === value.name);
            if (!current) asList.push(current = new Formation(value.name));
            current.update(value);
        }
        await this.formations?.push(this.sideList, ...asList);
        await this.waitCreation();
        for (const ref of this.providers) scheduler.schedule(() => ref.deref()?.(this.formations!!));
        this.providers.splice(0, this.providers.length);
        await scheduler.schedule();
        const splash = this.container?.querySelector(".splash");
        if (!!splash) for (const child of splash.children) {
            child.querySelectorAll("animate, animateTransform").forEach(
            (anim: SVGAnimateElement | SVGAnimateTransformElement) => {
                const started = anim.getAttribute("begin") !== "indefinite";
                if (started) anim.endElementAt(anim.getCurrentTime());
                else if (anim.parentElement?.parentElement?.id !== "splash-clip") anim.beginElement();
                else setTimeout(() => anim.beginElement(), 500);
            });
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

    public async insert(
        type: keyof FormationDataMapping,
        rec: FormationDataMapping[typeof type]
    ) {
        await window.messenger.send(
            Query.DATA, "insert", type, rec
        );
        let current = this.formations?.asList?.find(formation => formation.name === rec.name);
        if (!current) await this.formations!.push(this.sideList, current = new Formation(rec.name))
        current.update(rec);
        return this.formations.filterItem(current);
    }

    /** @internal */
    changeFragment(fragment: Page<Home, Adapter<Formation>>) {
        this.fragment?.replace(this.fragment = fragment);
    }
}