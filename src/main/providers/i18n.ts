import { readFile } from "fs/promises";
import * as path from "path";
import { IProvider } from "../../common/provider";
import { Locale } from "../../common/window";

export class i18n implements IProvider<string> {

    readonly #translation: Map<string, string> = new Map();
    #lang: Locale;

    public get lang() {
        return this.#lang;
    }

    public async setLocale(value: Locale) {
        if (this.#lang === value) return;
        return this.load(value).then(() => {
            this.#lang = value;
        });
    }

    private async load(locale: Locale) {
        return readFile(path.join(__dirname, `../../resources/locales/${locale}`), "utf8").then(data => {
            this.#translation.clear();
            for (const str of data.split("\n")) {
                const sp = str.split(/\s/);
                if (sp.length > 1) this.#translation.set(sp[0], sp.slice(1, sp.length)
                    .filter((l) => l.length > 0).join(" "));
            }
        })
    }

    public get(id: string): string {
        const translation = this.#translation.get(id);
        return translation ?? id;
    }

}