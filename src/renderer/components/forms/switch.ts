import { createElement } from "structure/element";
import { Component } from "../component";

interface SwitchOptions {
    disabled?: boolean,
    id?: string,
    oninput: (this: HTMLInputElement, ev: InputEvent & {
        target: HTMLInputElement;
    }) => void,
    parent?: Element,
    label: string,
    value?: boolean,
    required?: boolean
}

export class Switch implements Component<HTMLDivElement> {
    public readonly element: HTMLDivElement = createElement({
        classes: ["wrapper", "switch"]
    });

    constructor(options: SwitchOptions) {
        const wrapped = createElement({
            tag: "input",
            classes: ["switch"],
            type: "checkbox",
            id: options.id
        });
        wrapped.disabled = options.disabled === true;
        wrapped.required = options.required === true;
        wrapped.checked = options.value === true;
        const wrapper = createElement({
            tag: "label"
        })
        const track = createElement({
            classes: ["track-wrapper"]
        })
        track.append(createElement({
            classes: ["track"]
        }))
        wrapper.append(wrapped, track)
        const helper = createElement({
            tag: "span",
            classes: ["helper"]
        })
        helper.textContent = options.label;
        wrapped.addEventListener('input', options.oninput!!)
        this.element.append(wrapper, helper);
        options?.parent?.appendChild(this.element)
    }
}