import { ipcMain } from "electron";
import { Parcourstats } from "index";

export class IPC {

    private readonly parcourstats: Parcourstats;

    constructor(parcourstats: Parcourstats) {
        this.parcourstats = parcourstats;
        this.init();
    }

    private init(): void {
        ipcMain.on("minimizeApp", () => this.parcourstats.window.minimize());
        ipcMain.on("maximizeApp", () => this.parcourstats.window.isMaximized() ? this.parcourstats.window.unmaximize() : this.parcourstats.window.maximize());
        ipcMain.on("exitApp", () => this.parcourstats.window.close());
        ipcMain.on("localeString", (event, id) => {
            event.returnValue = this.getLocaleString(id);
        });
    }

    protected getLocaleString(id: string): string {
        return this.parcourstats.i18n.get(id);
    }

}