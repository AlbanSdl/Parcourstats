import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { i18n } from "./providers/i18n";
import { Ipc } from "./ipc";
import { Settings } from "./providers/settings";
import { DataProvider } from "./providers/data";
import { Locale, Query, Recipient } from "../common/window";

app.setAppUserModelId("fr.asdl.parcourstats");

export class ParcourStats {

    private readonly ipc: Recipient<"back"> = new Ipc(this);
    private readonly settings = new Settings();
    private readonly i18n = new i18n(this.settings.get<"fr" | "en">("client.lang", "fr"));
    public window: BrowserWindow = null;
    private database: DataProvider;

    constructor() {
        this.ipc.on(Query.WINDOW_EXIT, async () => this.window.close())
        this.ipc.on(Query.WINDOW_MAXIMIZE, async () => {
            if (this.window.isMaximized()) {
                this.window.unmaximize();
                return false;
            }
            this.window.maximize();
            return true;
        })
        this.ipc.on(Query.WINDOW_MINIMIZE, async () => this.window.minimize())
        this.ipc.on(Query.LOCALIZE, async key => this.i18n.get(key))
        this.ipc.on(Query.OPEN_EXTERNAL, async link => shell.openExternal(link))
        this.ipc.on(Query.SETTINGS_GET, async () => {
            return {
                lang: this.settings.get<Locale>("client.lang", "fr"),
                filter: this.settings.get("client.filter", false),
                session_bounds: [
                    new Date(this.settings.get("client.sessions_start", Date.now())),
                    new Date(this.settings.get("client.sessions_end", Date.now()))
                ] as [Date, Date],
                theme: this.settings.get("client.theme", false)
            }
        })
        this.ipc.on(Query.SETTINGS_SET, async (key, value, extra?) => {
            switch (key) {
                case "lang":
                    const locale = value;
                    if (locale === "fr" || locale === "en")
                        await this.i18n.setLocale(locale)
                    else throw "Invalid locale"
                case "theme":
                case "filter":
                    this.settings.set(`client.${key}`, value)
                    return;
                case "session_bounds":
                    this.settings.set(`client.${key}`, [value as Date, extra].map(bound => bound.getTime()))
                    return;
                default:
                    throw "Invalid configuration key";
            }
        })
    }

    public async init() {
        this.database = new DataProvider(this.ipc);
        await this.database.createTables();
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
            this.ipc.send(Query.WINDOW_MAXIMIZE, true);
            this.settings.set("client.maximized", true);
        })
        this.window.on('unmaximize', () => {
            this.ipc.send(Query.WINDOW_MAXIMIZE, false);
            this.settings.set("client.maximized", false);
        })
    }

    public async onClose() {
        await this.database?.close();
        delete this.database;
    }

}

const parcourstats = new ParcourStats();

app.on('window-all-closed', async () => {
    await parcourstats.onClose();
    if (process.platform !== 'darwin') app.quit();
})
app.on('activate', () => {
    if (parcourstats.window === null) parcourstats.init();
})

app.whenReady().then(() => parcourstats.init());