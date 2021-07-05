interface Array<T> {
    until<A>(
        this: Array<T>,
        predicate: (this: A, value: T, index: number, obj: T[]) => unknown,
        thisArg?: A
    ): T[];
}