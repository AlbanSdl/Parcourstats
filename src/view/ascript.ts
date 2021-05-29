export namespace Ascript {

    /**
     * This interface denotes that the object can be sent to the user and will appear
     * on the screen. A such object can be dismissed at any time.
     */
    interface Sendable {

        /**
         * Displays the element on the screen with the chosen properties
         */
        send(): void

        /**
         * Remove the element from the screen, removing itself at the end
         * of its vanishing animation
         */
        dismiss(): void

    }

    const localeStrings: Array<Array<string>> = [
        ["Erreur ", "Error "],
        ["Une erreur s'est produite... Les données n'ont pas pu être envoyées: ", "An error occurred... Data has not been sent: "],
        ["Connexion interrompue", "Connection lost"],
        ["Il n'y a pas d'élément .notif ! Ajoute en avec Ascript.Notification.send()", "No such element .notif ! Summon some notification with Ascript.Notification.send() before…"],
        ["Élément copié !", "Copied item !"],
        ["Impossible d'afficher le graphique à cause de votre navigateur...", "Unable to display chart because of your browser..."],
        ["La notification a déjà été envoyée !", "Notification already sent !"],
        ["Impossible de changer la durée de la notification", "Unable to change notification's duration"],
        ["Impossible de changer le callback de la notification", "Unable to change notification's callback"],
        ["La popup est déjà affichée !", "Popup already displayed !"],
        ["Impossible de changer le callback de la popup", "Unable to change popup's callback"]
    ];

    export enum AppStringId {
        ERROR = 0,
        ERROR_DATA_NOT_SENT = 1,
        CONNECTION_LOST = 2,
        NO_SUCH_NOTIFICATION_ERROR = 3,
        CLIPBOARD_COPIED = 4,
        UNABLE_TO_DISPLAY_CHART = 5,
        NOTIFICATION_ALREADY_SENT = 6,
        NOTIFICATION_ERROR_DURATION = 7,
        NOTIFICATION_ERROR_DISMISS = 8,
        POPUP_ALREADY_SENT = 9,
        POPUP_ERROR_DISMISS = 10
    }

    export enum Locale {
        FR = 0,
        EN = 1
    }

    let appLocale: Ascript.Locale = Ascript.Locale.EN;
    const notifQueue: Map<number, Notification> = new Map();
    const notifQueueTimed: Array<number> = new Array();
    export const imageLazyLoading: Array<number> = new Array();

    /************
     * Language *
     ************/
    /**
     * Sets the language of the script
     * @param locale {Ascript.LOCALE}
     */
    export function setLocale(locale: Ascript.Locale): void {
        appLocale = locale;
    };

    export function getLocaleString(id: AppStringId): string {
        try {
            return localeStrings[id][appLocale]
        } catch (e) {
            appLocale = Ascript.Locale.EN;
            return Ascript.getLocaleString(id)
        }
    };

    /*********************
     * XML HTTP REQUESTS *
     *********************/

    /**
     * Sends a XHR {@link XMLHttpRequest}
     * @param method the method of the request ('GET' or 'POST' basically)
     * @param data the data you want to send with this request. Can be empty
     * @param url the url where your request should go
     * @param onSuccess the callback function which will be called if the request is successfully delivered
     * @param onError the callback function which will be called if an error occurs
     * @param onAbort the callback function which will be called if the request is cancelled (can be undefined)
     */
    export function xmlRequest(method: 'POST' | 'GET', data: string, url: string, onSuccess: (req: XMLHttpRequest) => any,
        onError: (req: XMLHttpRequest) => any, onAbort: (req: XMLHttpRequest) => any = () => { }): void {
        let request = new XMLHttpRequest();
        if (method === 'GET') {
            url += "?" + data;
            data = null;
        }
        request.open(method, url, true);
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        request.onload = () => {
            onSuccess(request);
        };
        request.onerror = () => {
            onError(request);
        };
        request.onabort = () => {
            onAbort(request);
        };
        request.send(data);
    };

    /**
     * Validates a form and calls a XHR {@link Ascript.xmlRequest} : no page refresh
     * @param data, the data you want to send with this request. Can be empty
     * @param submitPageUrl, the url where your request should go
     * @param callback, the callback function which will be called
     */
    export function sendForm(data: string, submitPageUrl: string, callback: (res: string) => any): void {
        Ascript.xmlRequest('POST', data, submitPageUrl, (request) => {
            if (request.status >= 200 && request.status < 400) {
                callback(request.response);
            } else {
                let error = Ascript.getLocaleString(AppStringId.ERROR) + request.status;
                if (request.response) error += ': ' + request.response;
                new Ascript.Notification(Ascript.getLocaleString(AppStringId.ERROR_DATA_NOT_SENT) + error).send();
            }
        }, (request) => {
            const error = request.response == "" ? Ascript.getLocaleString(AppStringId.CONNECTION_LOST) : request.response;
            new Ascript.Notification(Ascript.getLocaleString(AppStringId.ERROR_DATA_NOT_SENT) + error).send();
        });
    };

    /**
     * Creates a request for an upload
     * @param inputFile {HTMLInputElement} the input element where the file is uploaded
     * @param uploadPageUrl {string} the url where the file will be output
     * @param startCallback {function} the callback which is called when the uploads begins
     * @param progressCallback {function} the callback which is called each time the upload's progress changes
     * @param completedCallback {function} the callback which is called when the upload is finished
     * @param errorCallback {function} the callback which is called when the upload fails or is aborted
     */
    export function uploadFile(inputFile: HTMLInputElement, uploadPageUrl: string, startCallback: () => any,
        progressCallback: (pct: number) => any, completedCallback: (str: string) => any, errorCallback: (str: string) => any): void {
        startCallback();
        let fd = new FormData();
        fd.append("file", inputFile.files[0]);
        let xhr = new XMLHttpRequest();
        xhr.open('POST', uploadPageUrl, true);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                progressCallback((e.loaded / e.total) * 100)
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 400) {
                completedCallback(xhr.response)
            } else {
                errorCallback(xhr.response)
            }
        };
        xhr.onerror = () => {
            errorCallback(xhr.response);
        };
        xhr.send(fd);
    };


    /**
     * Fades out an element
     * The element can even be deleted at the end of the animation (@param deletion)
     * Does the same think as {@link Ascript.hideElement} but animated
     * @type {string}
     */
    export function fadeOutElement(elem: HTMLElement, deletion: boolean = false, height: boolean = false, duration: number = .5): void {

        if ((<any>elem).fadeTimeout != null)
            clearTimeout((<any>elem).fadeTimeout);

        elem.style.opacity = '1';
        if (!elem.classList.contains('show')) {
            elem.classList.add('show');
        }
        elem.style.transition = `all ${duration}s ease-in-out`;
        elem.style.opacity = '0';

        if (height) {
            elem.style.zIndex = (elem.style.zIndex !== "" ? (parseInt(elem.style.zIndex) - 1).toString() : '0');
            elem.style.maxHeight = elem.style.minHeight = window.getComputedStyle(elem).getPropertyValue('height');
            // IMPORTANT FIX : don't count margin-top as it will be removed at the end.
            elem.style.marginTop = -(parseInt(window.getComputedStyle(elem).getPropertyValue('margin-bottom').slice(0, -2))
                + parseInt(window.getComputedStyle(elem).getPropertyValue('padding-top').slice(0, -2))
                + parseInt(window.getComputedStyle(elem).getPropertyValue('padding-bottom').slice(0, -2))
                + parseInt(window.getComputedStyle(elem).getPropertyValue('height').slice(0, -2))) + "px";
        }

        (<any>elem).fadeTimeout = setTimeout(() => {
            if (deletion) {
                if (elem.parentElement != null)
                    elem.parentElement.removeChild(elem);
            } else if (elem.style.opacity === '0') {
                elem.style.visibility = 'hidden';
                elem.style.display = 'none';
            }
        }, 800);
    };

    /**
     * Fades in an element
     * Does the same think as {@link Ascript.showElement} but animated
     * @type {string}
     */
    export function fadeInElement(elem: HTMLElement, max: string = '1', duration: number = .5, display: string = '', height: boolean = false): void {

        if ((<any>elem).fadeTimeout != null)
            clearTimeout((<any>elem).fadeTimeout);

        elem.style.transition = `all ${duration}s ease-in-out`;
        elem.style.display = display;
        elem.style.visibility = 'visible';
        elem.style.opacity = '0';
        (<any>elem).fadeTimeout = setTimeout(() => {
            if (!elem.classList.contains('show')) {
                elem.classList.add('show');
            }
            if (height) {
                elem.style.zIndex = (elem.style.zIndex !== "" ? (parseInt(elem.style.zIndex) + 1).toString() : '1');
                elem.style.marginTop = '0px';
            }
            elem.style.opacity = max;
        }, 10)
    };

    /**
     * Fades out the element and fades in another element at the same location
     * IMPORTANT : the initial height has to be calculated by the browser.
     * So it needs the hidden element to be displayed once before any animation
     * @param elementIn {HTMLElement} the element which will be faded in
     * @param elementOut {HTMLElement} the element which will be replaced by elementIn
     * @param duration {Number} the duration of the animation
     * @param finalOpacity {Number} the final opacity of the elementIn
     */
    export function crossFade(elementIn: HTMLElement, elementOut: HTMLElement, duration: number, finalOpacity: number = 1): void {
        if (elementIn.style.height === '0px' || elementOut.style.height === '0px')
            return;
        const heightIn = window.getComputedStyle(elementIn).getPropertyValue('height').slice(0, -2),
            marginInTop = window.getComputedStyle(elementIn).marginTop, marginInBottom = window.getComputedStyle(elementIn).marginBottom,
            paddingInTop = window.getComputedStyle(elementIn).paddingTop, paddingInBottom = window.getComputedStyle(elementIn).paddingBottom,
            heightOut = window.getComputedStyle(elementOut).getPropertyValue('height').slice(0, -2),
            marginOutTop = window.getComputedStyle(elementOut).marginTop, marginOutBottom = window.getComputedStyle(elementOut).marginBottom,
            paddingOutTop = window.getComputedStyle(elementOut).paddingTop, paddingOutBottom = window.getComputedStyle(elementOut).paddingBottom;
        Object.assign(elementIn.style, {
            opacity: '0', display: 'block', height: '0px', transition: `all ${duration}s ease 0s`,
            marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', visibility: 'visible'
        });
        Object.assign(elementOut.style, { transition: `all ${duration}s ease 0s` });
        setTimeout(() => {
            Object.assign(elementIn.style, {
                opacity: finalOpacity, height: `${heightIn}px`, marginTop: marginInTop,
                marginBottom: marginInBottom, paddingTop: paddingInTop, paddingBottom: paddingInBottom
            });
            Object.assign(elementOut.style, {
                opacity: '0', height: '0px', marginTop: '0px', marginBottom: '0px',
                paddingTop: '0px', paddingBottom: '0px'
            });
            setTimeout(() => {
                Object.assign(elementOut.style, {
                    display: 'none', height: `${heightOut}px`, marginTop: marginOutTop,
                    marginBottom: marginOutBottom, paddingTop: paddingOutTop, paddingBottom: paddingOutBottom
                })
            }, duration * 1000)
        }, 10)
    };

    /**
     * Hides an element
     * @type {string}
     * @param elem {HTMLElement}
     */
    export function hideElement(elem: HTMLElement): void {
        elem.style.visibility = 'hidden';
        elem.style.display = 'none';
    };

    /**
     * Shows an element
     * @type {string}
     * @param elem {HTMLElement}
     */
    export function showElement(elem: HTMLElement): void {
        elem.style.display = '';
        elem.style.visibility = 'visible';
        if (elem.style.opacity === '0') {
            elem.style.opacity = '1';
        }
    };


    /**
     * Returns the CSS property without the measure (px or % (you can ask devs for more types))
     * @type {string | void | *}
     * @return {number}
     */
    export function getRawProperty(property: string): number {
        const replaced = property.replace('px', '').replace('%', '');
        return replaced === '' ? 0 : parseInt(replaced);
    };

    /**
     * Returns a random int between 0 and the value given
     * @return {number}
     */
    export function getRandomInteger(max: number): number {
        return Math.floor(Math.random() * max);
    };

    /**
     * STYLING : Adds ripple animation style to item (eg buttons)
     * Adds a ripple animation on click to the current element
     * @param elem
     */
    export function addRippleListener(elem: HTMLElement): void {
        elem.style.overflow = 'hidden';
        elem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            let div = document.createElement('div');
            const btnOffset = elem.getBoundingClientRect();
            div.classList.add('rpl-effect');
            Object.assign(div.style, {
                position: 'absolute', borderRadius: '50%', width: '50px', height: '50px',
                background: '#2287fa', animation: 'rpl-animation 2s', pointerEvents: 'none'
            });
            let xPos = e.pageX - (btnOffset.left + (document.documentElement.scrollLeft !== null ? document.documentElement.scrollLeft : document.body.scrollLeft)),
                yPos = e.pageY - (btnOffset.top + (document.documentElement.scrollTop !== null ? document.documentElement.scrollTop : document.body.scrollTop));
            div.style.top = (yPos - 25) + 'px';
            div.style.left = (xPos - 25) + 'px';
            div.style.display = 'block';
            div.style.zIndex = (elem.style.zIndex !== '' ? parseInt(elem.style.zIndex) + 1 : 1).toString();
            div.style.background = elem.getAttribute('data-rpl');
            elem.appendChild(div);
            setTimeout(() => {
                try {
                    div.parentElement.removeChild(div);
                } catch (e) {
                }
            }, 2000);
        });
    };

    /**
     * Adds a ripple to all element of a given class
     * @param className
     */
    export function initRipple(className: string = 'rpl'): void {
        [].forEach.call(document.getElementsByClassName(className), (elem: HTMLElement) => { Ascript.addRippleListener(elem) });
    };

    export function tooltip(elem: HTMLElement, content: string, parent?: HTMLElement): void {
        const span = document.createElement("span");
        span.classList.add('tooltip')
        span.innerText = content;
        span.style.opacity = "0";

        elem.addEventListener('mouseenter', () => {
            elem.appendChild(span);
            fadeInElement(span, "1", .2);
        });
        elem.addEventListener('mouseleave', () => {
            fadeOutElement(span, true, false, .2);
        });

        if (parent != null)
            parent.addEventListener('dragstart', () => {
                span.style.display = "none";
            });
    }

    /**
     * Creates a svg chart with given dataset. The chart takes the width of the elementParent
     * @param elementParent {HTMLElement} the element in which the chart will be output
     * @param dataset {Object} the data which will be displayed in the chart
     * @param id {String} the id of the chart element
     * @param lineColor {String} the color of the line
     * @param heightRatio {Number} the height will be the width multiplied by this coefficient
     * @param gridColor {String} the color of the axes
     */
    export function createChart(elementParent: HTMLElement, dataset: any, id: string, lineColor: string, heightRatio: number, gridColor: string = "#ffffff"): void {
        const dataKeys = <any>Object.keys(dataset);
        if (dataKeys.length === 0)
            return;
        let highestPoint = 0;
        for (let i in dataKeys) {
            if (dataset[i] > highestPoint)
                highestPoint = dataset[i];
        }
        const width = parseInt(window.getComputedStyle(elementParent).width.slice(0, -2));
        const height = heightRatio * width;
        const scaleX = (width - 30) / dataKeys[dataKeys.length - 1];
        const scaleY = (height - 30) / highestPoint;
        const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chart.id = id;
        chart.innerHTML = `
            <line x1="15" y1="${height - 15}" x2="${width - 15}" y2="${height - 15}" style="stroke:${gridColor};stroke-width:1"/>
            <line x1="15" y1="15" x2="15" y2="${height - 15}" style="stroke:${gridColor};stroke-width:1"/>
            ${Ascript.getLocaleString(AppStringId.UNABLE_TO_DISPLAY_CHART)}
        `;
        let latestPoint: any;
        Object.keys(dataset).forEach(function (x) {
            chart.innerHTML += `<circle cx="${15 + scaleX * parseInt(x)}" cy="${height - 15 - parseInt(dataset[x]) * scaleY}" r="3" stroke="${lineColor}" stroke-width="1" fill="${gridColor}"/>`;
            if (latestPoint != null)
                chart.innerHTML += `<line x1="${15 + scaleX * latestPoint[0]}" y1="${height - 15 - scaleY * latestPoint[1]}" x2="${15 + scaleX * parseInt(x)}" y2="${height - 15 - scaleY * parseInt(dataset[x])}" stroke-width="1" stroke="${lineColor}"/>`;
            latestPoint = [parseInt(x), parseInt(dataset[x])];
        });
        let scaleSysX = 0, scaleSysY = 0;
        while (scaleSysX <= width - 30) {
            chart.innerHTML += `<text x="${10 + scaleSysX}" y="${height}" font-family="sans-serif" font-size="10px" fill="${gridColor}">${scaleSysX / scaleX > 10 ? Math.round(scaleSysX / scaleX) : Math.round(scaleSysX / scaleX * 100) / 100}</text>`;
            scaleSysX += scaleX * dataKeys[dataKeys.length - 1] / 10
        }
        while (scaleSysY <= height - 30) {
            chart.innerHTML += `<text x="0" y="${height - 10 - scaleSysY}" font-family="sans-serif" font-size="10px" fill="${gridColor}">${scaleSysY / scaleY > 10 ? Math.round(scaleSysY / scaleY) : Math.round(scaleSysY / scaleY * 100) / 100}</text>`;
            scaleSysY += scaleY * highestPoint / 10
        }
        chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
        chart.setAttribute('preserveAspectRatio', 'xMinyMin meet');
        elementParent.appendChild(chart);
    }

    export class Notification implements Sendable {

        private content: string;
        private duration: number;
        private background: string;
        private textColor: string;
        private id: number | null;
        private classes: Array<string>;
        private onDismiss: Function;
        private elemNotif: HTMLDivElement | null;
        private notifTimer: NodeJS.Timeout | null;

        /**
         * Initializes a notification
         * @param content {String} the text or HTML displayed in the notification
         */
        constructor(content: string) {
            this.content = content;
            this.duration = 2000;
            this.background = '#222';
            this.textColor = '#fff';
            this.id = null;
            this.classes = [];
            this.onDismiss = null;
            this.elemNotif = null;
            this.notifTimer = null;
        }

        /**
         * Sets the duration of the notification (before being dismissed)
         * @param duration {Number}
         * @returns {Ascript.Notification}
         */
        public setDuration(duration: number): Notification {
            if (this.elemNotif !== null)
                console.error(Ascript.getLocaleString(AppStringId.NOTIFICATION_ALREADY_SENT) +
                    " " + Ascript.getLocaleString(AppStringId.NOTIFICATION_ERROR_DURATION));
            this.duration = duration;
            return this;
        }

        /**
         * Way to add classes
         * @param classes {Array}
         */
        public addClasses(classes: Array<string>): Notification {
            if (classes.length === 0)
                return this;
            this.classes = [].push.apply(this.classes, classes);
            if (this.elemNotif !== null) {
                this.elemNotif.classList.add(this.classes.join(' '));
            }
            return this;
        }

        /**
         * Sets the background color of the notification
         * @param color {String}
         * @returns {Ascript.Notification}
         */
        public setBackground(color: string): Notification {
            this.background = color;
            if (this.elemNotif !== null)
                this.elemNotif.style.backgroundColor = this.background;
            return this;
        }

        /**
         * Sets the font's color in the notification
         * @param color {String}
         * @returns {Ascript.Notification}
         */
        public setTextColor(color: string): Notification {
            this.textColor = color;
            if (this.elemNotif !== null)
                this.elemNotif.style.color = this.textColor;
            return this;
        }

        /**
         * Sets the content of the notification (can be raw text of html)
         * @param content {String}
         * @returns {Ascript.Notification}
         */
        public setContent(content: string): Notification {
            this.content = content;
            if (this.elemNotif !== null)
                this.elemNotif.getElementsByClassName('notif-content')[0].innerHTML = content;
            return this;
        }

        /**
         * Sets the callback called when the notification is dismissed
         * @param callback
         * @returns {Ascript.Notification}
         */
        public setOnDismiss(callback: () => {}): Notification {
            if (this.elemNotif !== null)
                console.error(Ascript.getLocaleString(AppStringId.NOTIFICATION_ALREADY_SENT) +
                    " " + Ascript.getLocaleString(AppStringId.NOTIFICATION_ERROR_DISMISS));
            this.onDismiss = callback;
            return this;
        }

        /**
         * Sends the current notification
         */
        public send(): void {
            // Sets the id of the notification
            this.id = Ascript.getRandomInteger(1000);
            while (Array.from(notifQueue.keys()).includes(this.id))
                this.id = Ascript.getRandomInteger(1000);
            // Adds notif-holder if not already set
            if (!document.getElementById('notif-holder')) {
                let elem = document.createElement('div');
                elem.id = 'notif-holder';
                Object.assign(elem.style, {
                    maxWidth: '300px', width: '80%', position: 'fixed', display: 'block', right: '5%',
                    zIndex: '1000', top: '50px', height: '100%', pointerEvents: 'none'
                });
                document.getElementsByTagName('body')[0].appendChild(elem);
            }
            // Creation of the notification
            this.elemNotif = document.createElement('div');
            if (this.classes.length !== 0) {
                this.elemNotif.classList.add('notif', this.classes.join(' '));
            } else {
                this.elemNotif.classList.add('notif');
            }
            this.elemNotif.id = this.id.toString();
            this.elemNotif.innerHTML = "<div class=\"notif-close rpl smooth no-shadow\" style=\"position:relative;flex-shrink:0;border-radius:50%;width:50px;height:50px;display:block;cursor:pointer;z-index:100\" data-rpl=\"#eee\"><div style='position:relative'>" +
                "<div style='top:15.5px;left:16px;display:block;position:absolute;height:2px;width:50%;background:#fff;border-radius:10px;transform-origin:center left;transform:rotate(45deg)'></div>" +
                "<div style='top:33px;left:16px;display:block;position:absolute;height:2px;width:50%;background:#fff;border-radius:10px;transform-origin:center left;transform:rotate(-45deg)'></div></div></div><div class='notif-content' style='hyphens:auto;width:100%'>" + this.content + "</div>";
            Object.assign(this.elemNotif.style, {
                position: 'relative', display: 'flex', textAlign: 'center', color: this.textColor, fontSize: '20px',
                top: '5px', width: 'auto', maxWidth: '300px', backgroundColor: this.background, padding: '10px', paddingRight: '5px', borderRadius: '2px', zIndex: '10000',
                marginTop: '10px', minHeight: '50px', pointerEvents: 'all', alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row-reverse'
            });
            if (notifQueueTimed.length > 7)
                notifQueue.get(notifQueueTimed[0]).dismiss();
            notifQueueTimed.push(this.id);
            notifQueue.set(this.id, this);
            document.getElementById('notif-holder').appendChild(this.elemNotif);
            Ascript.fadeInElement(this.elemNotif, '1', .2, 'flex');
            Ascript.addRippleListener(<HTMLElement>this.elemNotif.getElementsByClassName('notif-close')[0]);
            this.notifTimer = setTimeout(() => { this.dismiss() }, this.duration * 1000);
            this.elemNotif.getElementsByClassName('notif-close')[0].addEventListener('click', () => {
                this.dismiss();
                clearTimeout(this.notifTimer);
            });
        }

        /**
         * Hides the current notification (and deletes it)
         */
        public dismiss(): void {
            if (this.id !== null && document.getElementById(this.id.toString()) === this.elemNotif) {
                notifQueueTimed.splice(notifQueueTimed.indexOf(this.id), 1);
                notifQueue.delete(this.id);
                Ascript.fadeOutElement(document.getElementById(this.id.toString()), true, true);
                if (this.onDismiss !== null)
                    this.onDismiss();
            }
        }

    };

    export class Popup implements Sendable {

        private id: string;
        private content: string;
        private title: string;
        private colorPrimary: string;
        private colorSecondary: string;
        private classes: Array<string>;
        private onDismiss: () => any;
        private elem: HTMLElement | null;
        private dimensions: Array<string>;
        private buttons: Map<string, Array<number | string | string[] | Function>>;
        private fadeId: string;

        /**
         * Initializes a popup
         * @param id {String} id of the popup element
         */
        constructor(id: string) {
            this.id = id;
            this.content = "";
            this.title = "";
            this.colorPrimary = '#222';
            this.colorSecondary = '#fff';
            this.classes = [];
            this.onDismiss = null;
            this.elem = null;
            this.dimensions = ['auto', 'auto'];
            this.buttons = new Map();
            this.fadeId = 'fade';
        }

        /**
         * Sets the title of the popup
         * @param title {String}
         * @returns {Ascript.PopUp}
         */
        public setTitle(title: string): Popup {
            if (this.elem !== null)
                console.error(Ascript.getLocaleString(AppStringId.POPUP_ALREADY_SENT));
            this.title = title;
            return this;
        }

        public addButton(name: string, classname: Array<string>, id: string, callback: () => any): void {
            this.buttons.set(name, [id, classname, callback]);
            if (this.elem !== null && document.getElementById(this.id) !== null) {
                const button = document.createElement('div');
                button.classList.add(...classname);
                button.id = id;
                button.addEventListener('click', callback);
                document.getElementById(this.id).firstChild.firstChild.appendChild(button);
                Ascript.addRippleListener(button);
            }
        }

        /**
         * Sets the dimensions of the popup
         * @param dimensions {Array}
         * @returns {Ascript.PopUp}
         */
        public setDimensions(dimensions: Array<string>): Popup {
            if (!Array.isArray(dimensions) || dimensions.length < 2)
                throw "Can't resize the popup, please provide an array as argument";
            this.dimensions = dimensions.slice(0, 2);
            return this;
        }

        /**
         * Way to add classes
         * @param classes {Array}
         */
        public addClasses(classes: Array<string>): Popup {
            if (classes.length === 0)
                return this;
            this.classes = [].push.apply(this.classes, classes);
            if (this.elem !== null) {
                this.elem.classList.add(this.classes.join(' '));
            }
            return this;
        }

        /**
         * Sets the colors of the popup
         * set primary property of colors in order to define a color for actionBar and text
         * set secondary property of colors in order to define a color for the background of the popup
         * @param colors {Object}
         * @returns {Ascript.PopUp}
         */
        public setColors(colors: { primary?: string, secondary?: string }): Popup {
            for (let i in colors) {
                if (i === "primary")
                    this.colorPrimary = colors[i];
                else if (i === "secondary")
                    this.colorSecondary = colors[i];
            }
            if (this.elem !== null) {
                this.elem.style.backgroundColor = this.colorSecondary;
                this.elem.style.color = this.colorPrimary;
                (<HTMLElement>this.elem.children[0]).style.backgroundColor = this.colorPrimary;
                (<HTMLElement>this.elem.children[0]).style.color = this.colorSecondary;
            }
            return this;
        }

        /**
         * Sets the content of the popup (can be raw text of html)
         * @param content {String}
         * @returns {Ascript.PopUp}
         */
        public setContent(content: string): Popup {
            this.content = content;
            if (this.elem !== null)
                this.elem.children[1].innerHTML = content;
            return this;
        }

        /**
         * Sets the callback called when the popup is dismissed
         * @param callback
         * @returns {Ascript.PopUp}
         */
        public setOnDismiss(callback: () => any): Popup {
            if (this.elem !== null)
                console.error(Ascript.getLocaleString(AppStringId.POPUP_ALREADY_SENT) +
                    " " + Ascript.getLocaleString(AppStringId.POPUP_ERROR_DISMISS));
            this.onDismiss = callback;
            return this;
        }

        /**
         * Displays the current popup
         */
        public send(): void {
            let popup = document.createElement('div');
            popup.classList.add('popupBlock');
            popup.id = this.id;
            Object.assign(popup.style, {
                display: 'none',
                backgroundColor: this.colorSecondary,
                top: '50%',
                cssFloat: 'left',
                left: '50%',
                overflowX: 'hidden',
                overflowY: 'auto',
                transform: 'translateX(-50%) translateY(-50%)',
                position: 'fixed',
                zIndex: '99999',
                boxShadow: '0 0 20px #000',
                borderRadius: '2px',
                width: this.dimensions[0],
                height: this.dimensions[1],
                maxHeight: '100%',
                maxWidth: '100%'
            });
            popup.innerHTML = `<div class='actionBar' style="width:100%;height:auto;padding:5px;background:#444;color:#fff;margin:0 0 10px;border-top-left-radius:2px;border-top-right-radius:2px;display:flex;flex-direction:row-reverse;align-items:center;align-content:space-around;justify-content:space-between"><div id="popupButtonMenu" style="display:flex;flex-direction:row-reverse;padding-right:10px"></div><div class='title' style="font-size:30px;text-decoration:none;color:#fff;margin:10px">${this.title}</div></div><div class='popupContent' style="padding:40px;transform:translateX(-1%);color:#222">${this.content}</div>`;
            document.getElementsByTagName('body')[0].appendChild(popup);
            Ascript.fadeInElement(popup);
            const closeButton = document.createElement('div');
            closeButton.classList.add('popupClose');
            closeButton.setAttribute('data-rpl', '#eee');
            Object.assign(closeButton.style, {
                background: 'transparent',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                display: 'block',
                cursor: 'pointer',
                zIndex: '100',
                position: 'relative'
            });
            closeButton.innerHTML = '<div style="display:block;position:absolute;height:2px;width:50%;background:#fff;border-radius:10px;top:30%;left:32%;transform-origin:center left;transform:rotate(45deg)"></div>' +
                '<div style="display:block;position:absolute;height:2px;width:50%;background:#fff;border-radius:10px;top:65%;left:31%;transform-origin:center left;transform:rotate(-45deg)"></div>';
            popup.firstChild.firstChild.appendChild(closeButton);
            const fade = document.createElement('div');
            while (document.getElementById(this.fadeId) != null) {
                this.fadeId += Math.round(Math.random());
            }
            fade.id = this.fadeId;
            Object.assign(fade.style, {
                display: 'none',
                overflow: 'hidden',
                backgroundColor: '#000',
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                opacity: '0.8',
                zIndex: '9999'
            });
            fade.addEventListener('click', () => {
                this.dismiss();
            });
            document.body.appendChild(fade);
            Ascript.fadeInElement(fade, '0.8');
            closeButton.addEventListener('click', () => {
                this.dismiss();
            });
            Ascript.initRipple('popupClose');
            setTimeout(() => {
                for (let name in this.buttons) {
                    const button = document.createElement('div');
                    button.classList.add(...(<string[]>this.buttons.get(name)[1]));
                    button.id = <string>this.buttons.get(name)[0];
                    button.style.width = '50px';
                    button.style.margin = '0 5px 0 0';
                    button.setAttribute('data-rpl', this.colorSecondary);
                    button.addEventListener('click', <() => any>this.buttons.get(name)[2]);
                    popup.firstChild.firstChild.appendChild(button);
                    Ascript.fadeInElement(button);
                    Ascript.addRippleListener(button);
                }
            }, 500);
        }

        /**
         * Hides the current popup (and deletes it)
         */
        public dismiss(): void {
            if (this.id !== null && document.getElementById(this.id) != null) {
                Ascript.fadeOutElement(document.getElementById(this.fadeId), true);
                Ascript.fadeOutElement(document.getElementById(this.id), true);
                this.id = null;
                if (this.onDismiss !== null)
                    this.onDismiss();
            }
        }

    };

    /**
     * Creates showcases in the window. Showcases can't be displayed at the same time.
     * @type {Ascript.ShowCase}
     */
    export class ShowCase implements Sendable {

        private element: HTMLElement;
        private background: string;
        private textColor: string;
        private onDismiss: () => any;
        private substitutionElement: HTMLElement;
        private content: string;
        private title: string;

        constructor(element: HTMLElement) {
            this.element = element;
            this.background = '#222';
            this.textColor = '#fff';
            this.onDismiss = null;
            this.substitutionElement = <HTMLElement>this.element.cloneNode(true);
            this.content = "";
            this.title = "";
        }

        public setBackgroundColor(color: string): ShowCase {
            this.background = color;
            return this;
        }

        public setTextColor(color: string): ShowCase {
            this.textColor = color;
            return this;
        }

        public setOnDismiss(callback_function: () => any): ShowCase {
            this.onDismiss = callback_function;
            return this;
        }

        public setDescriptionTitle(title: string): ShowCase {
            this.title = title;
            return this;
        }

        public setDescriptionContent(content: string): ShowCase {
            this.content = content;
            return this;
        }

        public send(): void {
            if (document.getElementById('showcase') != null)
                return console.error("Only one showcase can be displayed at once !");
            const showcaseElement = document.createElement("div");
            showcaseElement.classList.add("showcase", "smooth");
            showcaseElement.id = "showcase";
            Object.assign(showcaseElement.style, {
                backgroundColor: this.background,
                color: this.textColor,
                width: "0",
                height: "0",
                zIndex: "10000",
                borderRadius: "100%",
                display: "block",
                position: "absolute",
                transform: "scale(0)"
            });
            setTimeout(() => {
                showcaseElement.style.transform = "scale(1)";
                showcaseElement.style.borderRadius = "0"
            }, 100);
            document.body.style.overflow = "hidden";
            document.getElementsByTagName('body')[0].appendChild(showcaseElement);
            Object.assign(showcaseElement.style, {
                width: "100%",
                height: "100%"
            });
            this.substitutionElement.style.zIndex = "10001";
            this.substitutionElement.style.transform = "scale(0)";
            this.substitutionElement.style.position = "relative";
            this.substitutionElement.style.left = this.element.getBoundingClientRect().left + window.pageXOffset + 'px';
            this.substitutionElement.style.top = this.element.getBoundingClientRect().top + window.pageYOffset + 'px';
            showcaseElement.appendChild(this.substitutionElement);

            // Determines if showcased element is left or right and places the text
            if (this.content !== "" || this.title !== "") {
                const leftPositioned = this.element.getBoundingClientRect().left >= window.innerWidth / 2;
                const textElements = document.createElement('div');
                textElements.innerHTML = `<div style='font-size:25px'>${this.title}</div><div style='font-size:17px'>${this.content}</div><div style='font-size:10px;font-style:italic;margin-top:12px'>Clique n'importe où pour fermer cette fenêtre</div>`;
                Object.assign(textElements.style, {
                    color: this.textColor,
                    position: "absolute",
                    left: `${leftPositioned ? 25 : 75}%`,
                    top: '50%',
                    transform: `translateX(-50%) translateY(-50%)`,
                    width: '40%'
                });
                textElements.addEventListener('click', (event) => {
                    event.stopPropagation()
                });
                showcaseElement.appendChild(textElements);
            }
            Ascript.fadeOutElement(this.element);

            setTimeout(() => {
                Ascript.fadeInElement(this.substitutionElement);
                this.substitutionElement.style.transform = "scale(1)";
                this.substitutionElement.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.dismiss();
                    this.element.click();
                });
                showcaseElement.addEventListener('click', () => {
                    this.dismiss();
                });
            }, 500);
        }

        public dismiss(): void {
            if (document.getElementById("showcase") != null && document.getElementById("showcase").style.opacity !== "0") {
                Ascript.fadeOutElement(document.getElementById("showcase"), true);
                Ascript.fadeInElement(this.element);
                document.body.style.overflow = "auto";
                if (this.onDismiss !== null)
                    this.onDismiss();
            }
        }

    };
}


window.onload = () => {

    /* For some curious reasons, the page is not ready onload. That's why
     * a setTimeout is required for all addEventListener
     */
    setTimeout(() => {

        /**
         * Makes scroll on click on elements which have "scroll" class.
         * Provide a "data-scroll" argument with the class of the element you want to scroll to.
         * Remember, that the name of the element can be unique or not. If it's not unique, it will
         * scroll to the first detected element.
         * If you don't provide 'data-scroll' argument, it will scroll up to top
         *
         * Here is an example:
         * <div class="scroll" data-scroll="other-element">Example button</div>
         * <div class="other-element">It will scroll to this element</div>
         */
        Array.from(document.getElementsByClassName('scroll')).forEach((element) => {
            element.addEventListener('click', () => {
                window.scrollTo({
                    'behavior': 'smooth',
                    'left': 0,
                    'top': element.hasAttribute('data-scroll') ? document.getElementsByClassName(element.getAttribute('data-scroll')).item(0).getBoundingClientRect().top + (document.documentElement.scrollTop !== null ? document.documentElement.scrollTop : document.body.scrollTop) : 0
                })
            });
        });

        /**
         * Give to an element the class name parallax and set a background image.
         * Then, see magic appear…
         * On scroll, the image will move, synchronously
         *
         * You can provide the movement coefficient in the parallax-coefficient attribute
         */
        setInterval(() => {
            [].forEach.call(document.getElementsByClassName('parallax'), (element: HTMLElement) => {
                let scrollToTop = (document.documentElement.scrollTop !== null ? document.documentElement.scrollTop : document.body.scrollTop) - element.offsetTop;
                element.style.backgroundPosition = 'center ' + (scrollToTop * (element.hasAttribute('data-parallax-coefficient') ? Number.parseFloat(element.getAttribute('data-parallax-coefficient')) : -0.2)) + 'px';
                let scrollToTopLeft = (2 - (scrollToTop * (element.hasAttribute('data-opacity-coefficient') ? Number.parseFloat(element.getAttribute('data-opacity-coefficient')) : 1) / (window.innerHeight / 2.6))) / 2;
                if (Math.sign(scrollToTopLeft) < 0)
                    scrollToTopLeft = 0;
                element.style.opacity = scrollToTopLeft + '';
            })
        }, 10);

        /**
         * Give to an element the class name clipboard and give it an attribute "content".
         * The element will then be able to copy the content to the clipboard on click
         */
        [].forEach.call(document.getElementsByClassName('clipboard'), (copyElement: HTMLElement) => {
            copyElement.addEventListener('click', () => {
                let input = document.createElement("input");
                input.id = 'copy';
                input.style.opacity = "0";
                input.value = copyElement.getAttribute('content');
                document.getElementsByTagName('body')[0].appendChild(input);
                input.select();
                document.execCommand('copy');
                input.parentElement.removeChild(input);
                new Ascript.Notification(`<svg fill="#fff" height="24" width="24" style="transform:translateY(5px);margin-right:5px"><path d="M0 0h24v24H0z" fill="none"/><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>${Ascript.getLocaleString(Ascript.AppStringId.CLIPBOARD_COPIED)}`).setDuration(10).send();
            })
        })
    }, 500);

    /**
     * Lazy Image Loading.
     * Just add the `lazyLoading` class to an element and
     * the data-lazy-loading attribute with the url of the image.
     */
    [].forEach.call(document.getElementsByClassName('lazyLoading'), (element: HTMLElement) => {
        let id = Ascript.getRandomInteger(1000);
        while (id in Ascript.imageLazyLoading && Ascript.imageLazyLoading.length < 1000) {
            id = Ascript.getRandomInteger(1000)
        }
        element.id = `lazyLoading-${id}`;
        Ascript.imageLazyLoading.push(id);
    });

    setInterval(() => {
        const scroll = document.documentElement.scrollTop !== null ? document.documentElement.scrollTop : document.body.scrollTop;
        [].forEach.call(Ascript.imageLazyLoading, (id: number) => {
            const element = document.getElementById(`lazyLoading-${id}`);
            if (element == null || !element.hasAttribute('data-lazy-loading'))
                return Ascript.imageLazyLoading.splice(Ascript.imageLazyLoading.indexOf(id), 1);
            if (scroll - element.getBoundingClientRect().top >= 0) {
                if (element.tagName === 'img')
                    element.setAttribute('src', element.getAttribute('data-lazy-loading'));
                else
                    element.style.backgroundImage = `url('${element.getAttribute('data-lazy-loading')}')`;
                Ascript.imageLazyLoading.splice(Ascript.imageLazyLoading.indexOf(id), 1);
            }
        })
    }, 200);

    document.getElementsByTagName("body")[0].innerHTML += "<style>@keyframes rpl-animation{from{transform:scale(1);opacity:0.4}to{transform:scale(100);opacity:0}}</style>";
    Ascript.initRipple();

};