import { View } from "app/View";
import { enableIcons } from "graph/icon";
import { AppNotification } from "graph/notification";
import { BridgedRequestType } from "../common/window";

export interface AppContext {
    getLocale(id: string): string;
    createElement(id: string, ...classes: Array<string>): HTMLDivElement;
}

window.onload = () => {
    enableIcons();
    const view = new View();
    new AppNotification("Loaded", -1);
    document.getElementById("loader-text").innerText = view.getLocale("app.loading");
    window.bridge.on(BridgedRequestType.ERROR, error => 
        new AppNotification(error))
    document.getElementById("wdicc").addEventListener('click', () => 
        window.bridge.send(BridgedRequestType.APP_LIFECYCLE_EXIT))
    document.getElementById("wdicmi").addEventListener('click', () => 
        window.bridge.send(BridgedRequestType.APP_LIFECYCLE_MINIMIZE))
    document.getElementById("wdicma").addEventListener('click', () => 
        window.bridge.send(BridgedRequestType.APP_LIFECYCLE_MAXIMIZE))
}