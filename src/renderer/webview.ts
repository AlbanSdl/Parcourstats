import { Ascript } from "ascript";
import { View } from "app/View";
import { BridgedRequestType } from "../common/window";

export interface AppContext {
    getLocale(id: string): string;
    createElement(id: string, ...classes: Array<string>): HTMLDivElement;
}

const view = new View();

window.onload = () => {
    document.getElementById("loaderText").innerText = view.getLocale("editor.app.loading");
    window.bridge.on(BridgedRequestType.ERROR, error => 
        new Ascript.Notification(error/*`${Icon.getIcon(Icon.Type.ERROR, 'ic')} ${error}`*/).setBackground("#f00").send())
    document.getElementById("windowIconClose").addEventListener('click', () => 
        window.bridge.send(BridgedRequestType.APP_LIFECYCLE_EXIT))
    document.getElementById("windowIconMinimize").addEventListener('click', () => 
        window.bridge.send(BridgedRequestType.APP_LIFECYCLE_MINIMIZE))
    document.getElementById("windowIconMaximize").addEventListener('click', () => 
        window.bridge.send(BridgedRequestType.APP_LIFECYCLE_MAXIMIZE))
}