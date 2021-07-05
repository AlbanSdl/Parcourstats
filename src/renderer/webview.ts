import { enableIcons, Icon } from "components/icon";
import { Home } from "app";
import { Query } from "../common/window";

const savedFsIcon = {
    "true": null,
    "false": null
};

Array.prototype.until = function <T, A>(
    this: Array<T>, 
    predicate: (this: A, value: T, index: number, obj: T[]) => unknown,
    thisArg?: A
) {
    return this.slice(0, (i => i === undefined ? i : i - 1)(-~this.findIndex(predicate, thisArg) || void 0));
}

window.onload = () => {
    enableIcons();
    new Home().create();
    window.messenger.on(Query.WINDOW_MAXIMIZE, async max => {
        const target = document.getElementById("wdicma");
        if (!!target) {
            if (!savedFsIcon[`${max}`]) {
                target.firstElementChild.remove();
                target.addIcon(max ? Icon.WINDOW_EXFS : Icon.WINDOW_ENFS).then(icon => savedFsIcon[`${max}`] = icon)
            } else target.replaceChild(savedFsIcon[`${max}`], target.firstElementChild)
        }
    })
    document.getElementById("wdicc").addEventListener('click', () => 
        window.messenger.send(Query.WINDOW_EXIT))
    document.getElementById("wdicmi").addEventListener('click', () => 
        window.messenger.send(Query.WINDOW_MINIMIZE))
    document.getElementById("wdicma").addEventListener('click', () => 
        window.messenger.send(Query.WINDOW_MAXIMIZE))
}