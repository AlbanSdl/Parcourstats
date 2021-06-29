interface Array<T> {
    until<A>(
        this: Array<T>,
        predicate: (this: A, value: T, index: number, obj: T[]) => unknown,
        thisArg?: A
    ): T[];
}

Array.prototype.until = function <T, A>(
    this: Array<T>, 
    predicate: (this: A, value: T, index: number, obj: T[]) => unknown,
    thisArg?: A
) {
    return this.slice(0, (i => i === undefined ? i : i - 1)(-~this.findIndex(predicate, thisArg) || void 0));
}