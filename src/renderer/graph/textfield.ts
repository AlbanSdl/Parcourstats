import { Component } from "./component";

export class TextField extends Component<HTMLInputElement> {
    public readonly element: HTMLInputElement = document.createElement("input");

    constructor(placeholder: string, oninput: (this: HTMLInputElement, ev: Event) => any, parent: Element = null, prefilled: string = "") {
        super()
        this.element.type = 'text'
        this.element.classList.add('text-field');
        this.element.placeholder = placeholder
        this.element.value = prefilled
        this.element.addEventListener('input', oninput)
        parent?.appendChild(this.element)
    }
}