import { createElement } from "structure/element";
import { AnimationType, Drawable } from "./draw";
import { selectionAttribute, selectionPresentAttribute, Selector } from "./selector";

interface PointData<T> {
    readonly x: T,
    readonly y: T
}
type OpenPointData<T> = {-readonly[key in keyof PointData<T>]: PointData<T>[key]};

interface GraphReference {
    readonly element: SVGPathElement | null,
    readonly caption: HTMLDivElement,
    computeAbsCoordinates(x: number, y: number): PointData<number>,
    updateScale(changes: Map<number, number>, invalidateLayout?: boolean): void,
    detach(): void,
    attachReady(ref: EntryReference): void
}

interface EntryReference {
    updateBounds(): void,
    getId(): string
}

interface EntryDependency {
    readonly values: Map<number, number>,
    readonly id: string
}

enum GraphEntryUpdate {
    NAME   = 0b01,
    VALUES = 0b10
}

class BoundingBox {
    #min: OpenPointData<number>
    #max: OpenPointData<number>

    get min(): PointData<number> {
        return {
            ...this.#min
        }
    }

    get max(): PointData<number> {
        return {
            ...this.#max
        }
    }

    constructor(values: { [abscissa: number]: number }) {
        const keys = Object.keys(values) as any
        const vals = Object.values(values)
        this.#min = {
            x: Math.min(...keys),
            y: Math.min(...vals)
        }
        this.#max = {
            x: Math.max(...keys),
            y: Math.max(...vals)
        }
    }

    public collides(other: BoundingBox) {
        return this.#min.x <= other.#max.x && this.#max.x >= other.#min.x
            || this.#min.y <= other.#max.y && this.#max.y >= other.#min.y
    }

    public expand(...entries: [number, number][]) {
        let hasChanged = false;
        for (const entry of entries) {
            if (this.#min.x > entry[0]) {
                this.#min.x = entry[0];
                hasChanged = true;
            }
            if (this.#max.x < entry[0]) {
                this.#max.x = entry[0];
                hasChanged = true;
            }
            if (this.#min.y > entry[1]) {
                this.#min.y = entry[1];
                hasChanged = true;
            }
            if (this.#max.y < entry[1]) {
                this.#max.y = entry[1];
                hasChanged = true;
            }
        }
        return hasChanged
    }

    public equals(other: any) {
        return other instanceof BoundingBox &&
            this.#min.x === other.#min.x && this.#max.x === other.#max.x &&
            this.#min.y === other.#min.y && this.#max.y === other.#max.y
    }

    public clone() {
        return new BoundingBox({
            [this.#min.x]: this.#min.y,
            [this.#max.x]: this.#max.y
        });
    }

    public scale(x?: number, y?: number): PointData<number> {
        return {
            x: ((x || 0) - this.#min.x) / (this.#max.x - this.#min.x || 1),
            y: ((y || 0) - this.#min.y) / (this.#max.y - this.#min.y || 1)
        }
    }
}

abstract class GraphEntry {
    public readonly id!: string;
    protected abstract readonly values: Map<number, number>;
    protected readonly dependantEntries: string[] = [];
    protected reference?: GraphReference;
    #name!: string;
    #color!: string;

    constructor(name: string, id: string) {
        this.#name = name
        this.id = id;
    }

    public registerDependant(entry: ComputedGraphEntry<number>): EntryDependency {
        this.dependantEntries.push(entry.id);
        const dependency = this;
        return {
            id: this.id,
            get values() {
                return dependency.values
            }
        }
    }

    public set name(value: string) {
        this.#name = value;
        this.updateDisplay(GraphEntryUpdate.NAME)
    }

    public get name() {
        return this.#name;
    }

    public attachToGraph(ref: GraphReference, invalidateLayout = true) {
        this.reference?.detach();
        this.reference = ref;
        this.reference?.attachReady({
            updateBounds: () => this.updateDisplay(GraphEntryUpdate.VALUES),
            getId: () => {
                return this.id;
            }
        });
        this.reference?.updateScale(this.values, invalidateLayout);
        this.updateDisplay(GraphEntryUpdate.NAME | GraphEntryUpdate.VALUES, invalidateLayout);
    }

    protected updateDisplay(code: GraphEntryUpdate, animate = false) {
        if (!this.reference) return;
        const element = this.reference!!.element
        if (!element) return;
        if ((code & GraphEntryUpdate.NAME) !== 0) {
            const content = (this.reference!!.caption.querySelector('.content') as HTMLDivElement);
            if (!!content) content.textContent = this.#name;
        }
        if ((code & GraphEntryUpdate.VALUES) !== 0) {
            const values = this.values;
            let path: string = "";
            for (const abscissa of [...values.keys()].sort()) {
                const absCoords = this.reference.computeAbsCoordinates(abscissa, values.get(abscissa));
                path += `${!path?'M':'L'}${absCoords.x} ${absCoords.y}`;
            }
            element.setAttribute("d", path);
            if (animate) new Drawable(element).animate(AnimationType.ONLY_STROKE, 400)
        }
    }
}

export class DatasetGraphEntry extends GraphEntry {
    protected values: Map<number, number> = new Map();

    public add(values: Map<number, number>) {
        this.reference?.updateScale(values);
        for(const entry of values.entries())
            this.values.set(entry[0], entry[1]);
        this.updateDisplay(GraphEntryUpdate.VALUES)
    }

    public remove(...abscissas: number[]) {
        for (const abscissa of abscissas)
            this.values.delete(abscissa)
        this.updateDisplay(GraphEntryUpdate.VALUES)
    }

    public clear() {
        this.values.clear();
        this.updateDisplay(GraphEntryUpdate.VALUES);
    }
}

export class ComputedGraphEntry<T extends number> extends GraphEntry {
    #dependencies: EntryDependency[];
    #operator: (abscissa: number, ...sources: number[] & { length: T; }) => number;
    constructor(name: string, id: string, 
        operation: (abscissa: number, ...sources: number[] & { length: T; }) => number,
        ...sources: readonly GraphEntry[] & { length: T; }
    ) {
        super(name, id);
        this.#dependencies = sources.map(entry => {
            if (this.dependantEntries.includes(entry.id))
                throw new Error(`Circular Graph Entry dependency detected for #${this.id} and #${entry.id}`)
            return entry.registerDependant(this)
        });
        this.#operator = operation;
    }
    protected get values() {
        const sources = this.#dependencies.map(s => s.values);
        const commonKeys = sources.map(m => [...m.keys()])
            .reduce((from, next) => from.filter(value => next.includes(value))).sort();
        let oK: number | undefined;
        return new Map(commonKeys
            .map(k => [k, this.computeValue(this.#operator, sources, oK, oK = k)])
            .filter(e => e[1] !== undefined) as [number, number][]
        )
    }
    protected computeValue(
        op: (abscissa: number, ...sources: number[] & { length: T; }) => number,
        sources: Map<number, number>[],
        _previousAbscissa: number,
        abscissa: number
    ) {
        return op(abscissa, ...sources.map(s => s.get(abscissa)) as any) || 0;
    }
}

export class PreviousBasedComputedGraphEntry<T extends number> extends ComputedGraphEntry<T> {
    constructor(name: string, id: string, operation: (abscissa: number, ...sources: [
        ...previous: number[] & { length: T; },
        ...target: number[] & { length: T; }
    ]) => number, ...sources: readonly GraphEntry[] & { length: T; }) {
        super(name, id, operation as () => number, ...sources as any);
    }

    protected computeValue(
        op: (abscissa: number, ...sources: number[] & { length: T; }) => number,
        sources: Map<number, number>[],
        previousAbscissa: number,
        abscissa: number
    ) {
        return op(abscissa, ...sources.map(s => s.get(previousAbscissa))
            .concat(sources.map(s => s.get(abscissa))) as any) || 0;
    }
}

interface GraphOptions {
    entries?: GraphEntry[],
    paddingRatio?: number,
    getAbscissaName?: (value: number) => string;
    getOrdinateName?: (value: number) => string;
    displayLines?: boolean;
    displayYZero?: boolean;
}

interface GraphAdvancedOptions extends GraphOptions {
    xRatio?: number,
    yRatio?: number
}

export class Graph {
    public readonly padding!: number;
    public readonly xRatio!: number;
    public readonly yRatio!: number;
    private readonly entries: EntryReference[] = [];
    private readonly graph!: SVGSVGElement;
    private readonly caption!: Selector<string>;
    private readonly wrapper!: HTMLDivElement;
    private readonly displayMarkers!: boolean;
    private readonly displayYZero!: boolean;
    private readonly getAbscissaName: (value: number) => string;
    private readonly getOrdinateName: (value: number) => string;
    readonly #boundingBox: BoundingBox;

    constructor(options?: GraphOptions)
    constructor(options: GraphAdvancedOptions)
    constructor(options?: GraphAdvancedOptions) {
        this.#boundingBox = new BoundingBox({});
        this.xRatio = options?.xRatio ?? 200;
        this.yRatio = options?.yRatio ?? 100;
        this.padding = options?.paddingRatio ?? .1;
        this.displayMarkers = options?.displayLines === true;
        this.displayYZero = options?.displayYZero === true;
        this.getAbscissaName = options?.getAbscissaName ?? (v => v.toLocaleString(undefined, {
            maximumFractionDigits: 2
        }))
        this.getOrdinateName = options?.getOrdinateName ?? (v => v.toLocaleString(undefined, {
            maximumFractionDigits: 2
        }))
        this.wrapper = createElement({
            classes: ["container", "graph"]
        });
        this.graph = createElement({
            classes: ["graph"],
            svg: true,
            viewBox: `0 0 ${this.xRatio} ${this.yRatio}`
        });
        this.graph.append(
            createElement({
                classes: ["axis"],
                tag: "path",
                svg: true,
                d: this.computeAxisPath()
            })
        )
        const caption = createElement({
            classes: ["caption"]
        });
        this.caption = new Selector({
            container: caption,
            extractor: e => e?.id?.match?.(/(?<=^caption-).+$/si)?.[0],
            isUnique: true,
            listener: (_, entry) => {
                for (const caption of this.caption.children)
                    this.graph.getElementById(`path-${caption}`)
                        ?.toggleAttribute(selectionAttribute, caption === entry)
                this.graph.toggleAttribute(selectionPresentAttribute, !!entry)
            }
        });
        this.wrapper.append(this.graph, caption);
        options?.entries?.forEach(entry => this.addEntry(entry, false))
        this.invalidate();
    }

    public attach(parent: Element) {
        parent?.appendChild(this.wrapper);
        this.updateAxisSteps();
    }

    public addEntry(entry: GraphEntry, invalidateLayout = true) {
        let chart = this, id = entry.id, attached = false;
        const assertAttached = () => {
            if (!attached) throw new Error("Graph entry has no parent")
        }
        entry.attachToGraph({
            get element() {
                assertAttached();
                return chart.getEntryPath(id)
            },
            get caption() {
                assertAttached();
                return chart.getEntryCaption(id)
            },
            detach: () => {
                assertAttached();
                this.getEntryPath(id).remove();
                this.getEntryCaption(id).remove();
                this.entries.splice(this.entries.findIndex(e => e.getId() === id), 1)
                id = undefined;
                chart = undefined;
                attached = false;
            },
            updateScale: (changes: Map<number, number>, invalidateLayout = true) => {
                assertAttached();
                this.updateScale(changes, invalidateLayout)
            },
            computeAbsCoordinates: (x: number, y: number) => {
                assertAttached();
                const scaled = this.#boundingBox.scale(x, y);
                return {
                    x: this.computeLocationComponent(scaled.x, this.xRatio),
                    y: this.computeLocationComponent(1 - scaled.y, this.yRatio)
                }
            },
            attachReady: (ref: EntryReference) => {
                this.entries.push(ref);
                attached = true;
            }
        }, invalidateLayout);
    }

    private updateScale(changes: Map<number, number>, invalidateLayout = true) {
        if (changes.size > 0 && this.#boundingBox.expand(
            ...changes.entries(),
            ...(this.displayYZero ? [[changes.keys().next().value!!, 0] as [number, number]] : [])
        ) && invalidateLayout) this.invalidate()
    }

    public invalidate() {
        this.entries.forEach(e => e.updateBounds());
        if (!!this.wrapper.parentElement) this.updateAxisSteps();
    }

    private computeLocationComponent(value: number, ratio: number, outerPaddingMultiplier: number = 1) {
        return ratio * (value * (1 - 2 * this.padding) + outerPaddingMultiplier * this.padding)
    }

    private updateAxisSteps() {
        const elements = this.graph.getElementsByClassName("marker");
        while (elements.length > 0) elements.item(0).remove();
        const min = this.#boundingBox.min, max = this.#boundingBox.max;
        this.generateAxisSteps(min, max, true);
        this.generateAxisSteps(min, max, false);
    }

    private generateAxisSteps(min: PointData<number>, max: PointData<number>, isX: boolean) {
        for (const step of this.stepBetween(isX ? min.x : min.y, isX ? max.x : max.y)) {
            const scaled = this.#boundingBox.scale(isX ? step : min.x, isX ? min.y : step);
            const marker = createElement({
                svg: true,
                tag: "text",
                classes: ["marker"],
                x: this.computeLocationComponent(scaled.x, this.xRatio, isX ? 1 : .9),
                y: this.computeLocationComponent(1 - scaled.y, this.yRatio, isX ? 1.5 : 1),
                style: {
                    [isX ? "max-height" : "max-width"]: `${this.padding * 90}%`
                }
            })
            marker.textContent = isX ? this.getAbscissaName(step) : this.getOrdinateName(step);
            this.graph.append(marker);
            const bcr = marker.getBBox();
            marker.setAttribute("x", Math.round(bcr.x - bcr.width / (isX ? 2 : 1)).toString());
            if (!isX) marker.setAttribute("y", Math.round(bcr.y + bcr.height).toString());
            if (this.displayMarkers) {
                const x = this.computeLocationComponent(scaled.x, this.xRatio),
                    y = this.computeLocationComponent(1 - scaled.y, this.yRatio),
                    to = isX ? this.padding * this.yRatio : (1 - this.padding) * this.xRatio;
                this.graph.prepend(createElement({
                    svg: true,
                    tag: "path",
                    classes: ["marker"],
                    d: `m${x} ${y}${isX ? 'V' : 'H'}${to}`
                }))
            }
        }
    }

    private getEntryPath(id: string) {
        const current = this.graph.getElementById(`path-${id}`) as SVGPathElement;
        if (!!current) return current;
        const created = createElement({
            classes: ["graph-data"],
            id: `path-${id}`,
            svg: true,
            tag: "path"
        })
        this.graph.prepend(created);
        return created;
    }

    private getEntryCaption(id: string) {
        let current: HTMLDivElement;
        for (const child of this.caption.childrenElements)
            if (child.id === `caption-${id}`)
                current = child as HTMLDivElement;
        if (!!current) return current;
        const created = createElement({
            id: `caption-${id}`,
            ripple: true
        })
        created.append(createElement({
            classes: ["marker"]
        }), createElement({
            classes: ["content"]
        }))
        this.caption.append(created);
        return created;
    }

    private computeAxisPath() {
        const arrowSize = Math.min(this.xRatio, this.yRatio) * this.padding / 4;
        return `m${this.xRatio * this.padding} ${this.yRatio * this.padding}
                    l${arrowSize * .3} ${arrowSize}
                    h${-arrowSize * .3}
                    v${this.yRatio * (1 - this.padding * 2) - arrowSize}
                    h${this.xRatio * (1 - this.padding * 2) - arrowSize}
                    v${-arrowSize * .3}
                    l${arrowSize} ${arrowSize * .3}
                    ${-arrowSize} ${arrowSize * .3}
                    v${-arrowSize * .3}
                    h${-this.xRatio * (1 - this.padding * 2) + arrowSize}
                    v${-this.yRatio * (1 - this.padding * 2) + arrowSize}
                    h${-arrowSize * .3}
                    z`;
    }

    private *stepBetween(min: number, max: number) {
        if (min === max || !isFinite(min) || !isFinite(max)) return;
        const logdiff = Math.log10(max - min || 1), step = Math.pow(10, Math.floor(logdiff)),
            stepDiff = step / Math.max(1, Math.trunc(step / (max - min) * 5)),
            round = Math.pow(10, Math.log10(min || 1) - logdiff);
        for (let mutating = min / round * round; mutating <= max; mutating += stepDiff)
            if (mutating >= min) yield mutating;
    }
}