import { app } from "electron";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export class Settings {

    private readonly settingsPath: string;
    private readonly data: object;

    constructor() {
        this.settingsPath = join(app.getPath("userData"), "../", "backyard", "config.json");
        this.data = this.parse();
    }

    private parse(): object {
        try {
            return JSON.parse(readFileSync(this.settingsPath, 'utf8'));
        } catch (error) {
            return {};
        }
    }

    private save(): void {
        writeFileSync(this.settingsPath, JSON.stringify(this.data, null, 4));
    }

    public get(key: string, fallback: string | object | number | boolean = null): string | object | number | boolean {
        let val = this.data;
        for (const part of key.split(".")) {
            if (val == null)
                break;
            val = (<any>val)[part];
        }
        return val == null ? fallback : val;
    }

    public set(key: string, val: string | object | number | boolean): void {
        let temp = this.data;
        const keys = key.split(".");
        const last = keys.pop();
        for (let part of keys) {
            let temp_2 = (<any>temp)[part];
            if (temp_2 == null)
                (<any>temp)[part] = (temp_2 = {});
            temp = temp_2;
        }
        (<any>temp)[last] = val;
        this.save();
    }

    public delete(key: string): void {
        let temp = this.data;
        const keys = key.split(".");
        const last = keys.pop();
        for (let part of keys) {
            let temp_2 = (<any>temp)[part];
            if (temp_2 == null)
                (<any>temp)[part] = (temp_2 = {});
            temp = temp_2;
        }
        delete (<any>temp)[last];
        this.save();
    }

}