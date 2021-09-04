import { Query } from "../../common/window"

export declare type URI = `${string}://${string}`;

export declare interface LinkHandler<T> {
    handle(uri: URI, ext: boolean): Promise<T>
}

export const LINK: LinkHandler<void> = {
    async handle(uri) {
        return window.messenger.send(Query.OPEN_EXTERNAL, uri)
    }
}

export namespace Link {
    const linkClickedAttribute: string = 'data-being-clicked'
    const linkAttachementAttribute: string = 'data-link'
    export function bind(link: HTMLElement, action: LinkHandler<unknown> = LINK, target?: string) {
        if (!!target?.includes("://")) link.setAttribute(linkAttachementAttribute, target)
        else if (!!target) link.classList.add("disabled")
        link.addEventListener('mousedown', function(e) {
            link.setAttribute(linkClickedAttribute, '')
            if (e.button === 1 && e.buttons === 4 && e.which === 2)
                e.preventDefault()
        })
        link.addEventListener('mouseup', function(e) {
            if (!this.hasAttribute(linkClickedAttribute)) return
            this.removeAttribute(linkClickedAttribute)
            e.stopImmediatePropagation()
            const location = this.getAttribute(linkAttachementAttribute) as URI
            if (!!location) action.handle(location, e.button === 1 && e.which === 2);
        })
        link.setAttribute('draggable', 'true')
        link.addEventListener('dragstart', function(e) {
            this.removeAttribute(linkClickedAttribute)
            e.dataTransfer.setData('text/uri-list', this.getAttribute(linkAttachementAttribute))
        })
    }
    export function init(className: string = 'link') {
        for (let link of document.getElementsByClassName(className)) 
            if (link instanceof HTMLElement) bind(link)
        window.addEventListener('mouseup', () => {
            for (const elem of document.getElementsByClassName(className))
                if (elem.hasAttribute(linkAttachementAttribute) && elem.hasAttribute(linkClickedAttribute))
                    elem.removeAttribute(linkClickedAttribute)
        })
    }
}