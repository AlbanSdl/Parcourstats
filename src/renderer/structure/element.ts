import { Ripple } from "components/ripple";
import { Link } from "components/link";

export interface ElementProperties {
    /** The tag name of the element to create. Default is `div` */
    tag?: string;
    /** Whether the element to create is a svg element. Default is `false` */
    svg?: boolean;
    /** The id of the element to create. Default is `null` */
    id?: string;
    /** A list containing all classes to set to the element. Default is `[]` */
    classes?: string[];
    /** Whether a ripple should be added on the element. Default is `false` */
    ripple?: boolean;
    /** A link that should be bound on the element. Default is `null` */
    link?: string;
    /** Inserts text in a new child node. The text is not parsed */
    text?: string | Promise<string>;
    /** Attribute to set on the created element */
    [attribute: string]: unknown | Promise<unknown>;
}

export function createElement<K extends keyof SVGElementTagNameMap>(options: ElementProperties & {svg: true, tag: K}): SVGElementTagNameMap[K];
export function createElement(options: ElementProperties & {svg: true, tag: string}): SVGElement;
export function createElement(options: ElementProperties & {svg: true}): SVGSVGElement;
export function createElement<K extends keyof HTMLElementTagNameMap>(options: ElementProperties & {tag: K}): HTMLElementTagNameMap[K];
export function createElement(options: ElementProperties & {tag: string}): HTMLElement;
export function createElement(options?: ElementProperties): HTMLDivElement;
export function createElement(options: ElementProperties = {}): Element {
    const element = options?.svg ? 
        document.createElementNS('http://www.w3.org/2000/svg', options?.tag ?? 'svg') 
        : document.createElement(options?.tag ?? 'div');
    if (!!options?.id) element.id = options.id;
    if (!!options?.classes?.length) element.classList.add(...(options.classes!!));
    if (options?.ripple) Ripple.apply(element);
    if (!!options?.link && element instanceof HTMLElement) Link.bind(element);
    for (const key in options) {
        if (["tag", "svg", "id", "classes", "ripple", "link"].includes(key)) continue;
        if (key === 'text') {
            const textElement = createElement({
                classes: ["text"]
            });
            element.appendChild(textElement);
            Object.defineProperty(element, "textContent", {
                set: function (this: HTMLElement, content: string) {
                    const textElement = this.querySelector('.text');
                    if (!!textElement) textElement.textContent = content;
                    else this.innerText = content;
                },
                get: function (this: HTMLElement) {
                    return this.querySelector('.text')?.textContent ?? this.innerText;
                }
            })
            if (options.text instanceof Promise) {
                textElement.classList.add("lazy");
                options.text.then(text => textElement.textContent = text);
            }
            else textElement.textContent = options.text;
        }
        else if (key === 'style')
            Object.assign(element.style, options[key])
        else if (options[key] instanceof Promise) (options[key] as Promise<unknown>).then((value: string) => {
            element.setAttribute(key, typeof value === "string" ? value.replaceAll(/\s+/g, " ") : value);
        })
        else element.setAttribute(key, typeof options[key] === "string" ? 
            (options[key] as string).replaceAll(/\s+/g, " ") : options[key] as any);
    }
    return element;
}