interface SessionData {
    readonly name: string;
    readonly year?: number;
}

interface Study extends SessionData {
    readonly available?: number;
}

interface GlobalRankRecord extends SessionData {
    readonly application_last?: number
    readonly application_all?: number
    readonly record_time?: string
}

interface UserRankRecord extends SessionData {
    readonly application_queued?: number
    readonly application_absolute?: number
    readonly record_time?: string
}