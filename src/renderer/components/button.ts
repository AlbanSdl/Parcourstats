import { createElement } from "structure/element";
import { Ripple } from "ripple";

export enum ButtonStyle {
    RAISED = 0b0,
    FLAT = 0b1,
    COMPACT = 0b10,
}

export class Button {
    public readonly element: HTMLElement;

    constructor(content: string | Promise<string>, private onclick: (this: Button, ev: MouseEvent) => any, 
        parent: Element = null, buttonStyle: ButtonStyle = ButtonStyle.RAISED) {
        const classes = ['button', 'disabled'];
        if (buttonStyle & ButtonStyle.FLAT) classes.push('flat');
        if (buttonStyle & ButtonStyle.COMPACT) classes.push('compact');
        this.element = createElement({
            classes,
            text: content
        })
        parent?.appendChild(this.element);
    }

    public get enabled(): boolean {
        return !this.element.classList.contains('disabled');
    }

    public set enabled(enabled: boolean) {
        if (this.enabled && !enabled) {
            this.element.classList.add('disabled');
            this.element.removeEventListener('click', this.onclick);
            Ripple.remove(this.element);
        } else if (!this.enabled && enabled) {
            this.element.classList.remove('disabled');
            this.element.addEventListener('click', this.onclick);
            Ripple.apply(this.element);
        }
    }

    public set listener(onclick: (this: Button, ev: MouseEvent) => any) {
        if (this.enabled)
            this.element.removeEventListener("click", this.onclick)
        this.onclick = onclick;
        if (this.enabled)
            this.element.addEventListener("click", this.onclick)
    }

    public get text(): string {
        return this.element.textContent
    }

    public set text(text: string) {
        this.element.textContent = text;
    }

}