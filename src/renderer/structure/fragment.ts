import { Layout, Transition } from "./layout";
import { Activity } from "./activity";
import { createElement } from "./element";

export abstract class Fragment extends Layout {
    protected context: Activity;
    protected container: HTMLElement;
    protected root?: HTMLDivElement;

    protected onCreate(_from?: Fragment): HTMLDivElement | Promise<HTMLDivElement> {
        return createElement({
            classes: ["fragment"]
        })
    }

    protected async replace(by: Fragment, transition?: Transition, invertTransition?: boolean) {
        if (!this.container || !this.context) throw new Error("Cannot replace a non attached Fragment");
        by.container = this.container!!;
        by.context = this.context!!;
        return by.createContext(this, transition, invertTransition)
    }
}