import type { Home } from "pstats/home";
import { Graph, DatasetGraphEntry, ComputedGraphEntry, PreviousBasedComputedGraphEntry } from "components/graph";
import { Icon } from "components/icon";
import { createElement } from "structure/element";
import { Page } from "pstats/page";
import { Adapter } from "components/adapter";
import type { Formation } from "pstats/formation";
import { scheduleRepeating } from "scheduler";

export class WishFragment extends Page<Home, Adapter<Formation>> {
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

    protected async onCreate(from: Page<Home, Adapter<Formation>>) {
        const root = await super.onCreate(from);
        root.classList.add("wish", "loadable");
        root.toggleAttribute("loading", true)
        root.setIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
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
            text: this.getLocale("wish.update.last")
        })
        const cpValue = createElement({
            classes: ["value", "text", "lazy"]
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
            text: this.getLocale("wish.rank.user"),
            position: "-"
        }), createElement({
            classes: ["rank", "abs"],
            text: this.getLocale("wish.rank.initial"),
            position: "-"
        }), createElement({
            classes: ["rank", "all"],
            text: this.getLocale("wish.rank.all"),
            position: "-"
        }), createElement({
            classes: ["rank", "last"],
            text: this.getLocale("wish.rank.last"),
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
            text: this.getLocale("wish.graph.speed.header")
        })
        speedHeader.append(createElement({
            classes: ["attachment"],
            text: this.getLocale("wish.graph.speed.attachment")
        }))
        wrapper.append(speedHeader)
        this.speedGraph.attach(wrapper);
        const updateTable = createElement({
            classes: ["updates"]
        })
        const header = createElement({
            classes: ["row", "header"]
        });
        header.append(createElement({
            text: this.getLocale("wish.updates.header.time")
        }), createElement({
            text: this.getLocale("wish.updates.header.rank")
        }), createElement({
            text: this.getLocale("wish.updates.header.last")
        }), createElement({
            text: this.getLocale("wish.updates.header.all")
        }))
        updateTable.append(header);
        wrapper.append(updateTable);
        return root;
    }
    protected onCreated(): void {
        this.data.then(async data => {
            const currentYear = new Date().getFullYear();
            const wish = data.asList.find(formation => formation.name === this.wishName)
                .sessions?.find(session => session.year === currentYear);

            const update = (wish?.global?.map(g => g.time) ?? [])
                .concat(wish?.user?.map(u => u.time) ?? [])
                .sort()
                .slice(-1)[0];
            (update === undefined ? this.getLocale("wish.rank.unknown") : Promise.resolve(new Date(update).toLocaleDateString(undefined, {
                day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "numeric"
            }))).then(dateString => this.root.querySelector(".container .title .complement.update .value").textContent = dateString)

            const userData = wish?.user ?? [],
                globalData = wish?.global ?? []
            let overall: Promise<string>;
            let displayedRank: Formation["user"] extends Array<infer R> ? R : never | undefined;
            let displayGlobalData: Formation["global"] extends Array<infer R> ? R : never | undefined;
            if (userData[userData.length - 1]?.queued > 0) {
                overall = this.getLocale("wish.status.pending");
                displayedRank = userData[userData.length - 1];
                displayGlobalData = globalData[globalData.length - 1];
            }
            else if (userData[userData.length - 1]?.queued === 0) {
                overall = this.getLocale(userData.length === 1 ? "wish.rank.unknown.accepted" : "wish.status.accepted");
                displayedRank = userData[userData.length - 1];
                displayGlobalData = globalData[globalData.length - 1];
            }
            else if (userData[userData.length - 1]?.queued === -1) {
                overall = this.getLocale(userData.length === 1 ? "wish.rank.unknown.refused" : "wish.status.refused");
                displayedRank = userData[userData.length - 2];
                displayGlobalData = globalData[globalData.length - 1];
            } else if (userData[userData.length - 1]?.queued === -2) {
                overall = this.getLocale("wish.status.resigned");
                displayedRank = userData[userData.length - 2];
                displayGlobalData = globalData[globalData.length - 1];
            } else {
                overall = this.getLocale("wish.rank.unknown")
                displayedRank = userData[userData.length - 2];
                displayGlobalData = globalData[globalData.length - 1];
            }
            overall.then(header => this.root.querySelector(".container > .overview > .overall").textContent = header)
            if (!!displayedRank && !!displayGlobalData) {
                this.root.querySelector(".container > .overview > .rank.user")?.
                    setAttribute("position", displayedRank.queued.toString())
                this.root.querySelector(".container > .overview > .rank.abs")?.
                    setAttribute("position", wish.absolute.toString())
            }
            if (!!displayGlobalData) {
                if (!!displayGlobalData.all) this.root.querySelector(".container > .overview > .rank.all")?.
                    setAttribute("position", displayGlobalData.all.toString())
                if (!!displayGlobalData.last) this.root.querySelector(".container > .overview > .rank.last")?.
                    setAttribute("position", displayGlobalData.last.toString())
            }

            if ((displayGlobalData?.last ?? 0) < 1)
                this.root.toggleAttribute("no-data", true);
            else {
                const userRank = new DatasetGraphEntry(this.getLocale("wish.rank.user"), "user-rank");
                userRank.add(new Map(userData
                    .until(record => record.queued < 0)
                    .map(entry => [
                        Math.trunc(entry.time / 864e5),
                        entry.queued
                    ])
                ));
                const allApplications = new DatasetGraphEntry(this.getLocale("wish.rank.all"), "app-all");
                allApplications.add(new Map(globalData.map(entry => [
                    Math.trunc(entry.time / 864e5),
                    entry.all
                ])));
                const lastAcceptedRank = new DatasetGraphEntry(this.getLocale("wish.rank.last"), "app-last");
                lastAcceptedRank.add(new Map(globalData.map(entry => [
                    Math.trunc(entry.time / 864e5),
                    entry.last
                ])));
                const renouncingPeopleBehindUser = new ComputedGraphEntry(this.getLocale("wish.graph.people.after"), "user-after", 
                    (_, all, user) => all - user, allApplications, userRank)
                await this.graph.add(userRank, allApplications, lastAcceptedRank, renouncingPeopleBehindUser);
    
                const size = wish.size || 1;
                const userRankAdvancementSpeed = new PreviousBasedComputedGraphEntry(this.getLocale("wish.graph.speed.user"), "speed-user-rank", 
                    (_, pre, current) => pre === undefined ? pre : (pre - current) / size, userRank)
                const formationAdvancementSpeed = new PreviousBasedComputedGraphEntry(this.getLocale("wish.graph.speed.last"), "speed-app-last", 
                    (_, pre, current) => pre === undefined ? 0 : (current - pre) / size, lastAcceptedRank)
                const queueShrinkSpeed = new PreviousBasedComputedGraphEntry(this.getLocale("wish.graph.speed.all"), "speed-app-all", 
                    (_, pre, current) => pre === undefined ? 0 : (pre - current) / size, allApplications)
                this.speedGraph.add(userRankAdvancementSpeed, formationAdvancementSpeed, queueShrinkSpeed);

                const recordDates = new Set(userData.map(userRecord => userRecord.time)
                    .concat(globalData.map(globalRecord => globalRecord.time))
                    .map(timestamp => Math.trunc(timestamp / 86400000))
                    .sort((a, b) => b - a));
                const getSignedNumber = (n: number) => n < 0 || !isFinite(n) ? n.toString() : `+${n.toString()}`;
                const fast = (value: number, diff: number) => isFinite(diff) && !!Math.trunc(20 * Math.abs(diff) / (value || 1));
                scheduleRepeating<PreviousRecord>(...[...recordDates].map(record => {
                    const glob = globalData.find(gl => Math.trunc(new Date(gl.time).getTime() / 86400000) === record);
                    const user = userData.find(us => Math.trunc(new Date(us.time).getTime() / 86400000) === record);
                    if (user.queued < 0) return null;
                    return (previous: PreviousRecord) => {
                        const previousRankElement = previous?.row?.children?.item(1) as HTMLElement,
                            previousLastElement = previous?.row?.children?.item(2) as HTMLElement,
                            previousAllElement = previous?.row?.children?.item(3) as HTMLElement;
                        if (!!previousRankElement) {
                            const diff = previous.user?.queued - user?.queued;
                            previousRankElement.setAttribute("diff", getSignedNumber(diff));
                            if (fast(user?.queued, diff))
                                previousRankElement.setIcon(Icon.TREND);
                        }
                        if (!!previousLastElement) {
                            const diff = previous.glob?.last - glob?.last;
                            previousLastElement.setAttribute("diff", getSignedNumber(diff));
                            if (fast(glob?.last, diff))
                                previousLastElement.setIcon(Icon.TREND);
                        }
                        if (!!previousAllElement) {
                            const diff = previous.glob?.all - glob?.all;
                            previousAllElement.setAttribute("diff", getSignedNumber(diff));
                            if (fast(glob?.all, diff))
                                previousAllElement.setIcon(Icon.TREND);
                        }
                        
                        const row = createElement({
                            classes: ["row"]
                        });
                        row.append(createElement({
                            text: this.timeFormat.format(glob?.time || user!!.time)
                        }), createElement({
                            text: user?.queued?.toString() ?? "-"
                        }), createElement({
                            text: glob?.last?.toString() ?? "-"
                        }), createElement({
                            text: glob?.all?.toString() ?? "-"
                        }))
                        this.root.querySelector(".container > .updates")?.append(row);
                        return {
                            row,
                            glob,
                            user
                        }
                    }
                }));
            }
            this.root.toggleAttribute("loading", false)
        })
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
        delete this.graph;
    }
}

type PreviousRecord = {
    row: HTMLElement,
    glob?: Formation["global"] extends Array<infer R> ? R : never,
    user?: Formation["user"] extends Array<infer R> ? R : never
}