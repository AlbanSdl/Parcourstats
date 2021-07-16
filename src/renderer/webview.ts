import { enableIcons, Icon } from "components/icon";
import { Home } from "pstats/home";
import { Query } from "../common/window";
import { AppNotification } from "components/notification";

Array.prototype.until = function <T, A>(
    this: Array<T>, 
    predicate: (this: A, value: T, index: number, obj: T[]) => unknown,
    thisArg?: A
) {
    return this.slice(0, (i => i === undefined ? i : i - 1)(-~this.findIndex(predicate, thisArg) || void 0));
}

window.addEventListener("securitypolicyviolation", e => {
    new AppNotification({
        content: `Blocked ${e.blockedURI}. Directive: ${e.violatedDirective}. Invoked from ${
            e.documentURI || "unknown"}:${e.lineNumber}:${e.columnNumber}`,
        prefix: "Security Warning",
        flags: AppNotification.Type.ERROR
    });
});

window.onload = () => {
    enableIcons();
    new Home().create();
    window.messenger.on(Query.WINDOW_MAXIMIZE, async max => {
        document.getElementById("wdicma")?.setIcon(max ? Icon.WINDOW_EXFS : Icon.WINDOW_ENFS, true)
    })
    document.getElementById("wdicc").addEventListener('click', () => 
        window.messenger.send(Query.WINDOW_EXIT))
    document.getElementById("wdicmi").addEventListener('click', () => 
        window.messenger.send(Query.WINDOW_MINIMIZE))
    document.getElementById("wdicma").addEventListener('click', () => 
        window.messenger.send(Query.WINDOW_MAXIMIZE))
}