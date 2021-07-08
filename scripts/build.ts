import { ModuleDefault, ModuleSink } from "./sink";
import { build, Configuration, Packager } from "app-builder-lib";
// @ts-ignore
import { name, author } from "../../package.json";
import { normalizeOptions } from "electron-builder/out/builder";
import { Metadata, SourceRepositoryInfo } from "electron-builder";

class SinkPackager extends Packager {
    #sink = new ModuleSink({
        modules: {
            "sqlite3": {
                keep: /^lib([\\/]+.*)?|\w+\.js(on)?$/
            },
            "node-pre-gyp": {
                keep: /^package\.json|lib([\\/]+node-pre-gyp\.js)?$/,
                patch: (name, platform, arch) => name === ModuleDefault ? 
                `{find: () => \"node_modules/sqlite3/lib/binding/napi-v3-${platform.nodeName}-${arch}\"}` : "null"
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
                category: "public.app-category.education"
            },
            directories: {
                output: this.#sink.outputPath,
                buildResources: this.#sink.outputPath
            },
            beforeBuild: async context => this.#sink.start(context).then(() => true),
            files: this.#sink.paths
        }, metadata, devMetadata, repositoryInfo)
    }
}

const options = normalizeOptions({});
build(options, new SinkPackager(options)).catch(console.error);