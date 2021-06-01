export namespace Ripple {
    const componentTag = 'has-ripple'
    function listener(this: HTMLElement | SVGElement, e: MouseEvent) {
        this.style.overflow='hidden'
        this.style.position='relative'
        const bcr = this.getBoundingClientRect()
        const r = document.createElement("div")
        r.classList.add('ripple');
        r.style.left = `${e.x - bcr.x - window.scrollX}px`;
        r.style.top = `${e.y - bcr.y - window.scrollY}px`;
        this.append(r)
        r.getBoundingClientRect()
        const rSize = Math.max(bcr.height, bcr.width, 600)
        r.style.opacity='0'
        r.style.width=r.style.height=`${rSize}px`
        setTimeout(() => r.remove(), 550)
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