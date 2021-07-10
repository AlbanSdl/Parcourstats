import { createElement } from "structure/element";

declare global {
    interface HTMLElement {
        /** Inserts an icon as a svg tag IN the current element. 
         *  In order to load icons automatically when the html document is loaded, add
         *  `data-icon` attributes to nodes. */
        setIcon(this: HTMLElement, icon: Icon, clear?: boolean): Promise<SVGSVGElement>;
    }
}

function loadIcon(icon: Icon): Promise<Document> {
    const waiting: Array<[(document: Document) => void, () => void]> = [];
    icons.set(icon, () => new Promise((res, rej) => waiting.push([res, rej])));
    return new Promise((res, rej) => {
        const request = new XMLHttpRequest();
        request.responseType = "document";
        request.open('GET', `../resources/icons/${icon.replaceAll(/[^0-9a-z_\-]/gumi, '')}.svg`, true);
        request.setRequestHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        request.onload = function() {
            const document = this.responseXML;
            res(document);
            icons.set(icon, () => Promise.resolve(document));
            waiting.forEach(([res]) => res(document));
        }
        request.onerror = request.onabort = () => {
            rej();
            waiting.forEach(([, rej]) => rej());
        }
        request.send();
    })
}

const icons = new Map<string, () => Promise<Document>>();
const iconSinkEvent = "iconsink";

async function getIcon(icon: Icon) {
    return (icons.get(icon) ?? loadIcon)(icon)
        .then(content => content.firstElementChild.cloneNode(true) as SVGSVGElement)
        .catch(() => createElement({
            svg: true
        }))
}

export enum Icon {
    CLOSE = 'close',
    LOADING = 'load',
    PSTATS = 'ic-pstats',
    TREND = 'trend',
    WINDOW_EXFS = 'fullscreen_exit',
    WINDOW_ENFS = 'fullscreen'
}

export async function enableIcons() {
    HTMLElement.prototype.setIcon = async function(icon, clear = false) {
        const iconElement = await getIcon(icon);
        if (clear) this.dispatchEvent(new Event(iconSinkEvent));
        this.appendChild(iconElement);
        this.addEventListener(iconSinkEvent, () => iconElement.remove(), {
            once: true,
            passive: true
        })
        return iconElement;
    }
    const ATTRIBUTE_ICON = "data-icon";
    for (const elem of document.querySelectorAll(`[${ATTRIBUTE_ICON}]`)) {
        if (!(elem instanceof HTMLElement)) return;
        const icon = elem.getAttribute(ATTRIBUTE_ICON);
        elem.removeAttribute(ATTRIBUTE_ICON);
        elem.setIcon(<Icon>icon)
    }
}