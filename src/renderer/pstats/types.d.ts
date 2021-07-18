interface Localizer {
    getLocale(key: string): Promise<string>;
}

interface FormationDataMapping {
    study: Study,
    global: GlobalRankRecord,
    user: UserRankRecord
}