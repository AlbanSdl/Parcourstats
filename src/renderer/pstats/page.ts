import type { Activity } from "structure/activity";
import { Fragment } from "structure/fragment";
import { Transition } from "structure/layout";
import { Overview } from "fragments/overview";

export abstract class Page<A extends Activity, D> extends Fragment implements Localizer {
    private dataProvider: () => Promise<D>;
    private localeProvider: (key: string) => Promise<string>;
    protected readonly forceTransitionDirection?: boolean;

    constructor(
        context?: A,
        container?: HTMLElement,
        data?: () => Promise<D>,
        locale?: (key: string) => Promise<string>
    ) {
        super();
        this.context = context;
        this.container = container;
        this.dataProvider = data;
        this.localeProvider = locale;
    }

    protected async onCreate(from?: Page<A, D>): Promise<HTMLDivElement> {
        if (!!from) {
            this.dataProvider = from.dataProvider;
            this.localeProvider = from.localeProvider;
        }
        return super.onCreate(from);
    }

    public async replace(fragment: Page<A, D>, transition = Transition.SLIDE) {
        return super.replace(fragment, transition, this.forceTransitionDirection ?? fragment instanceof Overview)
    }

    protected get data() {
        return this.dataProvider();
    }

    public async getLocale(key: string) {
        return this.localeProvider(key);
    }
}