const fadeTimeoutProperty = "fadeTimeout"

export function fadeOutElement(elem: HTMLElement, duration = 500, deletion = false, height = false) {
    if (elem[fadeTimeoutProperty] != null)
        clearTimeout(elem[fadeTimeoutProperty]);

    Object.assign(elem.style, {
        opacity: '1', transition: `all ${duration}ms ease-in-out`
    })
    elem.getBoundingClientRect()
    elem.style.opacity = '0';

    if (height) {
        elem.style.zIndex = (elem.style.zIndex !== "" ? (parseInt(elem.style.zIndex) - 1) : 0).toString();
        elem.style.maxHeight = elem.style.minHeight = window.getComputedStyle(elem).getPropertyValue('height');
        elem.style.marginTop = -(parseInt(window.getComputedStyle(elem).getPropertyValue('margin-bottom').slice(0, -2))
            + parseInt(window.getComputedStyle(elem).getPropertyValue('padding-top').slice(0, -2))
            + parseInt(window.getComputedStyle(elem).getPropertyValue('padding-bottom').slice(0, -2))
            + parseInt(window.getComputedStyle(elem).getPropertyValue('height').slice(0, -2))) + "px";
    }

    elem[fadeTimeoutProperty] = setTimeout(() => {
        if (deletion && elem.parentElement != null)
            elem.parentElement.removeChild(elem)
        else if (!deletion && elem.style.opacity === '0') {
            elem.style.visibility = 'hidden';
            elem.style.display = 'none';
        }
    }, duration);
};

export function fadeInElement(elem: HTMLElement, duration = 500, maxOpacity = 1) {
    if (elem[fadeTimeoutProperty] != null)
        clearTimeout(elem[fadeTimeoutProperty]);

    Object.assign(elem.style, {
        opacity: '0', transition: `all ${duration}ms ease-in-out`, visibility: 'visible'
    })
    if (elem.style.display == "none") elem.style.display = ""
    elem.getBoundingClientRect()
    elem.style.opacity = maxOpacity.toString();
};