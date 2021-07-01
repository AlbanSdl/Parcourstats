import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { i18n } from "./providers/i18n";
import { Ipc } from "./ipc";
import { Settings } from "./providers/settings";
import { BackendRequest, ClientRequest, ClientSyncRequest, ProcessBridge } from "../common/window";
import { DataProvider } from "./providers/data";

app.setAppUserModelId("fr.asdl.parcourstats");

export class ParcourStats {

    private readonly ipc: ProcessBridge = new Ipc(this);
    private readonly settings = new Settings();
    private readonly i18n = new i18n(this.settings.get<"fr" | "en">("client.lang", "fr"));
    public window: BrowserWindow = null;
    private database: DataProvider;

    constructor() {
        this.ipc.on(ClientRequest.WINDOW_EXIT, () => this.window.close())
        this.ipc.on(ClientRequest.WINDOW_MAXIMIZE, () => this.window.isMaximized() ? this.window.unmaximize() : this.window.maximize())
        this.ipc.on(ClientRequest.WINDOW_MINIMIZE, () => this.window.minimize())
        this.ipc.on(ClientSyncRequest.LOCALE_GET, c => this.i18n.get(c.args[0]))
        this.ipc.on(ClientRequest.OPEN_EXTERNAL, linkProvider => shell.openExternal(linkProvider?.args?.[0]))
        this.ipc.on(ClientRequest.SETTINGS_GET, context => {
            context.reply(
                BackendRequest.SETTINGS_GET,
                context.args[0], {
                    lang: this.settings.get("client.lang", "fr"),
                    filter: this.settings.get("client.filter", false),
                    session_bounds: [
                        new Date(this.settings.get("client.sessions_start", Date.now())),
                        new Date(this.settings.get("client.sessions_end", Date.now()))
                    ]
                }
            );
        })
        this.ipc.on(ClientRequest.SETTINGS_SET, context => {
            try {
                switch (context.args[1]) {
                    case "lang":
                        const [l_op,, locale] = context.args;
                        if (locale === "fr" || locale === "en") this.i18n.lang = locale
                        else return context.reply(BackendRequest.SETTINGS_SET, l_op, "Invalid locale")
                    case "filter":
                        const [op, prop, data] = context.args;
                        this.settings.set(prop, data)
                        context.reply(BackendRequest.SETTINGS_SET, op);
                        break;
                    case "session_bounds":
                        const [b_op, b_prop, ...dates] = context.args;
                        this.settings.set(b_prop, dates.map(bound => bound.getTime()))
                        context.reply(BackendRequest.SETTINGS_SET, b_op);
                        break;
                    default:
                        return context.reply(BackendRequest.SETTINGS_SET, 
                            context.args[0], "Invalid configuration key")
                }
            } catch (err) {
                context.reply(BackendRequest.SETTINGS_SET, context.args[0], err)
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
            this.ipc.send(BackendRequest.WINDOW_MAXIMIZED, true);
            this.settings.set("client.maximized", true);
        })
        this.window.on('unmaximize', () => {
            this.ipc.send(BackendRequest.WINDOW_MAXIMIZED, false);
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