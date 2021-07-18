import type { Home } from "pstats/home";
import type { Adapter } from "components/adapter";
import { Icon } from "components/icon";
import { createElement } from "structure/element";
import { Query } from "../../../common/window";
import { Page } from "pstats/page";
import type { Formation } from "pstats/formation";

export class AboutFragment extends Page<Home, Adapter<Formation>> {
    protected readonly forceTransitionDirection = true;

    protected async onCreate(from: Page<Home, Adapter<Formation>>) {
        const root = await super.onCreate(from);
        root.classList.add("about", "loadable");
        root.toggleAttribute("loading", true)
        root.setIcon(Icon.LOADING).then(ic => ic.classList.add("loader"));
        
        const container = createElement({
            classes: ["container"],
            text: Promise.all([this.getLocale("app.settings.about"),
                this.getLocale("app.name")]).then(txt => txt.join(" "))
        });

        const thisApp = createElement({
            text: this.getLocale("app.settings.about.this")
        })
        const coreDeps = createElement({
            classes: ["deps", "core"],
            text: this.getLocale("app.settings.about.libs.core")
        })
        coreDeps.append(createElement({
            classes: ["separator"]
        }))
        const depsList = createElement({
            classes: ["deps"]
        })
        container.append(thisApp, coreDeps, createElement({
            classes: ["libhead"],
            title: this.getLocale("app.settings.about.libs"),
            text: this.getLocale("app.settings.about.libs.expl")
        }), depsList);
        root.append(container);
        return root;
    }
    protected onCreated(): void {
        this.root.toggleAttribute("loading", false);
        window.messenger.send(Query.CONTEXT).catch(async err => {
            console.error(err);
            const erroredVersion = await this.getLocale("app.settings.about.libs.unknown")
            return {
                appVersion: erroredVersion,
                electronVersion: erroredVersion,
                nodeJsVersion: erroredVersion,
                chromiumVersion: erroredVersion,
                dependencies: undefined as {
                    [name: string]: {
                        version: string;
                        description?: string;
                        author?: string;
                        license?: string;
                    };
                }
            }
        }).then(async context => {
            this.root.querySelector(".container").setAttribute("version", context.appVersion);
            this.root.querySelector(".container > .deps.core")?.append(createElement({
                tag: "div",
                name: "Electron",
                version: context.electronVersion
            }), createElement({
                tag: "div",
                name: "Chromium",
                version: context.chromiumVersion
            }), createElement({
                tag: "div",
                name: "NodeJS",
                version: context.nodeJsVersion
            }))
            if (!context.dependencies) {
                this.root.querySelector(".container > .deps:not(.core)").append(createElement({
                    classes: ["error"],
                    text: this.getLocale("app.settings.about.libs.error")
                }))
            } else {
                for (const name in context.dependencies) {
                    const lib = context.dependencies[name];
                    const wrapper = createElement({
                        classes: ["dep", "wrapper"]
                    });
                    wrapper.append(createElement({
                        classes: ["version"],
                        text: lib.version
                    }), createElement({
                        classes: ["name"],
                        text: name
                    }), createElement({
                        classes: ["desc"],
                        text: lib.description
                    }), createElement({
                        classes: ["author"],
                        text: lib.author
                    }), createElement({
                        classes: ["licence"],
                        text: lib.license
                    }));
                    this.root.querySelector(".container > .deps:not(.core)").append(wrapper);
                }
            }
        });
    }
    protected onDestroy(): void {
    }
    protected onDestroyed(): void {
    }
}