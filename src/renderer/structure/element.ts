import { Ripple } from "components/ripple";
import { LINK, Link, LinkHandler, URI } from "components/link";
import { scheduler } from "scheduler";

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
    link?: {
        target: string,
        handler?: LinkHandler<unknown>
    };
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
    if (!!options?.link?.target && element instanceof HTMLElement) Link.bind(element, options.link.handler ?? LINK, options.link.target);
    for (const key in options) {
        if (["tag", "svg", "id", "classes", "ripple", "link"].includes(key)) continue;
        if (key === 'text') {
            const textElement = createElement({
                classes: ["text"]
            });
            const setter = (content: string) => {
                if (content === null || content === undefined) content = "";
                else if (typeof content !== "string") content = `${content}`;
                const matches = content.matchAll(/\[(.*?)(?<!\\)\]\((https?:\/\/\S*?)\)/ugi);
                const elements: Array<Element | string> = [];
                let startIndex = 0;
                let match: RegExpMatchArray;
                while (match = matches.next().value) {
                    elements.push(content.substring(startIndex, match.index))
                    elements.push(createElement({
                        link: {
                            target: match[2]
                        },
                        text: match[1],
                        ripple: true
                    }))
                    startIndex = match.index + match[0].length
                }
                elements.push(content.substring(startIndex))
                textElement.append(...elements);
            }
            element.appendChild(textElement);
            Object.defineProperty(element, "textContent", {
                set: function (this: HTMLElement, content: string) {
                    this.innerHTML = "";
                    setter(content);
                },
                get: function (this: HTMLElement) {
                    return this.querySelector('.text')?.textContent ?? this.innerText;
                }
            })
            if (options.text instanceof Promise) {
                textElement.classList.add("lazy");
                options.text.then(async text => {
                    await scheduler.schedule();
                    setter(text);
                });
            }
            else setter(options.text)
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