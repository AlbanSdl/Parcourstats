import { View } from "app/View";
import { enableIcons } from "components/icon";
import { AppNotification } from "components/notification";
import { BackendRequest, ClientRequest } from "../common/window";

window.onload = () => {
    enableIcons();
    const view = new View();
    document.getElementById("loader-text").innerText = view.getLocale("app.loading");
    window.bridge.on(BackendRequest.ERROR_DISPATCH, error => 
        new AppNotification(error, 10000, ['error']))
    document.getElementById("wdicc").addEventListener('click', () => 
        window.bridge.send(ClientRequest.WINDOW_EXIT))
    document.getElementById("wdicmi").addEventListener('click', () => 
        window.bridge.send(ClientRequest.WINDOW_MINIMIZE))
    document.getElementById("wdicma").addEventListener('click', () => 
        window.bridge.send(ClientRequest.WINDOW_MAXIMIZE))
}