import { createElement } from "structure/element";
import { Component } from "./component";

interface TextFieldOptions {
    id?: string,
    oninput: (this: HTMLInputElement, ev: Event) => any,
    parent?: Element,
    placeholder: string,
    prefilled?: string,
    regex?: RegExp,
    required?: boolean,
    spellcheck?: boolean
}

export class TextField implements Component<HTMLDivElement> {
    public readonly element: HTMLDivElement = createElement({
        classes: ["wrapper", "text-field"]
    });

    constructor(options: TextFieldOptions) {
        const wrapped = createElement({
            tag: "input",
            classes: ["field"],
            type: "text",
            id: options.id,
            value: options.prefilled ?? "",
            placeholder: " ",
            pattern: `${options?.regex ?? /.*/}`.slice(1, -1),
            spellcheck: options.spellcheck === true,
            required: options.required === true
        });
        const helper = createElement({
            tag: "span",
            classes: ["helper"]
        })
        helper.textContent = options.placeholder;
        wrapped.addEventListener('input', options.oninput!!)
        this.element.append(wrapped, helper);
        options?.parent?.appendChild(this.element)
    }
}