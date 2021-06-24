import { createElement } from "structure/element";

declare global {
    interface HTMLElement {
        /** Inserts an icon as a svg tag IN the current element. 
         *  In order to load icons automatically when the html document is loaded, add
         *  `data-icon` attributes to nodes. */
        addIcon(this: HTMLElement, icon: Icon): Promise<SVGSVGElement>;
    }
}

async function loadResourceFile(icon: string) {
    return new Promise<SVGSVGElement>(res => {
        let request = new XMLHttpRequest();
        request.open('GET', `../resources/icons/${icon.replaceAll(/[^0-9a-z_\-]/gumi, '')}.svg`, true);
        request.setRequestHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        request.onload = function() { res(new DOMParser().parseFromString(this.responseText, 'image/svg+xml').firstElementChild as SVGSVGElement) }
        request.onerror = request.onabort = () => res(createElement({tag: 'svg', svg: true}));
        request.send();
    });
}

export enum Icon {
    CLOSE = 'close',
    LOADING = 'load',
    PSUP = 'ic-parcoursup',
    PSUP_FULL = 'ic-parcoursup-full',
    PSTATS = 'ic-parcourstats',
    WINDOW_EXFS = 'fullscreen_exit',
    WINDOW_ENFS = 'fullscreen'
}

export async function enableIcons() {
    HTMLElement.prototype.addIcon = async function(icon) {
        const iconElement = await loadResourceFile(icon);
        this.appendChild(iconElement);
        return iconElement;
    }
    const ATTRIBUTE_ICON = "data-icon";
    for (const elem of document.querySelectorAll(`[${ATTRIBUTE_ICON}]`)) {
        const icon = elem.getAttribute(ATTRIBUTE_ICON);
        elem.appendChild(await loadResourceFile(icon));
        elem.removeAttribute(ATTRIBUTE_ICON);
    }
}