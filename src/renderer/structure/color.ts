export class Color {

    private mRG: number;
    private mBA: number;

    constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 255) {
        this.mRG = r % 256 | (g % 256) << 8;
        this.mBA = b % 256 | (a % 256) << 8;
    }

    public get red(): number {
        return this.mRG % (1 << 8)
    }

    public set red(value: number) {
        this.mRG = this.mRG & ~255 | 255 & value;
    }

    public get green(): number {
        return (this.mRG >>> 8) % (1 << 8)
    }

    public set green(value: number) {
        this.mRG = this.mRG & ~65280 | 65280 & value << 8;
    }

    public get blue(): number {
        return this.mBA % (1 << 8)
    }

    public set blue(value: number) {
        this.mBA = this.mBA & ~255 | 255 & value;
    }

    public get alpha(): number {
        return (this.mBA >>> 8) % (1 << 8)
    }

    public set alpha(value: number) {
        this.mBA = this.mBA & ~65280 | 65280 & value << 8;
    }

    public get colorCode(): string {
        return `${this.mRG},${this.mBA}`;
    }

    public readonly toString = (format: Color.Format = Color.HEX): string => {
        return format.format(this.red, this.green, this.blue, this.alpha);
    }
    
    static fromString(from: string): Color {
        const parsable = from || "#fff"
        for (const format in Color) {
            const r = (Color[format] as ColorFormat)?.parse?.(parsable);
            if (!!r) return r;
        }
        return null;
    }

    static fromBackgroundColorStyleAttribute(style?: string): Color | null {
        const r = /background-color:\s*([\S]*?)\s*(;|$)/gumi
        let result: string = null;
        while (true) {
            const t = r.exec(style);
            if (!t) break;
            result = t[1];
        }
        return !!result ? this.fromString(result) : null;
    }

}

interface ColorFormat {
    format(r: number, g: number, b: number, a: number): string
    parse(src: string): Color | null
}

export namespace Color {
    export type Format = ColorFormat;
    export const HEX: Format = {
        format(r: number, g: number, b: number, a: number): string {
            const shortenable = !(r % 17 || g % 17 || b % 17 || a !== 255 && a % 17);
            const format = (value: number) => (value < 16 ? "0" : "").concat(value.toString(16)).slice(+shortenable)
            return `#${format(r)}${format(g)}${format(b)}${a != 255 ? format(a) : ""}`
        },
        parse(src: string): Color | null {
            const r = src.match(/^#([a-f0-9]{1,2}?)(?=[a-f0-9]{2,3}$|[a-f0-9]{4}$|[a-f0-9]{6}$)([a-f0-9]{1,2}?)(?=[a-f0-9]{1,2}$|[a-f0-9]{4}$)([a-f0-9]{1,2}?)(?=[a-f0-9]{0,2}$)(?<=#[a-f0-9]{3}|#[a-f0-9]{6})([a-f0-9]{0,2}?)$/i)
            if (!r) return null;
            const intParser = (v: string) => Number.parseInt(v.length < 2 ? (v.length < 1 ? v = "f" : v) + v : v, 16)
            return new Color(intParser(r[1]), intParser(r[2]), intParser(r[3]), intParser(r[4]))
        }
    }
    export const RGB: Format = {
        format(r: number, g: number, b: number, a: number): string {
            return `rgb${a < 255 ? "a" : ""}(${r}, ${g}, ${b}${a < 255 ? `, ${a / 255}` : ""})`
        },
        parse(src: string): Color | null {
            const r = src.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d(?:\.\d+)?)\s*)?\)$/i)
            if (!r) return null;
            return new Color(Number.parseInt(r[1]), Number.parseInt(r[2]), Number.parseInt(r[3]), (r.length > 3 ? Number.parseFloat(r[4]) : 1) * 255);
        }
    }
}