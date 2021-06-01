import { Factory } from "../structure/factory";

export enum Position {
    TOP = 0b001,
    BOTTOM = 0b011,
    LEFT = 0b100,
    RIGHT = 0b110
}

export class Tooltip {

    private position: Position;
    private instance: HTMLDivElement | null;
    private labelConstructing: string;
    private maxSize: number;
    private displayed: boolean = false;
    private requiredVisible: boolean = false;
    private attachedOn: HTMLElement | SVGElement;
    public hide: boolean = false;

    private enterListener = () => this.onMouseEnter()
    private leaveListener = () => this.onMouseLeave()

    /**
     * Creates a tooltip
     * @param label the content of the tooltip
     * @param useOn the element to display the tooltip for
     * @param position the position of the tooltip
     * @param maxSize the max size of the tooltip (1 is the size of the `useOn` element, 0 is unlimited)
     * @param theme the theme of the tooltip
     */
    constructor(label: string, useOn: HTMLElement | SVGElement, position: Position, maxSize: number = 0) {
        this.position = position;
        this.attachedOn = useOn;
        this.labelConstructing = label.length > 0 ? label[0].toUpperCase() + label.slice(1) : label
        this.maxSize = maxSize;
        this.attachedOn.addEventListener("mouseenter", this.enterListener)
        this.attachedOn.addEventListener("mouseleave", this.leaveListener)
    }

    public get label(): string {
        return this.labelConstructing;
    }

    public set label(value: string) {
        this.labelConstructing = value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
        if (!!this.instance) {
            Array.from((this.instance.children[1] as HTMLElement).children).forEach(f => f.remove());
            (this.instance.children[1] as HTMLElement).append(this.label);
        }
    }

    private buildLabel() {
        const label = Factory.get().addClass((Position[this.position] as string).toLowerCase()).setSmooth().toElement();
        label.append(this.label);
        this.instance = label as HTMLDivElement;
    }

    public remove() {
        this.attachedOn.removeEventListener("mouseenter", this.enterListener)
        this.attachedOn.removeEventListener("mouseleave", this.leaveListener)
        this.instance?.remove()
    }

    private onMouseEnter() {
        if (this.hide) return;
        if (!this.displayed) {
            document.body.append(this.instance ?? (() => {
                this.buildLabel(); return this.instance;
            })());
        }
        // Configure label position and max size
        const pos = this.attachedOn.getBoundingClientRect();
        Object.assign(this.instance!!.style, {
            left: `${pos.left + (this.position % 2 ? pos.width / 2 : ((this.position >>> 1) % 2 ? pos.width : 0))}px`,
            top: `${pos.top + ((this.position >>> 2) % 2 ? pos.height / 2 : ((this.position >>> 1) % 2 ? pos.height : 0))}px`
        })
        if (this.maxSize) this.position % 2 ?
            (this.instance.style.maxWidth = `${this.attachedOn.clientWidth * this.maxSize}px`) : 
            (this.instance.style.maxHeight = `${this.attachedOn.clientHeight * this.maxSize}px`);
        // Display label
        this.displayed = true;
        this.requiredVisible = true;
        setTimeout(() => this.instance.style.opacity = '1', 10);
    }

    private onMouseLeave() {
        if (this.displayed) {
            this.instance.style.opacity = '0';
            this.requiredVisible = false;
            setTimeout(() => {
                if (this.displayed && !this.requiredVisible) {
                    this.displayed = false;
                    this.instance.remove();
                }
            }, 500);
        }
    }

}