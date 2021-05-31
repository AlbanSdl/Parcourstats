import { app, BrowserWindow } from "electron";
import { i18n } from "./app/i18n";
import { IPC } from "./app/Ipc";
import { Settings } from "./app/settings";

app.setAppUserModelId("fr.asdl.parcourstats");

export class Parcourstats {

    public readonly i18n: i18n;
    public window: BrowserWindow;
    public readonly settings: Settings;

    constructor() {
        this.settings = new Settings();
        this.i18n = new i18n(<string> this.settings.get("editor.lang", "en"));
        this.window = null;
    }

    public init(): void {
        this.window = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            show: false,
            frame: false
        });
        if (this.settings.get("editor.maximized", true))
            this.window.maximize();
        else
            this.window.show();
        this.window.menuBarVisible = false;
        this.window.loadFile('./view/index.html');
        this.window.on("closed", () => {this.window = null});
        new IPC(this);

        this.window.on('maximize', () => {
            this.window.webContents.send("lifecycle", "maximized");
            this.settings.set("editor.maximized", true);
        })
        this.window.on('unmaximize', () => {
            this.window.webContents.send("lifecycle", "unmaximized");
            this.settings.set("editor.maximized", false);
        })
    }

}

const parcourstats = new Parcourstats();

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
});
app.on('activate', () => {
    if (parcourstats.window === null) parcourstats.init()
});

app.whenReady().then(() => parcourstats.init());