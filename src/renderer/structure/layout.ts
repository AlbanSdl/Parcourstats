import { waitAnimationFrame } from "scheduler";

export enum Transition {
    NONE = 0b00,
    SLIDE = 0b01,
    FADE = 0b10
}

export abstract class Layout {
    /**
     * The root element of THIS layout. This element IS included IN
     * the layout. As such it is created by {@link onCreate}
     * and destroyed right before {@link onDestroyed}
     */
    protected abstract root?: HTMLDivElement;
    /**
     * The elements that will CONTAIN the {@link root} of this layout.
     * It must NOT be part of the current layout.
     */
    protected abstract readonly container: HTMLElement;

    /**
     * Called before the new layout is added into the current view
     * and before the previous (nullable) layout has started any
     * destruction process.
     * Can be used to inherit values from the previous layout.
     * (such as cached locales for {@link Activity activities})
     */
    protected abstract onCreate(from?: Layout): HTMLDivElement | Promise<HTMLDivElement>;
    /**
     * Called when the layout has been inserted into the current view
     * and is starting its transition. You can apply (css) animations at that
     * time, they won't be cancelled.
     */
    protected abstract onCreated(): void | Promise<void>;
    /**
     * Called right before the current layout starts to be animated out
     * of the screen.
     * This method is called after the creation of the next layout, thus
     * all important values may have already been retrieved and they should
     * be deleted at that time.
     */
    protected abstract onDestroy(): void | Promise<void>;
    /**
     * Called right after the current layout has been fully removed from
     * screen (root no longer attached to the screen). The layout should be
     * deleted at that time.
     */
    protected abstract onDestroyed(): void | Promise<void>;

    /**
     * Replaces the current layout by another one. Both layouts must have the same container
     * but types may differ.
     * @param by the new layout which replaces this one
     * @param transition the transition to use for when inflating the new layout
     * @param invertTransition whether the transition should be inverted (eg. when going backwards)
     */
    protected async replace(by: Layout, transition: Transition = Transition.NONE, invertTransition: boolean = false) {
        if (this.container !== by.container)
            throw new Error("Layout replacement can only be performed within the same container.")
        return by.createContext(this, transition, invertTransition);
    }

    /**
     * Creates a context for the current layout and starts replacement.
     * @param using the previous layout to replace with this layout
     * @param transition the transition to use
     * @param invertTransition whether the transition should be inverted
     * @param destroy whether the previous layout must be destroyed
     */
    protected async createContext(
        using?: Layout,
        transition: Transition = Transition.NONE,
        invertTransition: boolean = false
    ) {
        this.root = await this.onCreate(using);
        if (!!using) {
            await using.onDestroy();
            applyTransitionStyles(using.root!!, transition, false, invertTransition).then(() => {
                using.root!!.remove();
                delete using.root;
                using.onDestroyed();
            });
        }
        this.container.appendChild(this.root);
        applyTransitionStyles(this.root, transition, true, invertTransition);
        return this.onCreated();
    }
}

async function applyTransitionStyles(root: HTMLDivElement, transition: Transition, isOpening: false, invert: boolean): Promise<void>;
async function applyTransitionStyles(root: HTMLDivElement, transition: Transition, isOpening: true, invert: boolean): Promise<void>;
async function applyTransitionStyles(root: HTMLDivElement, transition: Transition, isOpening: boolean, invert: boolean): Promise<void> {
    const applied = [Transition.SLIDE, Transition.FADE].filter(tr => tr & transition).map(tr => Transition[tr].toLowerCase());
    root.setAttribute("prepare", applied.join(' '));
    const direction = (invert ? !isOpening : isOpening) ? "in" : "out";
    applied.forEach(attr => root.setAttribute(attr, direction))
    if (isOpening) return waitAnimationFrame().then(() => {
        root.removeAttribute("prepare");
        applied.forEach(attr => root.removeAttribute(attr));
    });
    if (applied.length > 0) return new Promise(res => root.addEventListener("transitionend", transition => waitAnimationFrame().then(() => {
        if (!transition.pseudoElement) {
            root.removeAttribute("prepare");
            applied.forEach(attr => root.getAttribute(attr) === direction ? root.removeAttribute(attr) : 0);
            res();
        }
    })))
}