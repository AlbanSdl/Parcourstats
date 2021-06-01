export enum TagType {
    SVG = "http://www.w3.org/2000/svg",
    HTML = "http://www.w3.org/1999/xhtml"
}

export interface ElementFactory {
    toElement(): HTMLElement
    toElement(tagType: TagType.HTML): HTMLElement
    toElement(tagType: TagType.SVG): SVGElement
    addClass(...classes: string[]): this
    setId(id: string): this
    setStyle(style: any): this
    setSmooth(animDuration: number): this
    setSmooth(): this
}

export class Factory implements ElementFactory {

    public static get(tagName = "div"): ElementFactory {
        return new Factory(tagName)
    }

    private readonly tag: string
    private readonly classes: Array<string> = []
    private id: string | null = null
    private style: any | null = null
    private animDuration: number = -1

    private constructor(tagName: string) {
        this.tag = tagName
    }

    public addClass(...classes: string[]): this {
        this.classes.push(...classes)
        return this
    }

    public setId(id: string): this {
        this.id = id
        return this
    }

    public setSmooth(animDuration: number = 0.5): this {
        this.animDuration = animDuration;
        return this;
    }

    public setStyle(style: any): this {
        this.style = style
        return this
    }

    public toElement<T extends Element>(tagType = TagType.HTML): T {
        const element = tagType === TagType.SVG ?
            document.createElementNS(tagType, this.tag) : document.createElement(this.tag)
        if (!!this.classes && this.classes.length > 0) element.classList.add(...this.classes)
        if (!!this.id) element.id = this.id
        if (!!this.style) Object.assign(element.style, this.style)
        if (this.animDuration >= 0) element.style.transition = `all ${this.animDuration}s ease`
        return <T><any>element
    }

}