import { createElement } from "structure/element";
import { Icon } from "components/icon";
import { Activity } from "./activity";
import { Selector } from "components/selector";

export class Home extends Activity {
    private side: HTMLElement;
    private sideHeader: Selector<string>;
    private sideList: Selector<string>;
    private readonly data: {
        [name: string]: {
            sessions?: Study[],
            global?: GlobalRankRecord[],
            user?: UserRankRecord[]
        }
    } = {};

    public create() {
        this.createContext();
    }

    public onCreate(): void {
        super.onCreate();
        this.title = this.getLocale("app.name")
        this.root.classList.add("home");
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
        const overview = createElement({
            classes: ["overview", "loadable"]
        });
        overview.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        this.root.append(this.side, overview);

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
                this.side.lastElementChild.append(errorPlaceholder)
                console.error(err);
            })
        this.requestData("select", "global")
            .then(async v => await this.waitCreation(v))
            .catch(console.error)
            .then(values => this.updateGlobal(values || []));
        this.requestData("select", "user")
            .then(async v => await this.waitCreation(v))
            .catch(console.error)
            .then(values => this.updateUser(values || []));
    }

    public onCreated(): void {
        const wishHeader = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-list"
        });
        wishHeader.textContent = this.getLocale("wishes.list");
        this.sideHeader.append(wishHeader);
        super.onCreated();
    }

    public onDestroyed(): void {
        this.sideHeader.stop();
        delete this.sideHeader;
        delete this.side;
    }

    private updateStudies(values: Study[] | string) {
        while (!!this.sideList.childrenElements.length) 
            this.sideList.childrenElements.item(0).remove();
        if (typeof values === "string" || !values.length) {
            const emptyPlaceholder = createElement({
                classes: ["empty"]
            });
            emptyPlaceholder.textContent = !!values.length ? 
                values as string : this.getLocale("wishes.list.empty");
            this.side.lastElementChild.append(emptyPlaceholder)
        } else {
            this.update(values, "sessions");
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
    }

    private updateGlobal(values: GlobalRankRecord[]) {
        for (const entry of values) {
            console.log("Global:", entry);
        }
    }

    private updateUser(values: UserRankRecord[]) {
        for (const entry of values) {
            console.log("User:", entry);
        }
    }

    private update(values: Study[], key: "sessions"): void;
    private update(values: GlobalRankRecord[], key: "global"): void;
    private update(values: UserRankRecord[], key: "user"): void;
    private update(values: Study[] | GlobalRankRecord[] | UserRankRecord[], key: string) {
        for (const wish of values) {
            if (wish.name in this.data) {
                const entries = this.data[wish.name]!![key];
                if (!entries)
                    this.data[wish.name][key] = [wish];
                else if (!(<(Study | GlobalRankRecord | UserRankRecord)[]>entries!!).find(s => s.year === wish.year))
                    entries.push(wish);
            } else this.data[wish.name] = {
                [key]: [wish]
            };
        }
    }
}