import { readFile } from "fs";
import * as path from "path";
import { IProvider } from "../../common/provider";

type Locale = "en" | "fr";
export class i18n implements IProvider<string> {

    private _lang: Locale;
    protected readonly translation: Map<string, string>;

    constructor(lang: Locale) {
        this.translation = new Map();
        this.lang = lang;
    }

    public get lang() {
        return this._lang;
    }

    public set lang(value) {
        this._lang = value;
        this.load();
    }

    private load() {
        this.translation.clear();
        readFile(path.join(__dirname, `../../resources/locales/${this._lang}`), "utf8", (err, data) => {
            if (!err) {
                data.split("\n").forEach(str => {
                    const sp = str.split(/\s/);
                    if (sp.length > 1)
                        this.translation.set(sp[0], sp.slice(1, sp.length).filter((l) => l.length > 0).join(" "));
                })
            }
        });
    }

    public get(id: string): string {
        const translation = this.translation.get(id);
        return translation ?? id;
    }

}