import { fadeOutElement } from "components/fade";
import { Ripple } from "components/ripple";
import { BridgedRequestType } from "../../common/window";
import { AppContext } from "../webview";

export class View implements AppContext {

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

    public createElement(id: string, ...classes: Array<string>): HTMLDivElement {
        const elem = document.createElement("div");
        if (id != null)
            elem.id = id;
        elem.classList.add(...classes);
        return elem;
    }

    public createCard(id: string, /*iconType: Icon.Type,*/ title: string, content: string, onclick: () => any = null) {
        const card = this.createElement(id, "card", "smooth");
        /*if (iconType != null) {
            card.innerHTML = Icon.getIcon(iconType, "icon");
            for (const path of <any>card.getElementsByTagName("svg")[0].children)
                if (path instanceof SVGPathElement)
                    path.style.strokeDasharray = path.style.strokeDashoffset = path.getTotalLength().toString();
        }*/
        const details = this.createElement(null, "details");
        const name = this.createElement(null, "name");
        name.innerText = title;
        const contents = this.createElement(null, "description", "smooth");
        contents.innerHTML = content;
        details.append(name, contents);
        card.appendChild(details);
        if (onclick != null) {
            Ripple.apply(card);
            card.addEventListener('click', onclick);
        }
        return card;
    }

    public setTitle(title: string): void {
        (<HTMLElement>document.getElementById("app-bar").getElementsByClassName("title")[0]).innerText = title;
    }

    public getLocale(stringId: string): string {
        const cached = this.cachedLocales.get(stringId);
        if (cached == null)
            this.cachedLocales.set(stringId, window.bridge.sendSync(BridgedRequestType.GET_LOCALE, stringId));
        return cached ?? this.cachedLocales.get(stringId);
    }

}