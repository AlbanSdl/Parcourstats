import { app, BrowserWindow } from "electron";
import { join } from "path";
import { i18n } from "./providers/i18n";
import { Ipc } from "./ipc";
import { Settings } from "./providers/settings";
import { BridgedRequestType, ProcessBridge } from "../common/window";

app.setAppUserModelId("fr.asdl.parcourstats");

export class ParcourStats {

    private readonly ipc: ProcessBridge = new Ipc(this);
    private readonly settings = new Settings();
    private readonly i18n = new i18n(<string> this.settings.get("client.lang", "en"));
    public window: BrowserWindow = null;

    constructor() {
        this.ipc.on(BridgedRequestType.APP_LIFECYCLE_EXIT, () => this.window.close())
        this.ipc.on(BridgedRequestType.APP_LIFECYCLE_MAXIMIZE, () => this.window.isMaximized() ? this.window.unmaximize() : this.window.maximize())
        this.ipc.on(BridgedRequestType.APP_LIFECYCLE_MINIMIZE, () => this.window.minimize())
        this.ipc.on(BridgedRequestType.GET_LOCALE, key => this.i18n.get(key))
    }

    public init(): void {
        this.window = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                preload: join(__dirname, 'preload.js'),
                defaultEncoding: 'utf-8',
                disableDialogs: true
            },
            show: false,
            frame: false
        });
        if (this.settings.get("client.maximized", true)) this.window.maximize();
        else this.window.show();
        this.window.menuBarVisible = false;
        this.window.loadFile(join(__dirname, '../renderer/index.html'));
        this.window.on("closed", () => {
            this.window = null
        })
        this.window.on('maximize', () => {
            this.window.webContents.send("lifecycle", "maximized");
            this.settings.set("client.maximized", true);
        })
        this.window.on('unmaximize', () => {
            this.window.webContents.send("lifecycle", "unmaximized");
            this.settings.set("client.maximized", false);
        })
    }

}

const parcourstats = new ParcourStats();

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})
app.on('activate', () => {
    if (parcourstats.window === null) parcourstats.init();
})

app.whenReady().then(() => parcourstats.init());