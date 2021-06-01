export abstract class Element {
    protected abstract readonly mDelegate: HTMLElement;

    public set width(width: string) {
        this.mDelegate.style.width = width;
    }

    public set height(height: string) {
        this.mDelegate.style.height = height;
    }
    
    public get width(): string {
        return this.mDelegate.style.width ?? window.getComputedStyle(this.mDelegate).width;
    }

    public get height(): string {
        return this.mDelegate.style.height ?? window.getComputedStyle(this.mDelegate).height;
    }

    public get delegate(): HTMLElement {
        return this.mDelegate;
    }
    
}