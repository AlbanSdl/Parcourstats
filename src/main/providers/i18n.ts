import { readFile } from "fs";
import * as path from "path";
import { IProvider } from "../../common/provider";

export class i18n implements IProvider<string> {

    public readonly lang: string;
    protected readonly translation: Map<string, string>;

    constructor(lang: string) {
        this.lang = lang;
        this.translation = new Map();
        readFile(path.join(__dirname, `../../resources/locales/${lang}`), "utf8", (err, data) => {
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