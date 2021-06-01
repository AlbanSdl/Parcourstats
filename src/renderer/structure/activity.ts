import { Element } from "./element";
import { UIRoot } from "./uiRoot";

const parser = new DOMParser();

export abstract class Activity extends Element {

    public readonly title: string;
    public readonly uri: string;
    public readonly updateState: boolean;
    protected readonly mDelegate: HTMLElement;
    private _root: UIRoot | null;

    constructor(title: string, uri: string, pushState: boolean, layout: string) {
        super();
        this.mDelegate = parser.parseFromString(layout, "text/html") as any as HTMLElement;
        this.title = title;
        this.uri = uri;
        this.updateState = pushState;
    }

    protected get root(): UIRoot {
        return this._root
    }

    public create(root: UIRoot): void {
        if (!root) throw new Error("Cannot attach activity to null root")
        this._root = root;
    }

    /**
     * Called when the activity is being created. Instantiate UI elements of the
     * activity in the method implementation.
     * At this time the activity is not attached to the document.
     */
    public onCreate(): void {}

    /**
     * Called when the activity has been created and attached to the document.
     */
    public abstract onCreated(): void

    /**
     * Called when the activity is being destroyed (is no longer visible)
     */
    public abstract onDestroy(): void

    public getSharedElements(): Array<HTMLElement> {
        return []
    }

    public getSharedPlaceholders(): Array<HTMLElement> {
        return []
    }

    public shareElements(..._shared: HTMLElement[]) {
    }

}