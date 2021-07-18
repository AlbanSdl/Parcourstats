interface SessionRecord {
    readonly year: number;
    size?: number;
    absolute?: number;
    readonly global: {
        time: number,
        last: number,
        all: number
    }[];
    readonly user: {
        time: number,
        queued: number
    }[];
}

export class Formation implements SessionData {
    public readonly name!: string;

    public get session() {
        return this.sessionsInternal[0];
    }

    public get sessions(): ReadonlyArray<SessionRecord> {
        return [...this.sessionsInternal]
    }

    public get size() {
        return this.session?.size
    }

    public get year() {
        return this.session?.year
    }

    public get absolute() {
        return this.session?.absolute
    }

    public get global() {
        return this.session?.global
    }

    public get user() {
        return this.session?.user
    }

    public get firstUserRecord() {
        return this.user[0];
    }

    public get latestUserRecord() {
        return this.user[this.user.length - 1];
    }

    public get firstGlobalRecord() {
        return this.global[0];
    }

    public get latestGlobalRecord() {
        return this.global[this.global.length - 1];
    }

    private readonly sessionsInternal: SessionRecord[] = [];

    constructor(name: string) {
        this.name = name;
    }

    public update(value: Study | UserRankRecord | GlobalRankRecord) {
        let session = this.sessionsInternal.find(session => session.year === value.year);
        if (!session) this.sessionsInternal.splice(reIndex(this.sessionsInternal.findIndex(previous => previous.year <= value.year),
        this.sessionsInternal.length), 0, session = {
            year: value.year,
            global: [],
            user: []
        });
        if ("available" in value) {
            session.size = value.available ?? session.size;
        } else if ("application_all" in value) {
            const time = Date.parse(value.record_time);
            session.global.splice(reIndex(session.global.findIndex(previous => previous.time > time), session.global.length), 0, {
                all: value.application_all,
                last: value.application_last,
                time
            })
        } else if ("application_queued" in value) {
            session.absolute = value.application_absolute ?? session.absolute;
            const time = Date.parse(value.record_time);
            session.user.splice(reIndex(session.user.findIndex(previous => previous.time > time), session.user.length), 0, {
                queued: value.application_queued,
                time
            })
        }
    }
}

export declare interface FormationDataMapping {
    study: Study,
    global: GlobalRankRecord,
    user: UserRankRecord
}

function reIndex(index: number, defaultValue: number) {
    return index < 0 ? defaultValue : index;
}