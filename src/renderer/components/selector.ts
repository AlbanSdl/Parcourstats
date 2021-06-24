export const selectionAttribute = "selected"
export const selectionPresentAttribute = "has-selection"

type SelectionOptions<T> = {
    container: HTMLElement,
    extractor: (this: Selector<T>, element?: Element) => T,
    isUnique: true,
    listener?: (this: Selector<T>, value: T) => void,
    neverEmpty?: boolean
} | {
    container: HTMLElement,
    extractor: (this: Selector<T>, element: Element) => T,
    isUnique?: false,
    listener?: (this: Selector<T>, ...values: T[]) => void,
    neverEmpty?: boolean
}

export class Selector<T> {
    private readonly container!: HTMLElement;
    private readonly extractor!: (element: Element) => T;
    private readonly listener?: (...element: T[]) => void;
    private observer?: MutationObserver;
    public readonly isUnique!: boolean;
    public readonly neverEmpty!: boolean;

    constructor(options: SelectionOptions<T>) {
        this.container = options.container!!;
        this.extractor = options.extractor!!;
        this.listener = options.listener;
        this.isUnique = options.isUnique ?? true;
        this.neverEmpty = options?.neverEmpty ?? false;
        this.listen();
    }

    public get childrenElements() {
        return this.container.children;
    }

    public get children() {
        return Array.from(this.childrenElements).map(this.extractor, this);
    }

    public append(element: HTMLElement) {
        if (this.selectionElements.length < 1 && this.neverEmpty)
            element.toggleAttribute("selected", true);
        this.container.append(element);
        element.addEventListener('click', function () {
            this.toggleAttribute("selected");
        })
    }

    public get selectionElements() {
        return Array.from(this.container.children)
            .filter(el => el.hasAttribute("selected"))
    }

    public get selection() {
        return this.selectionElements.map(this.extractor, this);
    }

    private listen() {
        const mutationOptions: MutationObserverInit = {
            attributeFilter: [selectionAttribute, selectionPresentAttribute],
            childList: true,
            subtree: true
        };
        const updateSelection = (obs: MutationObserver, entry?: Element) => {
            obs.disconnect();
            if (this.isUnique) {
                for (const caption of this.container.children)
                    caption.toggleAttribute(selectionAttribute, caption === entry);
                this.container.toggleAttribute(selectionPresentAttribute, !!entry)
                this.listener?.(this.extractor(entry));
            } else {
                const selection = this.selection;
                this.container.toggleAttribute(selectionPresentAttribute, selection.length > 0);
                this.listener?.(...selection);
            }
            obs.observe(this.container, mutationOptions);
        }
        this.observer = new MutationObserver((entries, obs) => {
            for (const entry of entries) {
                if (entry.type === "attributes" && entry.target instanceof Element) {
                    const target = entry.target;
                    if (entry.attributeName === selectionPresentAttribute && entry.target === this.container 
                        && !entry.target.hasAttribute(selectionPresentAttribute)) updateSelection(obs)
                    else if (entry.attributeName === selectionAttribute && entry.target !== this.container) {
                        if (this.neverEmpty && !target.hasAttribute(entry.attributeName) && this.selectionElements.length === 0)
                            return target.toggleAttribute(selectionAttribute, true);
                        updateSelection(obs, target.hasAttribute(entry.attributeName) ? target : undefined);
                    }
                } else if (entry.type === "childList") {
                    for (const added of entry.addedNodes)
                        if (added instanceof Element && added.hasAttribute(selectionAttribute))
                            updateSelection(obs, added);
                    for (const deleted of entry.removedNodes)
                        if (deleted instanceof Element && deleted.hasAttribute(selectionAttribute)) {
                            if (this.neverEmpty && this.selectionElements.length === 0)
                                return this.container.firstElementChild?.toggleAttribute?.(selectionAttribute, true);
                            updateSelection(obs, undefined);
                        }
                }
            }
        });
        this.observer.observe(this.container, mutationOptions)
    }

    public stop() {
        this.observer?.disconnect();
    }
}