import { createElement } from "structure/element";
import { Icon } from "components/icon";
import { Activity } from "./activity";
import { Selector } from "components/selector";

export class Home extends Activity {
    private side: HTMLElement;
    private sideHeader: Selector<string>;

    public create() {
        this.createContext();
    }

    public onCreate(): void {
        this.title = this.getLocale("app.name")
        this.root.classList.add("home");
        this.side = createElement({
            classes: ["side", "loadable"]
        });
        const sideHeaders = createElement({
            classes: ["headers"]
        })
        this.sideHeader = new Selector({
            container: sideHeaders,
            extractor: e => e?.id,
            isUnique: true,
            neverEmpty: true
        })
        this.side.append(sideHeaders)
        this.side.addIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        this.root.append(this.side, createElement({
            classes: ["overview"]
        }))
    }

    public onCreated(): void {
        // Dummy header
        const header1 = createElement({
            classes: ["header"],
            ripple: true,
            action: "wish-list"
        });
        header1.textContent = this.getLocale("wishes.list");
        this.sideHeader.append(header1);
        // Dummy element
        const dummyWish = createElement({
            classes: ["wish"],
            ripple: true
        });
        dummyWish.textContent = this.getLocale("wishes.dummy.name");
        this.side.append(dummyWish)
    }

    public onDestroyed(): void {
        this.sideHeader.stop();
        delete this.sideHeader;
        delete this.side;
    }

    private createCard(id: string, icon: Icon, title: string, content: string, onclick: () => any = null) {
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
}