import { enableIcons, Icon } from "components/icon";
import { AppNotification } from "components/notification";
import { Home } from "app";
import { BackendRequest, ClientRequest } from "../common/window";

const savedFsIcon = {
    "true": null,
    "false": null
};

window.onload = () => {
    enableIcons();
    new Home().create();
    window.bridge.on(BackendRequest.ERROR_DISPATCH, error => 
        new AppNotification(error, 10000, ['error']))
    window.bridge.on(BackendRequest.WINDOW_MAXIMIZED, max => {
        const target = document.getElementById("wdicma");
        if (!!target) {
            if (!savedFsIcon[`${max}`]) {
                target.firstElementChild.remove();
                target.addIcon(max ? Icon.WINDOW_EXFS : Icon.WINDOW_ENFS).then(icon => {
                    savedFsIcon[`${max}`] = icon;
                })
            } else {
                target.replaceChild(savedFsIcon[`${max}`],
                    target.firstElementChild)
            }
        }
    })
    document.getElementById("wdicc").addEventListener('click', () => 
        window.bridge.send(ClientRequest.WINDOW_EXIT))
    document.getElementById("wdicmi").addEventListener('click', () => 
        window.bridge.send(ClientRequest.WINDOW_MINIMIZE))
    document.getElementById("wdicma").addEventListener('click', () => 
        window.bridge.send(ClientRequest.WINDOW_MAXIMIZE))
}