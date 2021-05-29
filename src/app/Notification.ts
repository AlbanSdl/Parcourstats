import { Notification } from "electron";
import { join } from "path";

export class AppNotification extends Notification {

    constructor(title: string, body: string, isSilent: boolean, icon: NotificationIcon.Type, onClick?: (event: Electron.Event) => void) {
        super({
            title: title,
            body: body,
            silent: isSilent,
            icon: icon.path
        });
        if (onClick != null)
            this.on("click", onClick);
        this.show();
    }
}

export namespace NotificationIcon {
    export class Type {
        public readonly path: string;
        /**
         * Registers an image as an icon that a system notification can use
         * @param path the path to the image, from the app/resources/ folder
         */
        constructor(path: string) {
            this.path = join(__dirname, "..", "resources", path);
        }
    }
    export const TEST = new Type("icon.png");
}