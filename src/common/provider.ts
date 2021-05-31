export interface IProvider<T> {
    get(id: string): T | null
}