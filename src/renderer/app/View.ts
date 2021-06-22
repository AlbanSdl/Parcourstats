import { fadeOutElement } from "components/fade";
import { Ripple } from "components/ripple";
import { ClientSyncRequest } from "../../common/window";
import { createElement } from "structure/element";
import { Icon } from "components/icon";

export class View {

    private isLoading: boolean;
    private readonly cachedLocales: Map<string, string>;
    public checkout: string;

    constructor() {
        this.isLoading = true;
        this.cachedLocales = new Map();
    }

    public setLoaded(loaded: boolean): void {
        if (this.isLoading && loaded)
            fadeOutElement(<HTMLElement>document.getElementsByClassName("splash")[0], 400, true);
        this.isLoading = !loaded;
    }

    public createCard(id: string, icon: Icon, title: string, content: string, onclick: () => any = null) {
        const card = createElement({
            classes: ["card", "smooth"],
            id,
            ripple: onclick !== null
        })
        card.addIcon(icon).then(icon => {
            for (const path of icon.children) if (path instanceof SVGPathElement) {
                path.style.strokeDasharray = path.style.strokeDashoffset = path.getTotalLength().toString();
                path.getBoundingClientRect();
                path.style.strokeDasharray = path.style.strokeDashoffset = "0";
            }
        })
        const details = createElement({
            classes: ["details"]
        })
        const name = createElement({
            classes: ["name"]
        });
        name.textContent = title;
        const contents = createElement({
            classes: ["description", "smooth"]
        });
        contents.textContent = content;
        details.append(name, contents);
        card.appendChild(details);
        if (onclick != null)
            card.addEventListener('click', onclick);
        return card;
    }

    public setTitle(title: string): void {
        (<HTMLElement>document.getElementById("app-bar").getElementsByClassName("title")[0]).innerText = title;
    }

    public getLocale(stringId: string): string {
        const cached = this.cachedLocales.get(stringId);
        if (cached == null)
            this.cachedLocales.set(stringId, window.bridge.sendSync(ClientSyncRequest.LOCALE_GET, stringId));
        return cached ?? this.cachedLocales.get(stringId);
    }

}