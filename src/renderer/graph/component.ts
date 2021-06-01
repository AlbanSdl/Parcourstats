export abstract class Component<T extends Element> {
    public abstract readonly element: T

    public setId(id: string): this {
        this.element.id = id
        return this
    }

    public addClass(...classes: string[]): this {
        this.element.classList.add(...classes)
        return this
    }

}