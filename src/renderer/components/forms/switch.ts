import { createElement } from "structure/element";

interface SwitchOptions {
    disabled?: boolean,
    id?: string,
    oninput: (this: HTMLInputElement, ev: InputEvent & {
        target: HTMLInputElement;
    }) => void,
    parent?: Element,
    label: string | Promise<string>,
    value?: boolean,
    required?: boolean
}

export class Switch {
    private readonly element: HTMLDivElement = createElement({
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
            classes: ["helper"],
            text: options.label
        })
        wrapped.addEventListener('input', options.oninput!!)
        this.element.append(wrapper, helper);
        options?.parent?.appendChild(this.element)
    }

    public get status() {
        return !!(this.element.querySelector("label > input.switch[type=checkbox]") as HTMLInputElement)?.checked
    }

    public set status(activated: boolean) {
        const input = this.element.querySelector("label > input.switch[type=checkbox]") as HTMLInputElement;
        if (!!input) input!.checked = activated;
        input?.dispatchEvent(new Event("input"));
    }
}