interface Study {
    readonly name: string;
    readonly year?: number;
    readonly available?: number;
}

interface GlobalRankRecord {
    readonly name: string;
    readonly year?: number;
    readonly application_last?: number
    readonly application_all?: number
    readonly record_time?: string
}

interface UserRankRecord {
    readonly name: string;
    readonly year?: number;
    readonly application_queued?: number
    readonly application_absolute?: number
    readonly record_time?: string
}