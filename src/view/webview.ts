import { ipcRenderer } from "electron";
import { Ascript } from "./ascript";
import { View } from "./app/View";

export interface AppContext {
    getLocale(id: string): string;
    createElement(id: string, ...classes: Array<string>): HTMLDivElement;
}

const view = new View();

window.onload = () => {
    document.getElementById("loaderText").innerText = view.getLocale("editor.app.loading");
    ipcRenderer.on("error", (_event, error) => {
        new Ascript.Notification(error/*`${Icon.getIcon(Icon.Type.ERROR, 'ic')} ${error}`*/).setBackground("#f00").send();
    });
    document.getElementById("windowIconClose").addEventListener('click', () => {
        ipcRenderer.send("exitApp");
    });
    document.getElementById("windowIconMinimize").addEventListener('click', () => {
        ipcRenderer.send("minimizeApp");
    });
    document.getElementById("windowIconMaximize").addEventListener('click', () => {
        ipcRenderer.send("maximizeApp");
    })
}