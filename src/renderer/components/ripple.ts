import { createElement } from "structure/element"

export namespace Ripple {
    const componentTag = 'has-ripple'
    function listener(this: HTMLElement | SVGElement, e: MouseEvent) {
        this.classList.toggle("ripple-container", true);
        requestAnimationFrame(() => {
            const bcr = this.getBoundingClientRect()
            const r = createElement({
                classes: ['ripple'],
                style: {
                    left: `${e.x - bcr.x - window.scrollX}px`,
                    top: `${e.y - bcr.y - window.scrollY}px`
                }
            })
            this.append(r);
            requestAnimationFrame(() => {
                const rSize = Math.max(bcr.height, bcr.width, 600);
                r.style.opacity = '0';
                r.style.width = r.style.height = `${rSize}px`;
                setTimeout(() => r.remove(), 550);
            })
        });
    }
    export function apply(target: HTMLElement | SVGElement) {
        if (!target.hasAttribute(componentTag)) {
            target.addEventListener('mousedown', listener)
            target.setAttribute(componentTag, '')
            return true
        }
        return false
    }
    export function remove(target: HTMLElement | SVGElement) {
        if (target.hasAttribute(componentTag)) {
            target.removeEventListener('mousedown', listener)
            target.removeAttribute(componentTag)
            return true
        }
        return false
    }
    export function init(className: string = 'button', excludedClasses: string = 'disabled') {
        for (let link of document.getElementsByClassName(className)) 
            if ((link instanceof HTMLElement || link instanceof SVGElement) 
                && !link.className.includes(excludedClasses)) apply(link)
    }
}