import { Database } from "sqlite3";
import { join } from "path";
import { Table } from "./table";
import { app } from "electron/main";
import { ipcMain } from "electron";
import { Query, Recipient } from "../../common/window";

export class DataProvider {
    private readonly studyTable!: Table<Study>;
    private readonly rankGlobalTable!: Table<GlobalRankRecord>;
    private readonly rankUserTable!: Table<UserRankRecord>;
    private readonly db: Database;

    constructor(ipc: Recipient<"back">) {
        this.db = new Database(join(app.getPath("userData"), "..", "Parcourstats", "stats.db"));
        this.studyTable = Table.create(this.db, "formations");
        this.rankGlobalTable = Table.create(this.db, "ranks");
        this.rankUserTable = Table.create(this.db, "user");
        ipc.on(Query.DATA, (op, tableName, value?) => {
            switch (op) {
                case "select":
                    const sTargetedYear = <number>value ?? 0;
                    switch (tableName) {
                        case "study":
                            return this.studyTable.select("*", {
                                field: "year",
                                operator: ">=",
                                value: sTargetedYear
                            }) as Promise<Study[]>;
                        case "global":
                            return this.rankGlobalTable.select("*", {
                                field: "year",
                                operator: ">=",
                                value: sTargetedYear
                            }) as Promise<GlobalRankRecord[]>;
                        case "user":
                            return this.rankUserTable.select("*", {
                                field: "year",
                                operator: ">=",
                                value: sTargetedYear
                            }) as Promise<UserRankRecord[]>;
                        default:
                            return Promise.reject(new Error("Unknown table"))
                    }
                case "insert":
                    if (!value) throw new Error("Cannot insert null entry");
                    switch (tableName) {
                        case "study": return this.studyTable.insert(value as Study);
                        case "global": return this.rankGlobalTable.insert(value as GlobalRankRecord);
                        case "user": return this.rankUserTable.insert(value as UserRankRecord);
                        default: throw new Error("Unknown table");
                    }
                default: throw new Error(`Cannot handle unknown operation ${op}`);
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
                type: "INTEGER" as any,
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
                type: "INTEGER" as any,
                required: true,
                default: "CURRENT_TIMESTAMP",
                primaryKey: true
            }
        })
    }

    public async close() {
        ipcMain.removeAllListeners(Query.DATA);
        return new Promise(res => this.db.close(res));
    }
}