export interface BaseData {
    id: string
}

export interface Database<T extends BaseData> {
    set(values: T): void
    get(id: string): T | undefined
}
