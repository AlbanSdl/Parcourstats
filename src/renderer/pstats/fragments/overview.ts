import type { Home } from "../home";
import { Graph, DatasetGraphEntry } from "components/graph";
import { Icon } from "components/icon";
import { createElement } from "structure/element";
import { TodayFragment } from "record";
import { Page } from "pstats/page";

export class Overview extends Page<Home, LoadedData> {
    private readonly timeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric"
    })
    private graph?: Graph;
    protected readonly forceTransitionDirection = false;

    protected async onCreate(from?: Page<Home, LoadedData>) {
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
            text: await this.getLocale("wishes.overview.abstract.title")
        })
        wrapper.append(absTitle)
        const abs = createElement({
            classes: ["abstract"]
        })
        const accepted = createElement({
            classes: ["entry", "accepted"],
            text: await this.getLocale("wishes.overview.abstract.accepted")
        });
        accepted.prepend(createElement({
            classes: ["value"]
        }))
        const pending = createElement({
            classes: ["entry", "pending"],
            text: await this.getLocale("wishes.overview.abstract.pending")
        });
        pending.prepend(createElement({
            classes: ["value"]
        }))
        const refused = createElement({
            classes: ["entry", "refused"],
            text: await this.getLocale("wishes.overview.abstract.refused")
        });
        refused.prepend(createElement({
            classes: ["value"]
        }))
        abs.append(accepted, pending, refused)
        const today = createElement({
            classes: ["today"],
            text: await this.getLocale("wishes.overview.today.tip")
        })
        const todayGo = createElement({
            classes: ["go"],
            ripple: true,
            text: await this.getLocale("wishes.overview.today.letsgo")
        })
        today.append(todayGo);
        wrapper.append(abs, today);
        const graphTitle = createElement({
            classes: ["title"],
            text: await this.getLocale("wishes.overview.title")
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
        this.data.then(d => {
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
                    .map(rec => [rec.record_time, rec.application_queued]));
                if ([...values.values()].reduce((p, c) => p + c, 0) <= 0) continue;
                index++;
                graphEntry.add(values);
                this.graph?.addEntry(graphEntry, false);
            }
            this.graph?.invalidate();
            this.root.toggleAttribute("loading", false)
            const lastUpdate = new Date(Object.values(d)
                .map(entry => [...entry.global, ...entry.user])
                .reduce((a, b) => [...a, ...b])
                .filter(record => !!record)
                .sort((a, b) => b.record_time - a.record_time)[0]?.record_time),
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