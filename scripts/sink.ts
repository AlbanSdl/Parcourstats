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
     * A method to patch a module file.
     * @returns a false evaluatable value to keep the file as is (eg. false or "" or null)
     *          or javascript code (as string) which will replace current implementation.
     */
    patch?: (
        path: string,
        platformTarget: Platform,
        archTarget: string,
        retrieve: () => Promise<string>,
    ) => Promisable<null | undefined | false | string>;
}

export interface JsonPackage {
    name: string,
    version: string,
    description: string,
    main: string,
    dependencies?: {
        [name: string]: string;
    },
    devDependencies?: {
        [name: string]: string;
    },
    bin?: any,
    jshintConfig?: any,
    keywords?: any,
    scripts?: any
}

export type ModuleSinkStrategy = MappedDeps<ModuleSinkRule>;
export type ModuleDependencies = MappedDeps<string>;

export class ModuleSink {
    #strategy!: ModuleSinkStrategy;
    public readonly paths: (FileSet | string)[] = [];
    public readonly outputPath!: string;
    public readonly sourcePath!: string;
    public readonly patchLocation: string = "patches";
    private readonly jsonPackageLocation!: `${string}package.json`;
    private readonly modules: Map<string, string[]> = new Map;

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
        const thisName = await this.resolvePackageDependencies(context.appDir, this.jsonPackageLocation, context.appDir).catch(() => {
            throw new Error(`Cannot find package.json. Ensure jsonPackageLocation is correct in ModuleSinkOptions`)
        })
        await this.patchModules(context.appDir, thisName, context.platform, context.arch);
        const appModule = this.modules.get(thisName);
        const paths = [...this.modules.values()].filter(module => module !== appModule)
            .map(module => module.map(file => relative(context.appDir, file))).flat();
        this.paths.unshift({
            from: resolve(this.outputPath, this.sourcePath),
            to: "",
            filter: appModule.map(file => relative(resolve(
                context.appDir, this.outputPath, this.sourcePath), file))
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
    }

    private canSink(name: string, path: string) {
        return !(name in this.#strategy) || !(this.#strategy[name].keep ?? 
            /^((.*\.([cm]js|js(on|x)?|node))|[^.]*)$/us).test(path);
    }

    private async resolvePackageDependencies(moduleDir: string, jsonPackageLocation: string, rootDir: string) {
        const jsonPackage = await readFile(resolve(join(moduleDir, jsonPackageLocation)), "utf8").then(JSON.parse) as JsonPackage;
        const files = [];
        let jsPath = moduleDir;
        if (moduleDir === rootDir) {
            this.#strategy[jsonPackage.name] = {}
            jsPath = resolve(join(jsPath, this.outputPath, this.sourcePath))
        }
        if (!jsonPackage.name || !jsonPackage.version) return;
        if (this.modules.has(jsonPackage.name)) {
            this.modules.get(jsonPackage.name).map(file => 
                file.replace(/(?<sep>[\\/])node_modules\k<sep>(.*?)$/ui, `$0`));
            return;
        }
        this.modules.set(jsonPackage.name, files)
        const listFiles = async (path: string): Promise<string[]> => {
            const dirs = await readdir(path, {
                withFileTypes: true
            });
            return Promise.all(dirs.filter(dir => dir.name !== "node_modules" && (path === rootDir ? dir.name === this.sourcePath : 
                moduleDir === rootDir ? true : !this.canSink(
                    jsonPackage.name, relative(jsPath, resolve(join(path, dir.name))))))
                .map(async dir => dir.isDirectory() ? await listFiles(resolve(join(path, dir.name))) : [resolve(join(path, dir.name))]))
                .then(dirs => dirs.flat())
        }
        files.push(...await listFiles(jsPath))
        const promises: Promise<string>[] = [];
        if (!!jsonPackage.dependencies)
            for (const dependency in jsonPackage.dependencies)
                promises.push(
                    this.resolvePackageDependencies(resolve(join(moduleDir, "node_modules", dependency)), "package.json", rootDir)
                        .catch(() => this.resolvePackageDependencies(resolve(join(rootDir, "node_modules", dependency)), "package.json", rootDir))
                        .catch(() => undefined))
        return Promise.all(promises).then(() => jsonPackage.name);
    }

    private async patchModules(appDir: string, thisName: string, target: Platform, arch: string) {
        const patchPromises: Promise<{name: string, file: string, patch: string | false | null} | undefined>[] = [];
        for (const [name, module] of this.modules.entries()) {
            if (name !== thisName) for (const file of module) {
                patchPromises.push((async () => ({
                    name,
                    file,
                    patch: await this.#strategy[name].patch?.(
                        relative(resolve(join(appDir, "node_modules", name)), file),
                        target,
                        arch,
                        () => readFile(file, "utf8"),
                    )
                }))())
            }
        }
        return Promise.all(patchPromises).then(async patches => { for (const patch of patches) {
            if (!patch.patch) continue;
            const path = patch.file.replace(/^(.*?)(?<sep>[\\/])node_modules\k<sep>.+?\k<sep>(.*)$/,
                `$1$2${this.outputPath}$2${this.patchLocation}$2${patch.name}$2$3`);
            await mkdir(resolve(relative(appDir, path), '..'), { recursive: true });
            await writeFile(path, patch.patch);
            const target = this.modules.get(patch.name);
            target.splice(target.indexOf(patch.file), 1, path);
        }})
    }
}