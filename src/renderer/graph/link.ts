namespace Link {
    const linkClickedAttribute: string = 'data-being-clicked'
    const linkAttachementAttribute: string = 'data-link'
    export function bind(link: HTMLElement) {
        link.addEventListener('mousedown', function(e) {
            link.setAttribute(linkClickedAttribute, '')
            if (e.button === 1 && e.buttons === 4 && e.which === 2)
                e.preventDefault()
        })
        link.addEventListener('mouseup', function(e) {
            if (!this.hasAttribute(linkClickedAttribute)) return
            this.removeAttribute(linkClickedAttribute)
            e.stopImmediatePropagation()
            const location = this.getAttribute(linkAttachementAttribute)
            if (!!location) {
                const helper = document.createElement('a')
                helper.href = location
                helper.target = e.button === 1 && e.which === 2 ? '_blank' : ''
                helper.click()
            }
        })
        link.setAttribute('draggable', 'true')
        link.addEventListener('dragstart', function(e) {
            this.removeAttribute(linkClickedAttribute)
            e.dataTransfer.setData('text/uri-list', this.getAttribute(linkAttachementAttribute))
        })
    }
    export function init(className: string = 'link') {
        for (let link of document.getElementsByClassName(className)) 
            if (link instanceof HTMLElement) bind(link)
        window.addEventListener('mouseup', () => {
            for (const elem of document.getElementsByClassName(className))
                if (elem.hasAttribute(linkAttachementAttribute) && elem.hasAttribute(linkClickedAttribute))
                    elem.removeAttribute(linkClickedAttribute)
        })
    }
}