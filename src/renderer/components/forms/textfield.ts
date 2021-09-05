import { createElement } from "structure/element";

interface TextFieldOptions {
    id?: string,
    oninput: (this: HTMLInputElement, ev: Event) => void,
    parent?: Element,
    placeholder: string | Promise<string>,
    prefilled?: string,
    regex?: RegExp,
    required?: boolean,
    spellcheck?: boolean
}

export class TextField {
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
            spellcheck: options.spellcheck === true
        });
        wrapped.required = options.required === true;
        wrapped.addEventListener('input', options.oninput!!)
        this.element.append(wrapped, createElement({
            tag: "span",
            classes: ["helper"],
            text: options.placeholder
        }));
        options?.parent?.appendChild(this.element)
    }
}