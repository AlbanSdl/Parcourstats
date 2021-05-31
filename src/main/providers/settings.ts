import { app } from "electron";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export class Settings {

    private readonly dataFolder = join(app.getPath("userData"), "../", "Parcourstats");
    private readonly settingsPath: string;
    private readonly data: object;

    constructor() {
        this.settingsPath = join(this.dataFolder, "config.json");
        try {
            this.data = JSON.parse(readFileSync(this.settingsPath, 'utf8'));
        } catch (error) {
            this.data = {};
        }
    }

    private save(): void {
        mkdirSync(this.dataFolder, { recursive: true })
        writeFileSync(this.settingsPath, JSON.stringify(this.data, null, 4));
    }

    public get<T>(key: string, fallback: T = null): T {
        let val = this.data;
        for (const part of key.split(".")) {
            if (val == null)
                break;
            val = (<any>val)[part];
        }
        return (val === null || val === undefined ? fallback : val) as T;
    }

    public set<T>(key: string, val: T): void {
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