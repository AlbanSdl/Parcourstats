import { Factory } from "structure/factory";
import { Component } from "./component";
import { Ripple } from "./ripple";

export enum ButtonStyle {
    RAISED = 0b0,
    FLAT = 0b1,
    COMPACT = 0b10,
}

export class Button extends Component<HTMLElement> {
    public readonly element: HTMLElement = Factory.get().addClass('button').toElement()

    constructor(content: string, private onclick: (this: Button, ev: MouseEvent) => any, 
        parent: Element = null, buttonStyle: ButtonStyle = ButtonStyle.RAISED) {
        super()
        if (buttonStyle & ButtonStyle.FLAT) this.element.classList.add('flat');
        if (buttonStyle & ButtonStyle.COMPACT) this.element.classList.add('compact');
        this.element.innerText = content
        parent?.appendChild(this.element)
        Ripple.apply(this.element);
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
        return this.element.innerText
    }

    public set text(text: string) {
        this.element.innerText = text;
    }

}