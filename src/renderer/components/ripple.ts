import { createElement } from "structure/element"

export namespace Ripple {
    const componentTag = 'has-ripple'
    function listener(this: HTMLElement, e: MouseEvent) {
        this.classList.toggle("ripple-container", true);
        const bcr = this.getBoundingClientRect()
        const element = createElement({
            classes: ['ripple'],
            style: {
                left: `${e.x - bcr.x - window.scrollX}px`,
                top: `${e.y - bcr.y - window.scrollY}px`
            }
        });
        const controller = new AbortController();
        let animationLock: () => void;
        let mouseLock: () => void;
        Promise.all([
            new Promise<void>(res => mouseLock = res),
            new Promise<void>(res => animationLock = res)
        ]).then(() => {
            controller.abort();
            requestAnimationFrame(() => {
                element.classList.add("out");
                element.addEventListener('transitionend', event => !event.pseudoElement && event.elapsedTime >= .3 
                    && event.propertyName === "opacity" && requestAnimationFrame(() => element.remove()))
            })
        })
        this.addEventListener('mouseup', mouseLock, {
            passive: true,
            signal: controller.signal
        });
        this.addEventListener('mouseleave', mouseLock, {
            passive: true,
            signal: controller.signal
        });
        this.addEventListener('dragend', mouseLock, {
            passive: true,
            signal: controller.signal
        });
        this.append(element);
        requestAnimationFrame(() => {
            element.classList.add("fill");
            element.addEventListener('transitionend', event => {
                if (!event.pseudoElement && event.elapsedTime >= .3 && event.propertyName !== "opacity") animationLock()
            }, {
                once: true
            });
        })
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