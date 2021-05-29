import { ipcRenderer } from "electron";
import { Ascript } from "../ascript";
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
            Ascript.fadeOutElement(<HTMLElement>document.getElementsByClassName("splash")[0], true);
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
            Ascript.addRippleListener(card);
            card.addEventListener('click', onclick);
        }
        return card;
    }

    public setTitle(title: string): void {
        (<HTMLElement>document.getElementById("appBar").getElementsByClassName("title")[0]).innerText = title;
    }

    public getLocale(string_id: string): string {
        const cached = this.cachedLocales.get(string_id);
        if (cached == null)
            this.cachedLocales.set(string_id, ipcRenderer.sendSync("localeString", string_id))
        return cached ?? this.cachedLocales.get(string_id);
    }

}