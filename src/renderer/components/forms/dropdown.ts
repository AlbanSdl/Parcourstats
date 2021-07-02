import { Selector } from "components/selector";
import { createElement } from "structure/element";
import { Component } from "../component";

interface DropdownOptions<T> {
    disabled?: boolean,
    id?: string,
    onSelect: (value: T) => void,
    parent?: Element,
    label: string,
    tabIndex?: number,
    values: {
        [key: string]: T;
    }
}

export class Dropdown<T> implements Component<HTMLDivElement> {
    public readonly element: HTMLDivElement = createElement({
        classes: ["wrapper", "dropdown"]
    });
    readonly #values!: {
        [key: string]: T;
    };
    readonly #onSelect!: (value: T) => void;
    #isExpanded: boolean = true;
    #a11yCursor: number = 0;
    #selector!: Selector<T>;
    #enabled!: boolean;

    constructor(options: DropdownOptions<T>) {
        this.#values = {};
        this.#onSelect = options.onSelect;
        this.element.textContent = options.label;
        const wrapper = createElement({
            classes: ["list", "wrapper"],
            tabindex: options.tabIndex ?? 0
        })
        wrapper.addEventListener('focusout', () => {
            for (const child of this.#selector.childrenElements)
                child.toggleAttribute("a11y-focus", false);
        })
        wrapper.addEventListener('keydown', event => {
            if (!this.#enabled) return;
            let cursorUpdated: number;
            switch (event.code) {
                case "Space":
                    const element = this.#selector.childrenElements
                        .item(this.#a11yCursor) as HTMLElement;
                    element.click();
                    element.toggleAttribute("a11y-focus", true);
                    break;
                case "ArrowUp":
                case "ArrowLeft":
                    cursorUpdated = this.#a11yCursor - 1;
                case "ArrowDown":
                case "ArrowRight":
                    if (!this.#isExpanded) return;
                    if (cursorUpdated === undefined)
                        cursorUpdated = this.#a11yCursor + 1;
                    const available = this.#selector.childrenElements.length;
                    if (cursorUpdated < 0 || cursorUpdated >= available)
                        cursorUpdated = available - Math.abs(cursorUpdated);
                    const target = this.#selector.childrenElements.item(cursorUpdated) as HTMLElement;
                    if (!!target) {
                        this.#selector.childrenElements.item(this.#a11yCursor)
                            ?.toggleAttribute("a11y-focus", false);
                        this.#a11yCursor = cursorUpdated;
                        target.toggleAttribute("a11y-focus", true);
                        this.list.scrollTo({
                            behavior: "smooth",
                            top: target.offsetTop,
                            left: 0
                        });
                    }
                    break;
                default:
                    return;
            }
            event.preventDefault();
        })
        const list = createElement({
            classes: ["list"]
        })
        if (!!options?.id) list.id = options?.id;
        wrapper.append(list);
        this.element.append(wrapper);
        options?.parent?.appendChild(this.element);
        this.enabled = options?.disabled !== true;
        this.#selector = new Selector({
            container: list,
            extractor: e => this.#values[e.getAttribute("of")],
            isUnique: true,
            neverEmpty: true,
            listener: (value: T) => {
                if (this.#isExpanded) {
                    this.#onSelect(value);
                    this.#a11yCursor = this.#selector.children.indexOf(value);
                }
                this.updateStatus(!this.#isExpanded)
            }
        })
        for (const name in options.values)
            this.set(name, options.values[name]);
    }

    private get list(): HTMLElement | null {
        return this.element.querySelector(".list.wrapper > .list");
    }

    private updateStatus(expanded: boolean) {
        this.#isExpanded = expanded;
        this.list?.toggleAttribute("expanded", expanded);
    }

    public set(label: string, value?: T) {
        if (value === undefined) {
            delete this.#values[label];
            this.list.querySelector(`.value[of="${label}"]`)?.remove();
            return;
        }
        this.#values[label] = value;
        if (!this.list.querySelector(`.value[of="${label}"]`)) {
            this.#selector.append(createElement({
                classes: ["value"],
                of: label,
                ripple: true
            }))
        }
    }

    public get enabled() {
        return this.#enabled;
    }

    public set enabled(value: boolean) {
        this.list?.toggleAttribute("disabled", !value);
        this.#enabled = value;
    }
}