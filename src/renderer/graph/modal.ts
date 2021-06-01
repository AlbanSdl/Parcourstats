import { Button, ButtonStyle } from "./button";
import { Factory } from "../structure/factory";
import { fadeInElement, fadeOutElement } from "./fade";
import { Ripple } from "./ripple";

interface ModalButton {
    readonly content: string
    readonly onclick: () => boolean
    readonly style: ButtonStyle
}

export class Modal {

    private content: string
    private title: string
    private classes: Array<string>
    private onDismiss: () => void
    private element: HTMLElement
    private buttonList: HTMLElement
    private actionBar: HTMLElement
    private writableActionBar: HTMLElement
    private contentContainer: HTMLElement
    private fadeElement: HTMLElement
    private buttons: Array<ModalButton>

    /**
     * Initializes a popup
     */
    public constructor() {
        this.content = "";
        this.title = "";
        this.classes = [];
        this.buttons = [];
    }

    /**
     * Sets the title of the popup
     * @param {string} title
     * @returns {this}
     */
    public setTitle(title: string): this {
        if (!!this.writableActionBar)
            this.writableActionBar.innerText = title
        this.title = title;
        return this;
    }
    
    public addButton(content: string, callback: () => boolean, style = ButtonStyle.FLAT | ButtonStyle.COMPACT): this {
        if (!!this.element && !!this.buttonList) {
            new Button(content, () => {
                if (callback()) this.hide()
            }, this.buttonList, style).element.style.marginRight = "10px"
        } else {
            this.buttons.push({onclick: callback, content: content, style: style});
        }
        return this
    }

    /**
     * Way to add classes
     * @param {string[]} classes
     */
    public addClasses(classes: string[]): this {
        this.classes.push(...classes)
        if (!!this.element) {
            this.element.classList.add(this.classes.join(' '));
        }
        return this;
    }

    /**
     * Sets the content of the popup (can be raw text of html)
     * @param {string} content
     * @returns {this}
     */
    public setContent(content: string): this {
        this.content = content;
        if (!!this.contentContainer)
            this.contentContainer.innerHTML = content;
        return this;
    }

    /**
     * Sets the callback called when the popup is dismissed
     * @param callback
     * @returns {this}
     */
    public setOnDismiss(callback: () => void): this {
        this.onDismiss = callback;
        return this;
    }

    /**
     * Displays the current popup
     */
    public display(content?: HTMLElement) {
        if (!!this.element)
            return console.error("Modal already displayed.")
        
        this.element = Factory.get().addClass('modal').toElement()

        // ActionBar
        this.actionBar = Factory.get().addClass('actionbar').toElement()
        this.writableActionBar = Factory.get().addClass('writable').toElement()
        this.writableActionBar.innerText = this.title
        this.actionBar.appendChild(this.writableActionBar)
        this.element.appendChild(this.actionBar)

        // Content container
        this.contentContainer = Factory.get().addClass('container').toElement();
        this.contentContainer.append(content ?? this.content)
        this.element.appendChild(this.contentContainer)

        document.body.appendChild(this.element);
        fadeInElement(this.element, 400);

        // ActionBar close button
        const closeButton = Factory.get().addClass('close').toElement()
        Ripple.apply(closeButton);
        this.actionBar.appendChild(closeButton);
        closeButton.addEventListener('click', () => {
            this.hide();
        });

        // Button list
        this.buttonList = Factory.get().addClass('actionlist').toElement()
        this.element.appendChild(this.buttonList)
        
        // Faded background
        this.fadeElement = Factory.get().addClass('mask').toElement()
        this.fadeElement.addEventListener('click', () => {
            this.hide();
        });
        document.body.appendChild(this.fadeElement);
        fadeInElement(this.fadeElement, 400, 0.8);

        // Adds buttons
        for (const meta of this.buttons)
            this.addButton(meta.content, meta.onclick, meta.style)
    }

    /**
     * Hides the current popup (and deletes it)
     */
    public hide() {
        if (!!this.element && !!this.fadeElement) {
            fadeOutElement(this.fadeElement, 500, true);
            fadeOutElement(this.element, 500, true);
            if (!!this.onDismiss)
                this.onDismiss();
        }
    }
}