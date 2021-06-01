import { Activity } from "./activity";

export class UIRoot {
    private currentActivity: Activity | null;

    public useActivity(activity: Activity, transition: Transition) {
        const previous = this.currentActivity;
        if (!!previous) {
            const styles = {};
            if (transition & Transition.SLIDE) styles["transform"] = "translateX(100vw)";
            if (transition & Transition.FADE) styles["opacity"] = "0";
            Object.assign(previous.delegate.style, styles)
            window.setTimeout(() => {
                document.body.removeChild(previous.delegate)
                previous.onDestroy();
            }, 500);
        }
        this.currentActivity = activity;
        this.currentActivity.create(this);
        if (!!this.currentActivity.uri)
            this.currentActivity.updateState ? 
                window.history.pushState(null, this.currentActivity.title, this.currentActivity.uri) :
                window.history.replaceState(null, this.currentActivity.title, this.currentActivity.uri);
        const styles = {};
        if (transition & Transition.SLIDE) styles["transform"] = "translateX(-100vw)";
        if (transition & Transition.FADE) styles["opacity"] = "0";
        Object.assign(this.currentActivity.delegate.style, styles)
        this.currentActivity.onCreate();
        document.body.appendChild(this.currentActivity.delegate);
        setTimeout(() => {
            const appearance = {};
            if (transition & Transition.SLIDE) appearance["transform"] = "translateX(0)";
            if (transition & Transition.FADE) appearance["opacity"] = "1";
            Object.assign(this.currentActivity.delegate.style, appearance)
            this.currentActivity.onCreated();
            const count = Math.min(previous?.getSharedElements()?.length ?? 0, activity.getSharedPlaceholders().length);
            for (let i = 0; i < count; i++) {
                const shared = previous.getSharedElements()[i]
                const placeholder = this.currentActivity.getSharedPlaceholders()[i]
                const fromCRect = shared.getBoundingClientRect()
                const previousPosition = shared.style.position;
                shared.remove();
                document.body.appendChild(shared);
                Object.assign(shared.style, {
                    position: "absolute", top: `${fromCRect.top}px`, left: `${fromCRect.left}px`,
                    width: `${fromCRect.width}px`, height: `${fromCRect.height}`, transition: "all 0.5s ease-in-out", transform: ""
                });
                setTimeout(() => {
                    const placeHolderRect = placeholder.getBoundingClientRect();
                    const activityRect = this.currentActivity.delegate.getBoundingClientRect();
                    Object.assign(shared.style, {
                        top: `${placeHolderRect.top - activityRect.top}px`, left: `${placeHolderRect.left - activityRect.left}px`,
                        width: `${placeHolderRect.width}px`, height: `${placeHolderRect.height}px`, transform: ""
                    })
                    setTimeout(() => {
                        shared.remove();
                        placeholder.parentElement.appendChild(shared);
                        placeholder.remove();
                        Object.assign(shared.style, {
                            top: placeholder.style.top, left: placeholder.style.left, width: placeholder.style.width,
                            height: placeholder.style.height, margin: placeholder.style.margin, position: placeholder.style.position ?? previousPosition,
                            transform: placeholder.style.transform
                        });
                        const keepStyle = (prop: string) => {if (!!placeholder.style[prop]) shared.style[prop] = placeholder.style[prop]}
                        keepStyle("maxWidth"); keepStyle("maxHeight");
                    }, 500)
                }, 10);
            }
            if (!!previous)
                this.currentActivity.shareElements(...previous.getSharedElements().slice(0, count))
        }, 20);
    }

    public get activity(): Activity | null {
        return this.currentActivity;
    }

}

export enum Transition {
    NONE = 0b00,
    SLIDE = 0b01,
    FADE = 0b10
}