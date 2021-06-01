import { Factory, TagType } from "../structure/factory"

export enum AnimationType {
    FILL_LINEAR = 0b001,
    DRAW_STROKE = 0b010
}
/**
 * SVG Path animator
 */
export class Drawable {

    private element: SVGPathElement
    public readonly path: ReadonlyArray<Path>

    /**
     * Instantiates the Drawable and parses its path (d attribute).
     * Will remove the path from the drawable until animation starts.
     * All svg paths are not supported: A,Q,S,T are not fully supported !
     * @param {SVGPathElement} pathElement the path of the Drawable.
     */
    constructor(pathElement : SVGPathElement) {
        if (pathElement instanceof SVGPathElement)
            this.element = pathElement
        if (!this.element) throw new DrawableError("Cannot instantiate Drawable on non path reference.")
        const attr = this.element.getAttribute("d")
        this.element.removeAttribute("d")
        const path = []
        const regex = /[A-Z][^A-Z]*/gumi
        var current: string | null
        while ((current = (regex.exec(attr))?.[0]) != null) {
            const type = new PathType(current.charAt(0))
            const points = current.split(/[A-Z]?[,\s]/gumi).filter((e: string) => !!e)
            for (var i = 0; (i + 1) * type.length <= points.length; i++)
                path.push(new Path(type, points.slice(i * type.length, (i + 1) * type.length), this))
        }
        this.path = path
    }

    /**
     * Animates a Drawable.
     * @param {AnimationType} animation the type of animation to perform.
     * @param {number} duration the duration of the animation in milliseconds
     */
    animate(animation: AnimationType, duration: number) {
        const getPathFromIndex = (chosenIndex: number, activate: boolean): string => {
            return this.path.map((currentPath, index) => {
                if (chosenIndex >= index || this.path.length - chosenIndex < index)
                    return chosenIndex != index || !activate ? currentPath.toSVGPath() : currentPath.toSVGPath(this.path[index - 1])
                else return this.path[chosenIndex].toSVGPath(new FakePath(this))
            }).join(" ")
        }

        if (animation & AnimationType.FILL_LINEAR) {
            this.element.classList.add('drawn-acc-fill');
            this.element.style.transitionProperty = "fill"
            const anim = Factory.get("animate").toElement(TagType.SVG)
            anim.setAttribute("attributeType", "XML")
            anim.setAttribute("attributeName", "d")
            anim.setAttribute("repeatCount", "1")
            anim.setAttribute("fill", "freeze")
            anim.setAttribute("to", getPathFromIndex(0, false))
            anim.setAttribute("dur", `${2 * duration / this.path.length / 1000}s`)
            this.element.appendChild(anim)
            var indexCount = 1
            const intervalId = window.setInterval(() => {
                if (indexCount > this.path.length / 2) clearInterval(intervalId)
                ;(anim as any).endElement()
                anim.setAttribute("from", getPathFromIndex(indexCount - 1, true))
                anim.setAttribute("to", getPathFromIndex(indexCount++, false))
                ;(anim as any).beginElement()
            }, 2 * duration / this.path.length, 0)                    
        }

        if (animation & AnimationType.DRAW_STROKE) {
            this.element.classList.add('drawn-acc-stroke');
            let temp: string
            while (true) {
                temp = (Math.random() * 1000).toString()
                if (!document.getElementById(`drawable-clip-${temp}`)) break;
            }
            const id = temp
            temp = undefined
            this.element.setAttribute("d", getPathFromIndex(this.path.length, false))
            this.element.setAttribute("stroke-width", "6px")
            const length = this.element.getTotalLength()
            Object.assign(this.element.style, {
                transition: 'none',
                webKitTransition: 'none',
                strokeDasharray: `${length} ${length}`,
                strokeDashoffset: length
            })
            this.element.getBoundingClientRect();
            Object.assign(this.element.style, {
                transition: `stroke-dashoffset ${duration}ms cubic-bezier(.65,.05,.36,1)`,
                webKitTransition: `stroke-dashoffset ${duration}ms cubic-bezier(.65,.05,.36,1)`,
                strokeDashoffset: 0
            })
            const clipPath = Factory.get("clipPath").setId(`drawable-clip-${id}`).toElement(TagType.SVG)
            const clipPathContent = Factory.get("path").toElement(TagType.SVG)
            clipPathContent.setAttribute("d", this.element.getAttribute("d"))
            clipPathContent.setAttribute("clip-rule", "evenodd")
            clipPath.appendChild(clipPathContent)
            const svgGroup = Factory.get("g").toElement(TagType.SVG)
            svgGroup.setAttribute("clip-path", `url(#drawable-clip-${id})`)
            const rect = Factory.get("circle").toElement(TagType.SVG)
            this.element.classList.add('drawn-acc-fill');
            rect.setAttribute("fill-opacity", "0.6")
            rect.setAttribute("cx", "50%")
            rect.setAttribute("cy", "50%")
            rect.setAttribute("r", "0%")
            rect.setAttribute("stroke", "none")
            rect.style.transition = "all .5s ease"
            svgGroup.appendChild(rect)
            this.element.parentElement.append(clipPath, svgGroup)
            setTimeout(() => rect.setAttribute("r", "50%"), duration)
        }
    }

    /**
     * Returns the max length of the Drawable (x and y)
     * @returns {PathLocation}
     */
    getMaxSize(): PathLocation {
        return this.path.map((p) => p.getPosition())
            .reduce((prev, current) => new PathLocation(Math.max(prev.x, current.x), Math.max(prev.y, current.y)))
    }
}

class Path {

    private readonly type: PathType
    private readonly values: Array<number>
    public readonly drawable: Drawable

    constructor(type: PathType, points: Array<string>, drawable: Drawable) {
        if (!drawable) throw new DrawableError("Drawable Path must be attached to its parent.")
        if (type.length > points.length) throw new DrawableError("Missing points.")
        this.type = type
        this.values = points.map((m) => parseInt(m))
        this.drawable = drawable
    }

    toSVGPath(lastActive: Path | null = null): string {
        if (!this.values) return this.type.getSVGName()
        var vPath = this.type.getSVGName()
        for (var j = 0; j < this.values.length; j += 2) {
            var appendable = ""
            if (j != 0 && this.values.length % 2 == 0) appendable += ","
            appendable += this.values[j]
            if (j + 1 < this.values.length)
                appendable += ` ${this.values[j + 1]}`
            vPath += appendable
        }
        if (!!lastActive) {
            const direction = lastActive.getDirection(true).rev().normalize(this.drawable.getMaxSize().max() / 10)
            const previousPath = this.getPreviousPath()
            const orientation = !!previousPath ? previousPath.getPosition().addLocation(direction) : direction
            var matchCount = 0
            vPath = vPath.replace(/\d+\.?\d*/gum, (m: string) => {
                if (matchCount > (lastActive instanceof FakePath ? this.values.length - 3 : 1)) return m
                return (matchCount++ % 2 == 0 ? orientation.x : orientation.y).toString()
            })
        }
        return vPath
    }

    /**
     * Retrieves the Direction of an end of the path. The given direction is the opposite of the
     * direction that should take the next path ! Call .rev() on it to get the proper opposite direction !
     * Directions for A, Q, S, T have not been implemented and will return null !
     * @param {boolean} end whether the values should be got at the end of the path
     * @returns {PathDirection?} the chosen direction
     */
    getDirection(end: boolean): PathDirection | null {
        switch(this.type.name) {
            case SVGPathType.M:
            case SVGPathType.Z:
                return new PathDirection(0, 0)
            case SVGPathType.L:
            case SVGPathType.H:
            case SVGPathType.V:
                return this.getPosition().addLocation(this.getPreviousPath().getPosition().rev()).asDirectionCopy()
            case SVGPathType.C:
                return new PathDirection(this.values[4] - (end ? this.values[2] : this.values[0]),
                    this.values[5] - (end ? this.values[3] : this.values[1]))
        }
    }

    /**
     * Returns the position of the end of this path.
     * @returns {PathLocation}
     */
    getPosition(): PathLocation {
        const getOrAdd = (x: number, y: number) => this.type.isRelative ? 
            this.getPreviousPath().getPosition().add(x, y) :
            new PathLocation(x, y)
        switch(this.type.name) {
            case SVGPathType.Z:
                return this.getPreviousPath().getPosition()
            case SVGPathType.M:
                return new PathLocation(this.values[0], this.values[1])
            case SVGPathType.L:
            case SVGPathType.T:
                return getOrAdd(this.values[0], this.values[1])
            case SVGPathType.H:
                return getOrAdd(this.values[0], 0)
            case SVGPathType.V:
                return getOrAdd(0, this.values[0])
            case SVGPathType.C:
                return getOrAdd(this.values[4], this.values[5])
            case SVGPathType.S:
            case SVGPathType.Q:
                return getOrAdd(this.values[2], this.values[3])
            case SVGPathType.A:
                return getOrAdd(this.values[5], this.values[6])
        }
    }

    /**
     * Retrieves the path just before the current one in the drawable.
     * @returns {Path?}
     */
    getPreviousPath(): Path | null {
        const indexOf = this.drawable.path.indexOf(this)
        if (indexOf <= 0) return null
        return this.drawable.path[indexOf - 1]
    }

    /**
     * Retrieves the path just after the current one in the drawable.
     * @returns {Path?}
     */
    getNextPath(): Path | null {
        const indexOf = this.drawable.path.indexOf(this)
        if (indexOf < 0 || indexOf >= this.drawable.path.length - 1) return null
        return this.drawable.path[indexOf + 1]
    }
}

class FakePath extends Path {
    constructor(drawable: Drawable) {
        super(new PathType("Z"), [], drawable)
    }
}

class PathLocation {

    public x: number
    public y: number

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    asDirectionCopy(): PathDirection {
        return new PathDirection(this.x, this.y)
    }

    add(x: number, y: number): this {
        this.x += x
        this.y += y
        return this
    }

    addLocation(location: PathLocation): this {
        this.x += location.x
        this.y += location.y
        return this
    }

    rev(): this {
        this.x *= -1
        this.y *= -1
        return this
    }

    max(): number {
        return Math.max(this.x, this.y)
    }
}

class PathDirection extends PathLocation {
    constructor(x: number, y: number) {
        super(x, y)
    }
    
    normalize(nLength: number): PathDirection {
        if (!this.x) return new PathDirection(this.x, this.y * nLength)
        const yRatio = this.y / this.x
        const x = Math.sqrt(nLength / (1 + yRatio * yRatio))
        return new PathDirection(x, x * yRatio)
    }
}
enum SVGPathType {
    Z = 'Z',
    V = 'V',
    H = 'H',
    L = 'L',
    T = 'T',
    M = 'M',
    Q = 'Q',
    S = 'S',
    C = 'C',
    A = 'A'
}
class PathType {
    public readonly length: number
    public readonly name: SVGPathType
    public readonly isRelative: boolean
    public constructor(name: string) {
        this.name = SVGPathType[name.toUpperCase()]
        switch(this.name) {
            case SVGPathType.Z:
                this.length = 0; break
            case SVGPathType.V:
            case SVGPathType.H:
                this.length = 1; break
            case SVGPathType.L:
            case SVGPathType.T:
            case SVGPathType.M:
                this.length = 2; break
            case SVGPathType.Q:
            case SVGPathType.S:
                this.length = 4; break
            case SVGPathType.C:
                this.length = 6; break
            case SVGPathType.A:
                this.length = 7; break
            default:
                throw new DrawableError(`Cannot parse path type ${name}`)
        }
        this.isRelative = name.toUpperCase() != name
    }
    public getSVGName(): string {
        return this.isRelative ? this.name.toLowerCase() : this.name
    }
}
class DrawableError extends Error {
    name = "DrawableError"
}