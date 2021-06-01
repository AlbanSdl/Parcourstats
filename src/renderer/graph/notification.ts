import { fadeInElement, fadeOutElement } from "./fade";
import { Ripple } from "./ripple";
import { Factory } from "../structure/factory";
import { Icon } from "./icon";

const notifQueue = {};
const notifQueueTimed: Array<number> = [];

export class AppNotification {

    private content: string
    private readonly duration: number
    private readonly id: number
    private readonly classes: Array<string>
    private onDismiss: () => void
    private readonly element: HTMLElement
    private readonly elementClose: HTMLElement
    private readonly notificationTimer: number

    /**
     * Initializes a notification
     * @param {string} content the text to display in the notification
     */
    constructor(content: string, duration = 2000, extraClasses: Array<string> = [], onDismiss = () => {}) {
        this.content = content;
        this.duration = duration;
        while (!this.id || Object.keys(notifQueue).includes(this.id.toString()))
            this.id = Math.floor(Math.random() * 1000);
        notifQueue[this.id] = this
        this.classes = extraClasses;
        this.onDismiss = onDismiss;
        
        // Create notification
        this.element = Factory.get().addClass('notification', ...this.classes).setId(`notification-${this.id}`).toElement()
        this.elementClose = Factory.get().addClass('close', 'center-flexed').toElement()
        this.elementClose.addIcon(Icon.CLOSE);
        this.element.appendChild(this.elementClose)
        const notifContent = Factory.get().addClass('content').toElement()
        notifContent.innerText = this.content
        this.element.appendChild(notifContent)
        if (notifQueueTimed.length > 7) notifQueue[notifQueueTimed[0]].hide();
        notifQueueTimed.push(this.id);
        notifQueue[this.id] = this;
        this.findHolder().appendChild(this.element);
        fadeInElement(this.element, 200);
        Ripple.apply(this.elementClose);
        if (this.duration > 0)
            this.notificationTimer = window.setTimeout(() => this.hide(), this.duration);
        this.elementClose.addEventListener('click', () => {
            this.hide();
            clearTimeout(this.notificationTimer);
        });
    }

    /**
     * Sets the content of the notification (text)
     * @param {string} content 
     * @returns {this}
     */
    public setContent(content: string): this {
        this.content = content;
        (<HTMLElement>this.element.getElementsByClassName('content')[0]).innerText = content;
        return this;
    }

    /**
     * Sets the callback called when the notification is dismissed
     * @param callback
     * @returns {this}
     */
    public setOnDismiss(callback: () => void): this {
        this.onDismiss = callback;
        return this;
    }

    private findHolder(): HTMLElement {
        const legacy = document.getElementById('notif-holder')
        if (!!legacy) return legacy
        const holder = Factory.get().setId('notif-holder').toElement()
        document.body.appendChild(holder)
        return holder
    }

    /**
     * Hides the current notification (and deletes it)
     */
    public hide() {
        if (this.id !== null && document.getElementById(`notification-${this.id}`) === this.element) {
            notifQueueTimed.splice(notifQueueTimed.indexOf(this.id), 1);
            delete notifQueue[this.id];
            fadeOutElement(this.element, 200, true, true);
            if (this.onDismiss !== null)
                this.onDismiss();
        }
    }

}