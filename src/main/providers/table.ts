import { Database } from "sqlite3";

export interface Table<Entry> {
    /**
     * Selects {@link Entry entries} of the database and returns them.
     * Database is NOT updated when {@link Entry entries} are modified.
     * @param fields the fields to select. Use "*" to select all fields
     * @param where filters the output. Used like a SQL where clause
     * @returns an array containing all matching entries (can be empty)
     * @throws whether the selection could not be performed
     */
    select<K extends (keyof Entry)[], F extends keyof Entry>(fields: [...K] | '*', 
        where: WhereClause<Entry, F>): Promise<Pick<Entry, K[number]>[]>;
    /**
     * Inserts an entry into the database table.
     * @param entry the entry to insert into the database
     * @returns when the insertion has finished or aborted
     * @throws whether the insertion could not be performed
     */
    insert(entry: Entry): Promise<void>;
    /**
     * Updates all database entries matching the given filters.
     * @param updates the updates to perform to the selected entries
     * @param where filters the updated entries
     * @returns when the update has finished or aborted
     * @throws whether the update could not be performed
     */
    update<F extends keyof Entry>(updates: Partial<Entry>, where: WhereClause<Entry, F>): Promise<void>;
    /**
     * Deletes all database entries matching the given filters.
     * @param where selects the entries to delete
     * @returns when the deletion has finished or aborted
     * @throws whether the deletion could not be performed
     */
    delete<F extends keyof Entry>(where: WhereClause<Entry, F>): Promise<void>;
    /**
     * Creates the table in the database. This method doesn't overwrite
     * the current table and invokes the following sql query
     * ```sql
     * CREATE TABLE IF NOT EXISTS ... (...)
     * ```
     * @param proto the {@link TableProto prototype} of a single database entry
     * @returns when the creation has finished or aborted
     * @throws whether the creation could not be performed
     */
    create(proto: TableProto<Entry>): Promise<void>;
    /**
     * Deletes the table from the database. The only way to revert table drop
     * operation is to re-create the table and insert all contents in the new
     * created table.
     * @returns when the drop operation has finished or aborted
     * @throws whether the drop operation could not be performed
     */
    drop(): Promise<void>;
}

export namespace Table {
    /** Instantiates a structure for a database table */
    export function create<T>(database: Database, name: string) {
        return new TableImpl<T>(database, name);
    }
}

type NumericOperator = "<" | "<=" | ">" | ">=";
type LogicOperator = "=" | "==" | "!=" | "<>" | "IS" | "IS NOT";
type ArrayOperator = "IN" | "NOT IN";
type NumericArrayOperator = "BETWEEN" | "NOT BETWEEN";
type StringOperator = "LIKE" | "GLOB" | "NOT LIKE" | "NOT GLOB";
type Operator = NumericOperator | LogicOperator | ArrayOperator | NumericArrayOperator | StringOperator;
type OperatorTypes = {
    [Op in Operator]: Op extends NumericOperator ? number : 
        Op extends ArrayOperator ? unknown[] :
        Op extends NumericArrayOperator ? [number, number] :
        Op extends StringOperator ? string : unknown;
}
type OperatorFor<T> = keyof {
    [Op in keyof OperatorTypes as T extends OperatorTypes[Op] ? Op : keyof T]: unknown;
} & Operator;

interface WhereClause<Entry, Field extends keyof Entry, Op extends OperatorFor<Entry[Field]> = OperatorFor<Entry[Field]>> {
    field: Field,
    operator: Op,
    value: OperatorTypes[Op] & Entry[Field]
}

type TypeFor<T> = T extends string ? "TEXT" : T extends number ? "REAL" | "INTEGER" : "BLOB";
type TableProto<Entry> = {
    [key in keyof Entry & string]: TableProtoField<Entry, key>
}
type TableProtoField<
    Entry,
    Name extends keyof Entry,
> = {
    /** The data type contained in the field */
    type: TypeFor<Entry[Name]>,
    /** Flags the field as NOT_NULL. Must always contain a value */
    required: boolean,
    /** A Sql expression string. Default is NULL */
    default?: string,
    /** Whether this field is part of the primary key of the table */
    primaryKey?: boolean,
    /** Whether the value of this field must be unique in the table */
    unique?: boolean
}

class TableImpl<Entry> implements Table<Entry> {
    private readonly db!: Database;
    private readonly name!: string;

    constructor(database: Database, name: string) {
        this.checkName(name);
        this.db = database;
        this.name = name;
    }

    public async select<K extends (keyof Entry)[], F extends keyof Entry>(
        fields: "*" | [...K],
        where: WhereClause<Entry, F, OperatorFor<Entry[F]>>
    ): Promise<Pick<Entry, K[number]>[]> {
        return new Promise((res, rej) => {
            let rFields: string;
            if (Array.isArray(fields)) {
                (fields as string[]).forEach(this.checkName);
                rFields = fields.map(f => `"${f}"`)?.join()
            } else {
                rFields = fields;
            }
            const statementParts = [`SELECT ${rFields} FROM ${this.name}`];
            const filters: {
                [key in keyof Entry as `$${string & key}`]?: Entry[keyof Entry]
            } = {};
            if (!!where) {
                statementParts.push("WHERE");
                statementParts.push(`${where.field} ${where.operator} $${where.field}`);
                filters[`$${where.field}` as keyof typeof filters] = where.value
            }
            this.db.all(statementParts.join(" "), filters, (err, row) => {
                if (!!err) rej(err)
                else res(row);
            })
        });
    }

    public async insert(entry: Entry): Promise<void> {
        return new Promise((res, rej) => {
            const entries = Object.keys(entry) as (keyof typeof entry)[];
            const statementParts = [
                `INSERT INTO ${this.name}`,
                `(${entries.map(f => `"${f}"`).join()})`,
                `VALUES (${entries.map(f => `$${f}`)})`
            ];
            this.db.run(
                statementParts.join(" "),
                Object.fromEntries(Object.entries(entry).map(e => [`$${e[0]}`, e[1]])),
                err => !!err ? rej(err) : res()
            )
        });
    }

    public async update<F extends keyof Entry>(
        updates: Partial<Entry>,
        where: WhereClause<Entry, F, OperatorFor<Entry[F]>>
    ): Promise<void> {
        return new Promise((res, rej) => {
            const entries = Object.keys(updates) as F[];
            const statementParts = [
                `UPDATE ${this.name}`,
                `SET ${entries.map(f => `"${f}" = $${f}`).join()}`
            ];
            const filters: {
                [key in keyof Entry as `w${string & key}`]?: Entry[keyof Entry]
            } = {};
            if (!!where) {
                statementParts.push("WHERE");
                statementParts.push(`"${where.field}" ${where.operator} $w${where.field}`);
                filters[`w${where.field}` as keyof typeof filters] = where.value
            }
            this.db.run(statementParts.join(" "), {
                ...Object.fromEntries(Object.entries(updates).map(e => [`$${e[0]}`, e[1]])),
                ...filters
            }, err => {
                if (!!err) rej(err)
                else res();
            })
        });
    }

    public async delete<F extends keyof Entry>(where: WhereClause<Entry, F, OperatorFor<Entry[F]>>): Promise<void> {
        return new Promise((res, rej) => {
            const statementParts = [
                `DELETE FROM ${this.name}`
            ]
            const filters: {
                [key in F as `w${F & string}`]?: Entry[F]
            } = {};
            if (!!where) {
                statementParts.push("WHERE");
                statementParts.push(`"${where.field}" ${where.operator} $w${where.field}`);
                filters[`w${where.field}` as `w${F & string}`] = where.value
            }
            this.db.run(statementParts.join(" "), filters, err => {
                if (!!err) rej(err)
                else res();
            })
        });
    }

    public async create(proto: TableProto<Entry>): Promise<void> {
        return new Promise((res, rej) => {
            const statementParts = [
                `CREATE TABLE IF NOT EXISTS ${this.name}`
            ];
            if (Object.keys(proto).length > 0) {
                statementParts.push("(");
                const fields: string[] = [];
                for (const field in proto) {
                    const fieldProto = proto[field as keyof Entry & string];
                    const cField = [
                        `"${field}"`,
                        fieldProto.type
                    ];
                    if (fieldProto.required === true)
                        cField.push("NOT NULL")
                    if (fieldProto.unique === true)
                        cField.push("UNIQUE")
                    if (!!fieldProto.default)
                        cField.push(`DEFAULT ${fieldProto.default!!}`)
                    fields.push(cField.join(" "))
                }
                const pKey = Object.keys(proto)
                    .filter(field => proto[field as keyof Entry & string].primaryKey === true)
                    .map(f => `"${f}"`).join();
                if (pKey.length > 0) fields.push(`PRIMARY KEY (${pKey})`)
                statementParts.push(fields.join());
                statementParts.push(")");
            }
            this.db.run(statementParts.join(" "), err => {
                if (!!err) rej(err)
                else res();
            })
        });
    }

    public async drop(): Promise<void> {
        return new Promise((res, rej) => {
            this.db.run(`DROP TABLE ${this.name}`, err => {
                if (!!err) rej(err);
                else res();
            })
        });
    }

    private checkName(name: string) {
        if (/"|'/.test(name)) throw new Error(`Cannot use invalid name ${name}.`);
    }
}