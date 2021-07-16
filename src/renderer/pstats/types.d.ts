interface Data {
    [name: string]: {
        sessions?: Study[],
        global?: GlobalRankRecord[],
        user?: UserRankRecord[]
    }
}

type RemoteData = Study | GlobalRankRecord | UserRankRecord;
type LoadedType<T extends RemoteData = RemoteData> = {
    [key in keyof T]: key extends "record_time" ? number : T[key]
};

type LoadedData = {
    [name in keyof Data]: {
        [kind in keyof Data[name]]: Data[name][kind] extends Array<infer R> ? 
        LoadedType<R extends RemoteData ? R : never>[] : Data[name][kind]
    }
}

interface Localizer {
    getLocale(key: string): Promise<string>;
}