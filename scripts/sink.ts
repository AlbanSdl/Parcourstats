import { BeforeBuildContext, FileSet, Platform } from "electron-builder";
import { join, resolve, relative, sep } from "path";
import { readFile, readdir, writeFile, mkdir } from "fs/promises";

export type Promisable<T> = Promise<T> | T;
interface MappedDeps<T> {
    [name: string]: T;
}

interface ModuleSinkOptions {
    outputLocation?: string,
    sourceLocation?: string,
    sourceFilter?: string[] | string,
    jsonPackageLocation?: `${string}package.json`,
    modules?: ModuleSinkStrategy
}

interface ModuleSinkRule {
    /** 
     * A regular expression that matches files to inject in packed application.
     * The values this regex will be matched against are the filenames within
     * the module (with sub-directories). The regex is called on folders first
     * and then on folders contents ONLY IF the folder matches the expression.
     * @default /^((.*\.([cm]js|js(on|x)?|node))|[^.]*)$/us
     */
    keep?: RegExp,
    /** 
     * A method to patch exported members of a module.
     * A member is considered as used when imported or required in other
     * modules.
     * @returns a false evaluatable value to keep the member as is (eg. "" or null) 
     *          or javascript code (as string) which will replace current implementation.
     */
    patch?: (
        exportedMemberName: string | typeof ModuleDefault,
        platformTarget: Platform,
        archTarget: string
    ) => Promisable<null | undefined | false | string>;
}

interface JsonPackage {
    name: string,
    version: string,
    description: string,
    main: string,
    dependencies?: {
        [name: string]: string;
    }
}

export const ModuleDefault = Symbol("moduleRoot");
export type ModuleSinkStrategy = MappedDeps<ModuleSinkRule>;
export type ModuleDependencies = MappedDeps<string>;

export class ModuleSink {
    #strategy!: ModuleSinkStrategy;
    #discarded: number = 0;
    #kept: number = 0;
    public readonly paths: (FileSet | string)[] = [];
    public readonly outputPath!: string;
    public readonly sourcePath!: string;
    public readonly patchLocation: string = "patches";
    private readonly jsonPackageLocation!: `${string}package.json`;
    private readonly modules: Map<string, {
        files: {
            location: string;
            members: ((typeof ModuleDefault) | string)[];
        }[];
        main?: string,
        uses?: {
            [dependency: string]: ((typeof ModuleDefault) | string)[]
        };
    }> = new Map;

    constructor(options?: ModuleSinkOptions) {
        this.#strategy = options?.modules ?? {};
        this.jsonPackageLocation = options?.jsonPackageLocation ?? "package.json";
        this.outputPath = options?.outputLocation ?? "build";
        this.sourcePath = options?.sourceLocation ?? "src";
        const checkedSource = this.sourcePath.toLowerCase().split(/[\\/]/)[0];
        if (checkedSource === this.patchLocation || checkedSource === "node_modules")
            throw new Error(`Cannot used reserved ${this.sourcePath} directory for sources`)
        this.paths.push(this.jsonPackageLocation, "!**/node_modules/**/*");
    }

    public async start(context: BeforeBuildContext) {
        console.info("[ModuleSink]: Resolving dependencies")
        const thisName = await this.resolvePackageDependencies(context.appDir, this.jsonPackageLocation, context.appDir).catch(() => {
            throw new Error(`Cannot find package.json. Ensure jsonPackageLocation is correct in ModuleSinkOptions`)
        })
        console.info("[ModuleSink]: Applying patches")
        await this.patchModules(context.appDir, thisName, context.platform, context.arch);
        console.info("[ModuleSink]: Resolving unused exports")
        await this.resolveUsage(thisName).catch(() => {
            throw new Error(`Dependencies should not be altered during compilation`)
        })
        console.info("[ModuleSink]: Preparing shrink patch")
        for (const [name, module] of this.modules.entries()) {
            for (const dependency in module.uses ?? {}) {
                const dep = this.modules.get(dependency);
                if (!dep) {
                    (this.#strategy[name] = this.#strategy[name] ?? {}).patch = () => false;
                    continue;
                }
                const pendingRemoval = dep.files.find(depFile => depFile.location === dep.main)?.members
                    .filter(member => module.uses[dependency].includes(member));
                    (this.#strategy[name] = this.#strategy[name] ?? {}).patch = name => pendingRemoval.includes(name) && "null";
            }
        }
        console.info("[ModuleSink]: Applying shrink patch")
        await this.patchModules(context.appDir, thisName, null, null);
        console.info("[ModuleSink]: Updating files")
        const appModule = this.modules.get(thisName);
        const paths = [...this.modules.values()].filter(module => module !== appModule)
            .map(module => module.files.map(file => relative(context.appDir, file.location))).flat();
        this.paths.unshift({
            from: resolve(this.outputPath, this.sourcePath),
            to: "",
            filter: appModule.files.map(file => relative(
                resolve(context.appDir, this.outputPath, this.sourcePath), file.location))
        }, {
            from: resolve(this.outputPath, this.patchLocation),
            to: "node_modules",
            filter: paths.filter(file => file.startsWith(this.outputPath + sep + this.patchLocation))
                .map(file => relative(join(this.outputPath, this.patchLocation), file))
        }, {
            from: "node_modules",
            to: "node_modules",
            filter: paths.filter(file => file.startsWith("node_modules"))
                .map(file => file.substr(("node_modules" + sep).length))
        });
        console.info("[ModuleSink]: Discarded", this.#discarded, 
            "modules, keeping", this.#kept, "modules")
    }

    private canSink(name: string, path: string) {
        return !(name in this.#strategy) || !(this.#strategy[name].keep ?? 
            /^((.*\.([cm]js|js(on|x)?|node))|[^.]*)$/us).test(path);
    }

    private async resolvePackageDependencies(moduleDir: string, jsonPackageLocation: string, rootDir: string) {
        const jsonPackage = await readFile(resolve(join(moduleDir, jsonPackageLocation)), "utf8").then(JSON.parse) as JsonPackage;
        const files = [];
        const deps = {};
        let jsPath = moduleDir;
        if (moduleDir === rootDir) {
            this.#strategy[jsonPackage.name] = {}
            jsPath = resolve(join(jsPath, this.outputPath, this.sourcePath))
        }
        if (!jsonPackage.name || !jsonPackage.version) return;
        if (this.modules.has(jsonPackage.name)) {
            const mod = this.modules.get(jsonPackage.name);
            mod.files.forEach(file => file.location = file.location.replace(/(?<sep>\\|\/)node_modules\k<sep>(.*?)$/ui, `$0`));
            mod.main = mod.main.replace(/(?<sep>\\|\/)node_modules\k<sep>(.*?)$/ui, `$0`);
            return;
        }
        this.modules.set(jsonPackage.name, {
            files,
            uses: deps,
            main: resolve(join(jsPath, jsonPackage.main.match(/\.[cm]?js$/) ? 
                jsonPackage.main : jsonPackage.main.concat(".js")))
        })
        const listFiles = async (path: string): Promise<string[]> => {
            const dirs = await readdir(path, {
                withFileTypes: true
            });
            return Promise.all(dirs.filter(dir => dir.name !== "node_modules" && (path === rootDir ? 
                dir.name === this.sourcePath : !this.canSink(jsonPackage.name, relative(jsPath, resolve(join(path, dir.name))))))
                .map(async dir => dir.isDirectory() ? await listFiles(resolve(join(path, dir.name))) : [resolve(join(path, dir.name))]))
                .then(dirs => dirs.flat())
        }
        files.push(...(await listFiles(jsPath)).map(dir => ({
            location: dir,
            members: []
        })))
        const promises: Promise<string>[] = [];
        if (!!jsonPackage.dependencies)
            for (const dependency in jsonPackage.dependencies)
                promises.push(
                    this.resolvePackageDependencies(resolve(join(moduleDir, "node_modules", dependency)), "package.json", rootDir)
                        .catch(() => this.resolvePackageDependencies(resolve(join(rootDir, "node_modules", dependency)), "package.json", rootDir))
                        .catch(() => undefined))
        return Promise.all(promises).then(dependencies => {
            Object.assign(deps, Object.fromEntries(dependencies.filter(dep => !!dep).map(dep => [dep, []])))
            return jsonPackage.name;
        });
    }

    private async resolveUsage(moduleName: string) {
        const depChecker = /(?<!\/\/[^\r\n]*|\/\*(?:(?!\*\/).)*?)require\(\s*(?<type>["|'|`|])(.*?)\k<type>\s*\)/gusi
        const module = this.modules.get(moduleName)!!;
        const promises: Promise<any>[] = [];
        for (const jscript of module.files.filter(path => /\.(c?js)$/us.test(path.location))) {
            promises.push(readFile(jscript.location, "utf8").then(js => {
                for (const depInfo of js.matchAll(depChecker)) {
                    const [op,, location] = depInfo as [
                        DependencyDeclaration<DependencyDelimiter>,
                        DependencyDelimiter, string
                    ];
                    const importedNames = js.slice(depInfo.index + op.length).match(/^\.(\w+)/)?.[1] ?? 
                            ((givenName: string) => {
                                if (!!givenName) return null;
                                const names: Set<string> = new Set;
                                for (const match of js.matchAll(new RegExp(`(=\\s*)?${
                                    givenName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s*\\.\\s*([^\\s]*))?`, "gusi")))
                                    if (!!match[2]) names.add(match[2]); else if (!!match[1]) return null;
                                return [...names.values()] || null;
                            })(js.slice(0, depInfo.index).match(/(?=[^;,\(\)\{\}]*$)([^\s]+)\s(?:=\s*)$/usi)?.[1]);
                    if (location in module.uses!!) {
                        module.uses[location]!!.push(...!importedNames ? [] : typeof importedNames === "string" ? [importedNames] : importedNames)
                    } else {
                        const sibling = module.files.find(component => component.location === resolve(join(jscript.location, location)))
                        if (!!sibling) sibling.members.push(...(typeof importedNames === "string" ? [importedNames] : importedNames))
                    }
                }
            }))
        }
        return Promise.all(promises);
    }

    private async patchModules(appDir: string, thisName: string, target: Platform, arch: string) {
        const patchPromises: Promise<any>[] = [];
        for (const [name, module] of this.modules.entries()) {
            if (name !== thisName) patchPromises.push(readFile(module.main, "utf8").then(js => {
                const modulePromises: Promise<{
                    patch: string,
                    prop: string | typeof ModuleDefault,
                    declaration: [from: number, to: number][]
                }>[] = [];
                for (const member of js.matchAll(/(?<!\/\/[^\r\n]*|\/\*(?:(?!\*\/).)*?)(?<=(?:\W|^)module\.exports)(?:\.\w+)?(?=\s*=)/gusim)) {
                    const memberName = member[0]?.startsWith(".") ? member[0].substring(1) : ModuleDefault;
                    const declaration = [];
                    const match = js.substring(member.index + member[0].length).match(/^\s*=\s*((?<k>"|'|`).*?\k<k>|\w*\s*[(\{]?)/usmi);
                    
                    const findEndBound = (start: number, startChar: string, endChar: string) => {
                        let opened = 1, closed = 0, index = start;
                        while (opened > closed && index < js.length && index >= 0) {
                            const o = js.indexOf(startChar, index + 1),
                                c = js.indexOf(endChar, index + 1);
                            if (o !== -1 && o < c) opened++;
                            else closed++;
                            index = Math.min(c, o >= 0 ? o : js.length);
                        }
                        return index;
                    }

                    if (match[0].endsWith("(")) {
                        let end = findEndBound(member.index + member[0].length + match[0].length, "(", ")");
                        const func = js.substring(end).match(/^\s+(=>\s+)?\{/us);
                        if (!!func) end = findEndBound(end + 1 + func[0].length, "{", "}");
                        declaration.push([member.index + member[0].length + match[0].length - match[1].length, end + 1]);
                    } else if (match[0].endsWith("{")) {
                        let end = findEndBound(member.index + member[0].length + match[0].length, "{", "}");
                        declaration.push([member.index + member[0].length + match[0].length - match[1].length, end + 1]);
                    } else
                        declaration.push([member.index + member[0].length + match[0].length - match[1].length,
                            member.index + match[0].length]);
                    modulePromises.push((async () => this.#strategy[name].patch?.(
                        memberName,
                        target,
                        arch
                    ))().then(patch => !!patch ? ({
                        patch,
                        prop: memberName,
                        declaration
                    }) : null))
                }
                return Promise.all(modulePromises).then(patches => patches.filter(p => !!p)).then(async patches => {
                    if (patches.length > 0) {
                        console.warn("[ModuleSink]: Patching", name);
                        for (const patch of patches)
                            for (const declaration of patch.declaration) {
                                js = js.substring(0, declaration[0])
                                    + (patch.declaration.indexOf(declaration) === patch.declaration.length - 1 ? patch.patch : "")
                                    + js.substring(declaration[1])
                                patches.map(p => p.declaration).flat().forEach(pos => {
                                    pos.splice(0, 2, pos[0] > declaration[0] ? pos[0] + patch.patch.length + declaration[1] - declaration[0] : pos[0],
                                        pos[1] > declaration[1] ? pos[1] + patch.patch.length + declaration[1] - declaration[0] : pos[1])
                                })
                            }
                        const path = module.main.replace(/^(.*?)(?<sep>[\\/])node_modules\k<sep>.*?\k<sep>(.*)$/,
                            `$1$2${this.outputPath}$2${this.patchLocation}$2${name}$2$3`);
                        const location = relative(appDir, path)
                        await mkdir(resolve(location, '..'), { recursive: true });
                        await writeFile(path, js);
                        module.files.find(file => file.location === module.main).location = path;
                        module.main = path;
                    }
                })
            }))
        }
        return Promise.allSettled(patchPromises);
    }

}

type DependencyDeclaration<D extends DependencyDelimiter> = 
    `require(${D}${string}${D})`;
type DependencyDelimiter = '"' | '\'' | '`' | "";