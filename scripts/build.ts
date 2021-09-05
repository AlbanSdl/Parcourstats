// @ts-ignore
import { name, author } from "../../package.json";
import { rm } from "fs/promises";
import { JsonPackage, ModuleSink } from "./sink";
import { build, Configuration, Packager } from "app-builder-lib";
import { normalizeOptions } from "electron-builder/out/builder";
import { Metadata, SourceRepositoryInfo } from "electron-builder";
import { prepareResources, typescriptCompile, webpackCompile } from "./compile";

const production = !process.argv.includes("--debug") && !process.argv.includes("-d");
const shouldBuild = process.argv.includes("--build") || process.argv.includes("-b");

class SinkPackager extends Packager {
    #sink = new ModuleSink({
        modules: {
            "sqlite3": {
                keep: /^lib([\\/].*)?|\w+\.js(on)?$/,
                patch: (name, platform, arch, provider) => {
                    if (name === "package.json")
                        return provider().then(JSON.parse).then((pkg: JsonPackage) => {
                            delete pkg["binary"];
                            delete pkg["peerDependencies"];
                            delete pkg["peerDependenciesMeta"];
                            delete pkg["optionalDependencies"];
                            delete pkg.devDependencies;
                            delete pkg.scripts;
                            delete pkg.keywords;
                            delete pkg.dependencies;
                            return JSON.stringify(pkg);
                        })
                    if (/^lib[\\/]sqlite3-binding\.js$/.test(name))
                        return `module.exports = exports = require(\"./binding/napi-v3-${
                            platform.nodeName}-${arch}/node_sqlite3.node\");`
                }
            }
        }
    });

    public async _build(
        configuration: Configuration,
        metadata: Metadata,
        devMetadata: Metadata | null,
        repositoryInfo?: SourceRepositoryInfo
    ) {
        return super._build({
            ...configuration,
            extends: null,
            productName: name[0]?.toUpperCase() + name.slice(1),
            appId: `fr.asdl.${name}`,
            copyright: `Copyright © ${new Date().getFullYear()} ${author}`,
            publish: null,
            icon: "src/resources/icons/app-icon.png",
            nsis: {
                installerIcon: ".icon-ico/icon.ico",
                uninstallerIcon: ".icon-ico/icon.ico"
            },
            mac: {
                category: "public.app-category.education",
                icon: "src/resources/icons/app-icon.png",
                forceCodeSigning: false
            },
            linux: {
                icon: "src/resources/icons/app-icon.png"
            },
            directories: {
                output: this.#sink.outputPath,
                buildResources: this.#sink.outputPath
            },
            beforeBuild: async context => this.#sink.start(context).then(() => true),
            /*afterPack: async context => production && rm(join(context.appOutDir, "locales"), {
                recursive: true,
                force: true
            }),*/
            files: this.#sink.paths
        }, metadata, devMetadata, repositoryInfo)
    }
}

rm("build/src", {
    force: true,
    recursive: true
}).then(async () => Promise.all([
    typescriptCompile("src/main/tsconfig.json"),
    webpackCompile(production),
    prepareResources()
])).then(() => {
    if (shouldBuild) {
        const options = normalizeOptions({});
        build(options, new SinkPackager(options)).catch(console.error);
    }
}).catch(error => {
    Array.isArray(error) ? error.forEach(err => console.error(err)) : console.error(error);
    process.exit(1);
})