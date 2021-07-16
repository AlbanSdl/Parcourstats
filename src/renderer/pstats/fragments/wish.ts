import type { Home } from "pstats/home";
import { Graph, DatasetGraphEntry, ComputedGraphEntry, PreviousBasedComputedGraphEntry } from "components/graph";
import { Icon } from "components/icon";
import { createElement } from "structure/element";
import { Page } from "pstats/page";

export class WishFragment extends Page<Home, LoadedData> {
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

    protected async onCreate(from: Page<Home, LoadedData>) {
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
            text: await this.getLocale("wish.update.last")
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
            text: await this.getLocale("wish.rank.user"),
            position: "-"
        }), createElement({
            classes: ["rank", "abs"],
            text: await this.getLocale("wish.rank.initial"),
            position: "-"
        }), createElement({
            classes: ["rank", "all"],
            text: await this.getLocale("wish.rank.all"),
            position: "-"
        }), createElement({
            classes: ["rank", "last"],
            text: await this.getLocale("wish.rank.last"),
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
            text: await this.getLocale("wish.graph.speed.header")
        })
        speedHeader.append(createElement({
            classes: ["attachment"],
            text: await this.getLocale("wish.graph.speed.attachment")
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
            text: await this.getLocale("wish.updates.header.time")
        }), createElement({
            text: await this.getLocale("wish.updates.header.rank")
        }), createElement({
            text: await this.getLocale("wish.updates.header.last")
        }), createElement({
            text: await this.getLocale("wish.updates.header.all")
        }))
        updateTable.append(header);
        wrapper.append(updateTable);
        return root;
    }
    protected onCreated(): void {
        this.data.then(async data => {
            const wish = data[this.wishName];
            const update = (wish.global?.map(g => g.record_time) ?? [])
                .concat(wish.user?.map(u => u.record_time) ?? [])
                .sort()
                .slice(-1)[0];
            this.root.querySelector(".container .title .complement.update .value").textContent = update === undefined ? 
            await this.getLocale("wish.rank.unknown") : new Date(update).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "numeric"
            });

            const currentYear = new Date().getFullYear();
            const userData = wish.user?.filter(entry => entry.year === currentYear)
                    ?.sort((a, b) => b.record_time - a.record_time) ?? [],
                globalData = wish.global?.filter(entry => entry.year === currentYear)
                    ?.sort((a, b) => b.record_time - a.record_time) ?? []
            let overall: string;
            let displayedRank: LoadedType<UserRankRecord> | undefined;
            let displayGlobalData: LoadedType<GlobalRankRecord> | undefined;
            if (userData[0]?.application_queued > 0) {
                overall = await this.getLocale("wish.status.pending");
                displayedRank = userData[0];
                displayGlobalData = globalData[0];
            }
            else if (userData[0]?.application_queued === 0) {
                overall = await this.getLocale(userData.length === 1 ? "wish.rank.unknown.accepted" : "wish.status.accepted");
                displayedRank = userData[0];
                displayGlobalData = globalData[0];
            }
            else if (userData[0]?.application_queued === -1) {
                overall = await this.getLocale(userData.length === 1 ? "wish.rank.unknown.refused" : "wish.status.refused");
                displayedRank = userData[1];
                displayGlobalData = globalData[0];
            } else if (userData[0]?.application_queued === -2) {
                overall = await this.getLocale("wish.status.resigned");
                displayedRank = userData[1];
                displayGlobalData = globalData[0];
            } else {
                overall = await this.getLocale("wish.rank.unknown")
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
                const userRank = new DatasetGraphEntry(await this.getLocale("wish.rank.user"), "user-rank");
                userRank.add(new Map(userData.slice().reverse()
                    .until(record => record.application_queued < 0)
                    .map(entry => [
                        Math.trunc(entry.record_time / 864e5),
                        entry.application_queued
                    ])
                ));
                const allApplications = new DatasetGraphEntry(await this.getLocale("wish.rank.all"), "app-all");
                allApplications.add(new Map(globalData.map(entry => [
                    Math.trunc(entry.record_time / 864e5),
                    entry.application_all
                ])));
                const lastAcceptedRank = new DatasetGraphEntry(await this.getLocale("wish.rank.last"), "app-last");
                lastAcceptedRank.add(new Map(globalData.map(entry => [
                    Math.trunc(entry.record_time / 864e5),
                    entry.application_last
                ])));
                const renouncingPeopleBehindUser = new ComputedGraphEntry(await this.getLocale("wish.graph.people.after"), "user-after", 
                    (_, all, user) => all - user, allApplications, userRank)
                this.graph.addEntry(userRank, false);
                this.graph.addEntry(allApplications, false);
                this.graph.addEntry(lastAcceptedRank, false);
                this.graph.addEntry(renouncingPeopleBehindUser, false);
                this.graph.invalidate();
    
                const size = wish.sessions?.sort((a, b) => b.year - a.year)?.[0]?.available || 1;
                const userRankAdvancementSpeed = new PreviousBasedComputedGraphEntry(await this.getLocale("wish.graph.speed.user"), "speed-user-rank", 
                    (_, pre, current) => pre === undefined ? pre : (pre - current) / size, userRank)
                const formationAdvancementSpeed = new PreviousBasedComputedGraphEntry(await this.getLocale("wish.graph.speed.last"), "speed-app-last", 
                    (_, pre, current) => pre === undefined ? 0 : (current - pre) / size, lastAcceptedRank)
                const queueShrinkSpeed = new PreviousBasedComputedGraphEntry(await this.getLocale("wish.graph.speed.all"), "speed-app-all", 
                    (_, pre, current) => pre === undefined ? 0 : (pre - current) / size, allApplications)
                this.speedGraph.addEntry(userRankAdvancementSpeed, false);
                this.speedGraph.addEntry(formationAdvancementSpeed, false);
                this.speedGraph.addEntry(queueShrinkSpeed, false);
                this.speedGraph.invalidate();

                const recordDates = new Set(userData.map(userRecord => userRecord.record_time)
                    .concat(globalData.map(globalRecord => globalRecord.record_time))
                    .map(timestamp => Math.trunc(timestamp / 86400000))
                    .sort((a, b) => b - a));
                let previous: {
                    row: HTMLElement,
                    glob?: LoadedType<GlobalRankRecord>,
                    user?: LoadedType<UserRankRecord>
                };
                const getSignedNumber = (n: number) => n < 0 || !isFinite(n) ? n.toString() : `+${n.toString()}`;
                const fast = (value: number, diff: number) => isFinite(diff) && !!Math.trunc(20 * Math.abs(diff) / (value || 1))
                for (const record of recordDates) {
                    const glob = globalData.find(gl => Math.trunc(new Date(gl.record_time).getTime() / 86400000) === record);
                    const user = userData.find(us => Math.trunc(new Date(us.record_time).getTime() / 86400000) === record);
                    if (user.application_queued < 0) continue;
                    const previousRankElement = previous?.row?.children?.item(1) as HTMLElement,
                        previousLastElement = previous?.row?.children?.item(2) as HTMLElement,
                        previousAllElement = previous?.row?.children?.item(3) as HTMLElement;
                    if (!!previousRankElement) {
                        const diff = previous.user?.application_queued - user?.application_queued;
                        previousRankElement.setAttribute("diff", getSignedNumber(diff));
                        if (fast(user?.application_queued, diff))
                            previousRankElement.setIcon(Icon.TREND);
                    }
                    if (!!previousLastElement) {
                        const diff = previous.glob?.application_last - glob?.application_last;
                        previousLastElement.setAttribute("diff", getSignedNumber(diff));
                        if (fast(glob?.application_last, diff))
                            previousLastElement.setIcon(Icon.TREND);
                    }
                    if (!!previousAllElement) {
                        const diff = previous.glob?.application_all - glob?.application_all;
                        previousAllElement.setAttribute("diff", getSignedNumber(diff));
                        if (fast(glob?.application_all, diff))
                            previousAllElement.setIcon(Icon.TREND);
                    }
                    
                    const row = createElement({
                        classes: ["row"]
                    });
                    row.append(createElement({
                        text: this.timeFormat.format(glob?.record_time || user!!.record_time)
                    }), createElement({
                        text: user?.application_queued?.toString() ?? "-"
                    }), createElement({
                        text: glob?.application_last?.toString() ?? "-"
                    }), createElement({
                        text: glob?.application_all?.toString() ?? "-"
                    }))
                    this.root.querySelector(".container > .updates")?.append(row);
                    previous = {
                        row,
                        glob,
                        user
                    }
                }
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