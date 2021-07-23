import { Ripple } from "ripple";
import { Icon } from "icon";
import { createElement } from "structure/element";

export class AppNotification {

    /** @constant */
    public static readonly notificationClass = "notification";
    /** @constant */
    public static readonly notificationCollapsedClass = "collapsed";
    /** @constant */
    public static readonly notificationPendingClass = "pending";
    /** @constant */
    public static readonly notificationPrefixAttribute = "prefix";
    private static get container() {
        return document.getElementById('notif-holder') ?? 
        document.body.appendChild(createElement({id: 'notif-holder'}));
    }
    readonly #options!: AppNotification.NotificationController;
    readonly #timer!: number;
    readonly #element!: HTMLDivElement;

    constructor(options: AppNotification.NotificationController) {
        this.#element = createElement();
        this.#element["controller"] = this;
        this.#options = options;
        const initClass = this.#options.flags & AppNotification.Flags.STICK_TOP ? 
        AppNotification.notificationCollapsedClass : AppNotification.notificationPendingClass;
        this.#element.classList.add(
            AppNotification.notificationClass,
            initClass,
            ...options.flags & AppNotification.Flags.STYLE_RED ? ['red'] : []
        );
        const elementClose = createElement({classes: [
            'close',
            'center-flexed'
        ]});
        elementClose.setIcon(Icon.CLOSE);
        this.#element.appendChild(elementClose);
        this.content = options.content;
        this.prefix = options.prefix;
        const queue = AppNotification.container
            .querySelectorAll(`.${AppNotification.notificationClass}:not(.${
                AppNotification.notificationCollapsedClass}):not(.${
                    AppNotification.notificationPendingClass})`)
        if (queue.length > 7) ([...queue.values()]).find(an => an["controller"] instanceof AppNotification &&
            !(an["controller"].#options.flags & AppNotification.Flags.CANNOT_POP))?.["controller"]?.hide();
        if (this.#options.flags & AppNotification.Flags.STICK_TOP) AppNotification.container.prepend(this.#element)
        else AppNotification.container.append(this.#element);
        Ripple.apply(elementClose);
        requestAnimationFrame(() => this.#element.classList.remove(initClass))
        this.#timer = options.duration > 0 ? window.setTimeout(
            () => this.hide(), options.duration) : -1;
        this.#element.addEventListener('click', async event => {
            if (await options.onClick?.() === true) this.hide();
            event.stopImmediatePropagation();
        }, {
            passive: true
        })
        elementClose.addEventListener('click', () => this.hide());
    }

    public get content() {
        return this.#element.querySelector('.content')?.textContent;
    }

    public set content(content: string | Promise<string>) {
        const contentElement = this.#element.querySelector('.content');
        if (!contentElement) {
            this.#element.appendChild(createElement({
                classes: [
                    'content'
                ],
                text: content
            }))
        } else if (content instanceof Promise)
            content.then(txt => contentElement.textContent = txt);
        else contentElement.textContent = content;
    }

    public get prefix() {
        return this.#element.querySelector('.content')?.getAttribute(AppNotification.notificationPrefixAttribute);
    }

    public set prefix(value: string) {
        if (!!value) this.#element.querySelector('.content')?.setAttribute(
            AppNotification.notificationPrefixAttribute, value);
        else this.#element.querySelector('.content')?.removeAttribute(
            AppNotification.notificationPrefixAttribute);
    }

    public async hide() {
        if (!!this.#element?.parentElement) {
            return new Promise<void>(res => {
                requestAnimationFrame(() => {
                    const duration = parseInt((window.getComputedStyle(this.#element).transitionDuration ?? "0s")
                        .replace(/^([+-]?)(?:(\d+)((?:\.\d*)?)|()(\.\d+))\s*(m?)s$/, 
                        (...[, sign, int, decimal, unitPrefix]: string[]) => sign + int +
                        (unitPrefix === "m" ? decimal : `${decimal.slice(1, 4).padEnd(3, "0")}.${decimal.slice(4)}`)));
                    Promise.resolve(() => this.#options.onDismiss?.())
                        .then(func => func()).catch(console.error);
                    if (this.#timer !== undefined) clearTimeout(this.#timer);
                    this.#element.classList.add(AppNotification.notificationCollapsedClass);
                    setTimeout(() => {
                        res();
                    }, duration);
                });
            }).then(() => this.#element.remove())
        }
    }
}

export namespace AppNotification {
    export interface NotificationController {
        /**
         * The text content of the notification
         */
        readonly content: string | Promise<string>,
        /**
         * A text prefix to display at the top of the notification.
         * This is not a title and will not be displayed with a bigger
         * font size.
         */
        readonly prefix?: string,
        /** 
         * The lifetime in milliseconds (ms) of the notification
         * If negative or null, the notification will not be removed
         * automatically.
         * @default -1
         */
        readonly duration?: number,
        /**
         * Sets the behaviour of the notification
         * @default Type.REGULAR
         */
        readonly flags?: Flags | Type,
        /**
         * A callback to invoke when the notification is dismissed. There is no way to
         * cancel this event and it should never be cancelled (or it would result in a
         * poor user experience). A notification can be dismissed by the user himself
         * but also programatically, calling {@link AppNotification#hide}
         * You may update this property over the time to update the dismiss behaviour of
         * the current notification.
         * @default () => undefined
         */
        onDismiss?: (this: NotificationController) => void,
        /**
         * A callback to invoke when the notification is clicked. This method will NOT 
         * be called if the user clicks the close button of the notification. You can use
         * {@link NotificationController#onDismiss} to handle this action.
         * You may update this property over the time to update the click behaviour of
         * the current notification.
         * @returns whether the notification should hide after the operation
         * @default () => false
         */
        onClick?: (this: NotificationController) => boolean | Promise<boolean>
    }
    export enum Flags {
        NONE            = 0b0000,
        CANNOT_POP      = 0b0001,
        STYLE_RED       = 0b0010,
        STICK_TOP       = 0b0100
    }
    export enum Type {
        REGULAR = Flags.NONE,
        ERROR = Flags.CANNOT_POP | Flags.STYLE_RED
    }
}