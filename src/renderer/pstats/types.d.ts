interface Data {
    [name: string]: {
        sessions?: Study[],
        global?: GlobalRankRecord[],
        user?: UserRankRecord[]
    }
}

interface Localizer {
    getLocale(key: string): Promise<string>;
}