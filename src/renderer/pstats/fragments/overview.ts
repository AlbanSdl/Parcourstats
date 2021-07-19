import type { Home } from "../home";
import { Graph, DatasetGraphEntry } from "components/graph";
import { Icon } from "components/icon";
import { createElement } from "structure/element";
import { TodayFragment } from "record";
import { Page } from "pstats/page";
import { Adapter } from "components/adapter";
import type { Formation } from "pstats/formation";

export class Overview extends Page<Home, Adapter<Formation>> {
    private readonly timeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric"
    })
    private graph?: Graph;
    protected readonly forceTransitionDirection = false;

    protected async onCreate(from?: Page<Home, Adapter<Formation>>) {
        const root = await super.onCreate(from);
        root.classList.add("overview", "loadable");
        root.toggleAttribute("loading", true)
        root.setIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        const wrapper = createElement({
            classes: ["container"]
        });
        root.prepend(wrapper);
        const absTitle = createElement({
            classes: ["title"],
            text: this.getLocale("wishes.overview.abstract.title")
        })
        wrapper.append(absTitle)
        const abs = createElement({
            classes: ["abstract"]
        })
        const accepted = createElement({
            classes: ["entry", "accepted"],
            text: this.getLocale("wishes.overview.abstract.accepted")
        });
        accepted.prepend(createElement({
            classes: ["value"]
        }))
        const pending = createElement({
            classes: ["entry", "pending"],
            text: this.getLocale("wishes.overview.abstract.pending")
        });
        pending.prepend(createElement({
            classes: ["value"]
        }))
        const refused = createElement({
            classes: ["entry", "refused"],
            text: this.getLocale("wishes.overview.abstract.refused")
        });
        refused.prepend(createElement({
            classes: ["value"]
        }))
        abs.append(accepted, pending, refused)
        const today = createElement({
            classes: ["today"],
            text: this.getLocale("wishes.overview.today.tip")
        })
        const todayGo = createElement({
            classes: ["go"],
            ripple: true,
            text: this.getLocale("wishes.overview.today.letsgo")
        })
        today.append(todayGo);
        wrapper.append(abs, today);
        const graphTitle = createElement({
            classes: ["title"],
            text: this.getLocale("wishes.overview.title")
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
        this.data.then(adapter => {
            const states = adapter.asList.map(e => e.latestUserRecord).filter(e => !!e);
            this.displayValue("accepted", states.filter(rec => rec.queued === 0).length.toString())
            this.displayValue("pending", states.filter(rec => rec.queued > 0).length.toString())
            this.displayValue("refused", states.filter(rec => rec.queued < 0).length.toString())
            let index = 0;
            for (const study of adapter) {
                if (!study.sessions.length || !study.session?.user?.length) continue;
                const graphEntry = new DatasetGraphEntry(study.name, `overview-${index}`)
                const values = new Map(study.session!.user
                    .until(record => record.queued < 0)
                    .map(rec => [rec.time, rec.queued]));
                if ([...values.values()].reduce((p, c) => p + c, 0) <= 0) continue;
                index++;
                graphEntry.add(values);
                this.graph?.addEntry(graphEntry, false);
            }
            this.graph?.invalidate();
            this.root.toggleAttribute("loading", false)
            const lastUpdate = new Date(adapter.asList
                .map(entry => [entry.latestGlobalRecord, entry.latestUserRecord])
                .flat().filter(record => !!record)
                .sort((a, b) => b.time - a.time)[0]?.time),
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
}