import { Selector } from "components/selector";
import { createElement } from "structure/element";

interface DropdownOptions<T> {
    disabled?: boolean,
    id?: string,
    onSelect: (value: T) => void,
    parent?: Element,
    label: string | Promise<string>,
    tabIndex?: number,
    values: {
        [key: string]: T;
    }
}

const expandedAttribute = "expanded";
const disabledAttribute = "disabled";

export class Dropdown<T> {
    private readonly element!: HTMLDivElement;
    readonly #values!: {
        [key: string]: T;
    };
    readonly #onSelect!: (value: T) => void;
    readonly #selector!: Selector<T>;
    #a11yCursor: number = 0;

    constructor(options: DropdownOptions<T>) {
        this.#values = {};
        this.#onSelect = options.onSelect;
        this.element = createElement({
            classes: ["wrapper", "dropdown"],
            text: options.label
        });
        const wrapper = createElement({
            classes: ["list", "wrapper"],
            tabindex: options.tabIndex ?? 0
        })
        wrapper.addEventListener('focusout', () => {
            for (const child of this.#selector.childrenElements)
                child.toggleAttribute("a11y-focus", false);
        })
        wrapper.addEventListener('keydown', event => {
            if (!this.isEnabled) return;
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
                    if (!this.isExpanded) return;
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
        this.isEnabled = options?.disabled !== true;
        this.#selector = new Selector({
            container: list,
            extractor: e => this.#values[e.getAttribute("of")],
            isUnique: true,
            neverEmpty: true,
            listener: (triggers: boolean, value: T) => {
                if (!triggers) return;
                if (this.isExpanded && this.isEnabled)
                    this.#onSelect(value);
                this.#a11yCursor = this.#selector.children.indexOf(value);
                if (this.isEnabled) this.isExpanded = !this.isExpanded;
            }
        })
        for (const name in options.values)
            this.setEntry(name, options.values[name], false);
    }

    private get isExpanded() {
        return this.list?.hasAttribute(expandedAttribute);
    }

    private set isExpanded(expanded: boolean) {
        this.list?.toggleAttribute(expandedAttribute, expanded);
    }

    private get list(): HTMLElement | null {
        return this.element.querySelector(".list.wrapper > .list");
    }

    public setEntry(label: string, value?: T, trigger: boolean = true) {
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
            }), trigger)
        }
    }

    public get isEnabled() {
        return this.list?.hasAttribute(disabledAttribute) === false;
    }

    public set isEnabled(value: boolean) {
        this.list?.toggleAttribute(disabledAttribute, !value);
    }

    public select(value: T, trigger: boolean = true) {
        if (this.#selector.selection.includes(value)) return;
        this.#selector.select(value, trigger);
        this.#a11yCursor = this.#selector.children.indexOf(value);
    }
}