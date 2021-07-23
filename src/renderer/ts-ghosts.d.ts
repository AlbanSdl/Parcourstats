/*! Provides types from lib.dom.d.ts (typescript dev) */
declare function requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number;
declare function cancelIdleCallback(handle: number): void;
interface IdleRequestOptions {
    timeout?: number;
}
interface IdleRequestCallback {
    (deadline: IdleDeadline): void;
}
interface IdleDeadline {
    readonly didTimeout: boolean;
    timeRemaining(): DOMHighResTimeStamp;
}
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