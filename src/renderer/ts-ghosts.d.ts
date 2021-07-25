/*! Provides types from lib.dom.d.ts (typescript dev) */
interface SVGAnimationElement {
    readonly targetElement: SVGElement | null;
    beginElement(): void;
    beginElementAt(offset: number): void;
    endElement(): void;
    endElementAt(offset: number): void;
    getCurrentTime(): number;
    getSimpleDuration(): number;
    getStartTime(): number;
}
interface AddEventListenerOptions {
    signal?: AbortSignal;
}