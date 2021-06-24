import { Database } from "sqlite3";
import { join } from "path";
import { Table } from "./table";
import { app } from "electron/main";
import { BackendRequest, ClientRequest, ProcessBridge } from "../../common/window";
import { ipcMain } from "electron";

export class DataProvider {
    private readonly studyTable!: Table<Study>;
    private readonly rankGlobalTable!: Table<GlobalRankRecord>;
    private readonly rankUserTable!: Table<UserRankRecord>;
    private readonly db: Database;

    constructor(ipc: ProcessBridge) {
        this.db = new Database(join(app.getPath("userData"), "..", "Parcourstats", "stats.db"));
        this.studyTable = Table.create(this.db, "formations");
        this.rankGlobalTable = Table.create(this.db, "ranks");
        this.rankUserTable = Table.create(this.db, "user");
        ipc.on(ClientRequest.DATA_REQUEST, ({reply, args}) => {
            const [op, id, tableName, value] = args;
            switch (op) {
                case "select":
                    const sTargetedYear = <number>value ?? 0;
                    let sPromise: Promise<Study[] | GlobalRankRecord[] | UserRankRecord[] | string>;
                    switch (tableName) {
                        case "study":
                            sPromise = this.studyTable.select("*", {
                                field: "year",
                                operator: ">=",
                                value: sTargetedYear
                            })
                            break;
                        case "global":
                            sPromise = this.rankGlobalTable.select("*", {
                                field: "year",
                                operator: ">=",
                                value: sTargetedYear
                            })
                        case "user":
                            sPromise = this.rankUserTable.select("*", {
                                field: "year",
                                operator: ">=",
                                value: sTargetedYear
                            })
                        default:
                            sPromise = Promise.resolve("Unknown table")
                    }
                    sPromise.then(values => reply(BackendRequest.DATA_RESPONSE, id, values))
                        .catch(err => reply(BackendRequest.DATA_RESPONSE, id, err))
                    break;
                case "insert":
                    let promise: Promise<void>;
                    if (!value) return reply(BackendRequest.DATA_RESPONSE,
                        id, "Cannot insert null entry");
                    switch (tableName) {
                        case "study":
                            promise = this.studyTable.insert(value as Study)
                            break;
                        case "global":
                            promise = this.rankGlobalTable.insert(value as GlobalRankRecord)
                        case "user":
                            promise = this.rankUserTable.insert(value as UserRankRecord)
                        default:
                            return reply(BackendRequest.DATA_RESPONSE,
                                id, "Unknown table")
                    }
                    promise.then(() => reply(BackendRequest.DATA_RESPONSE, id, []))
                        .catch(err => reply(BackendRequest.DATA_RESPONSE, id, err))
                    break;
                default:
                    reply(BackendRequest.DATA_RESPONSE, id, 
                        `Cannot handle unknown operation ${op}`);
            }
        })
    }

    public async createTables() {
        await this.studyTable.create({
            name: {
                type: "TEXT",
                required: true,
                primaryKey: true
            },
            year: {
                type: "INTEGER",
                required: true,
                primaryKey: true,
                default: "(CAST(STRFTIME('%Y', 'now', 'localtime') AS INT))"
            },
            available: {
                type: "INTEGER",
                required: true,
                default: "0"
            }
        });
        await this.rankGlobalTable.create({
            name: {
                type: "TEXT",
                required: true,
                primaryKey: true
            },
            year: {
                type: "INTEGER",
                required: true,
                primaryKey: true
            },
            application_last: {
                type: "INTEGER",
                required: true,
                default: "0"
            },
            application_all: {
                type: "INTEGER",
                required: true,
                default: "0"
            },
            record_time: {
                type: "INTEGER",
                required: true,
                default: "CURRENT_TIMESTAMP",
                primaryKey: true
            }
        })
        return this.rankUserTable.create({
            name: {
                type: "TEXT",
                required: true,
                primaryKey: true
            },
            year: {
                type: "INTEGER",
                required: true,
                primaryKey: true
            },
            application_queued: {
                type: "INTEGER",
                required: true,
                default: "0"
            },
            application_absolute: {
                type: "INTEGER",
                required: true,
                default: "0"
            },
            record_time: {
                type: "INTEGER",
                required: true,
                default: "CURRENT_TIMESTAMP",
                primaryKey: true
            }
        })
    }

    public async close() {
        ipcMain.removeAllListeners(ClientRequest.DATA_REQUEST);
        return new Promise(res => this.db.close(res));
    }
}