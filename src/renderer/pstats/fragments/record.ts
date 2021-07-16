import type { Home } from "../home";
import type { Activity } from "structure/activity";
import { Button } from "components/button";
import { TextField } from "components/forms/textfield";
import { Icon } from "components/icon";
import { AppNotification } from "components/notification";
import { createElement } from "structure/element";
import { Fragment } from "structure/fragment";
import { Transition } from "structure/layout";
import { Overview } from "overview";
import { Page } from "pstats/page";

export class TodayFragment extends Page<Home, Data> {
    public query!: {
        session: Study,
        global?: GlobalRankRecord,
        user?: UserRankRecord,
        todayGlobal?: GlobalRankRecord,
        todayUser?: UserRankRecord
    }[]

    protected async onCreate(from: Page<Home, Data>) {
        const root = await super.onCreate(from);
        root.classList.add("today");
        const container = createElement({
            classes: ["container"]
        });
        const header = createElement({
            classes: ["header"],
            text: await this.getLocale("wishes.today.header")
        })
        header.append(createElement({
            text: await this.getLocale("wishes.today.subtitle")
        }));
        const fragmentWrapper = createElement({
            classes: ["wrapper"]
        })
        container.append(header, fragmentWrapper);
        root.append(container);
        return root;
    }
    protected onCreated(): void {
        this.data.then(activityData => {
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
                placeholder: await this.todayFrag.getLocale("wishes.today.user.rank"),
                oninput: () => buttonUpdate(userRank, this.user?.application_queued),
                parent: form,
                regex: /\d+/,
                required: true
            }) as TextField;
            const globalAll = new TextField({
                placeholder: await this.todayFrag.getLocale("wishes.today.global.all"),
                oninput: () => buttonUpdate(globalAll, this.global?.application_all),
                parent: form,
                regex: /\d+/,
                required: true
            }) as TextField;
            const globalLast = new TextField({
                placeholder: await this.todayFrag.getLocale("wishes.today.global.last"),
                oninput: () => buttonUpdate(globalLast, this.global?.application_last),
                parent: form,
                regex: /\d+/,
                required: true
            }) as TextField;
            let userAbs: TextField | undefined;
            if (!this.user) {
                userAbs = new TextField({
                    placeholder: await this.todayFrag.getLocale("wishes.today.user.abs"),
                    oninput: () => buttonUpdate(userAbs),
                    parent: form,
                    regex: /\d+/,
                    required: true
                });
            }
            const quickActions = createElement({
                classes: ["actions", "quick"]
            })
            const button = new Button(await this.todayFrag.getLocale("wishes.today.next"), () => this.validate());
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
            new Button(await this.todayFrag.getLocale("wishes.today.discarded"), () => this.validate(-2), actions).enabled = true;
            new Button(await this.todayFrag.getLocale(!this.user ? "wishes.today.refused" : "wishes.today.closed"), () => this.validate(-1), actions).enabled = true;
            new Button(await this.todayFrag.getLocale("wishes.today.accepted"), () => this.validate(0), actions).enabled = true;
            const buttonUpdate = async (field: TextField, refValue?: number) => {
                const value = (field.element.firstElementChild as HTMLInputElement).value;
                if (value === "" || !refValue) field.element.removeAttribute("trend");
                else {
                    const trend = parseInt(value) - refValue;
                    field.element.setAttribute("trend", 
                        isNaN(trend) ? await this.todayFrag.getLocale("wishes.today.invalid") : `${trend > 0 ? '+' : ''}${trend}`)
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
                text: await this.todayFrag.getLocale("wishes.today.summary.header.name")
            }), createElement({
                classes: ["head"],
                text: await this.todayFrag.getLocale("wishes.today.summary.header.status")
            }))
            for (const wish of this.todayFrag.query) {
                let details: HTMLDivElement;
                switch (wish.todayUser.application_queued!!) {
                    case -2:
                        details = createElement({
                            classes: ["update", "state"],
                            text: await this.todayFrag.getLocale("wishes.today.summary.discarded"),
                            state: "discarded"
                        });
                        break;
                    case -1:
                        details = createElement({
                            classes: ["update", "state"],
                            text: await this.todayFrag.getLocale("wishes.today.summary.refused"),
                            state: "refused"
                        })
                        break;
                    case 0:
                        details = createElement({
                            classes: ["update", "state"],
                            text: await this.todayFrag.getLocale("wishes.today.summary.accepted"),
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
                                type: await this.todayFrag.getLocale("wishes.today.user.rank")
                            }))
                        }
                        if (!wish.user) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayUser?.application_absolute?.toString(),
                                type: await this.todayFrag.getLocale("wishes.today.user.abs")
                            }))
                        }
                        if (wish.global.application_all !== wish.todayGlobal.application_all) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayGlobal?.application_all?.toString(),
                                from: wish.global.application_all,
                                type: await this.todayFrag.getLocale("wishes.today.global.all")
                            }))
                        }
                        if (wish.global.application_last !== wish.todayGlobal.application_last) {
                            details.append(createElement({
                                classes: ["update"],
                                text: wish.todayGlobal?.application_last?.toString(),
                                from: wish.global.application_last,
                                type: await this.todayFrag.getLocale("wishes.today.global.last")
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
            const button = new Button(await this.todayFrag.getLocale("wishes.today.summary.save"), async () => {
                const activity = this.context as Home;
                button.enabled = false;
                button.element.setIcon(Icon.LOADING);
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
                if (errors.length > 0) new AppNotification({
                    content: [
                        this.todayFrag.getLocale("wishes.today.summary.save.error"),
                        ...errors,
                        this.todayFrag.getLocale("wishes.today.summary.save.error.retry")
                    ].join(" "),
                    flags: AppNotification.Type.ERROR,
                    onClick: () => {
                        activity.changeFragment(new TodayFragment())
                        return true;
                    }
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