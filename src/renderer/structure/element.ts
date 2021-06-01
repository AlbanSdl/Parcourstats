import { Ripple } from "graph/ripple";

export class ElementProperties {
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
}

export function createElement<T extends ElementProperties, K extends keyof SVGElementTagNameMap>(options: T & {svg: true, tag: K}): SVGElementTagNameMap[K];
export function createElement<T extends ElementProperties>(options: T & {svg: true, tag: string}): SVGElement;
export function createElement<T extends ElementProperties>(options: T & {svg: true}): SVGSVGElement;
export function createElement<T extends ElementProperties, K extends keyof HTMLElementTagNameMap>(options: T & {tag: K}): HTMLElementTagNameMap[K];
export function createElement<T extends ElementProperties>(options: T & {tag: string}): HTMLElement;
export function createElement<T extends ElementProperties>(options?: T): HTMLDivElement;
export function createElement(options: ElementProperties = {}): Element {
    const element = options?.svg ? 
        document.createElementNS('http://www.w3.org/2000/svg', options?.tag ?? 'svg') 
        : document.createElement(options?.tag ?? 'div');
    if (!!options?.id) element.id = options.id;
    element.classList.add(...(options?.classes ?? []));
    if (options?.ripple) Ripple.apply(element);
    if (!!options?.link && element instanceof HTMLElement) Link.bind(element);
    for (const key in options) if (!(key in ElementProperties)) element.setAttribute(key, options[key]);
    return element;
}