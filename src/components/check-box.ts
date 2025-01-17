import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'

import { TWStyles } from '../../tailwind/index.js'
import { CheckEvent } from '../lib/events.js'
import { CheckMark } from '../lib/icons/check-mark.js'
import { Theme } from '../types.js'

@customElement('check-box')
export class CustomCheckbox extends LitElement {
    static styles = TWStyles
    static checkedTemplate = html`<span
        class="bg-black dark:bg-white text-white dark:text-black flex items-center justify-center w-4 h-4 p-0.5 rounded-md"
        >${CheckMark(16)}</span
    >`
    static uncheckedTemplate = html`<span class="w-4 h-4 border border-neutral-500 rounded-md"></span>`

    @property({ type: Boolean }) checked = false
    @property({ type: String }) theme = Theme.light

    toggleCheckbox(event: Event) {
        event.preventDefault()
        this.checked = !this.checked
        this.dispatchEvent(new CheckEvent())
    }

    tabIndex = 0
    onKeyDown(event: KeyboardEvent) {
        const { code } = event
        if (code === 'Enter' || code === 'Space') {
            this.toggleCheckbox(event)
        }
    }
    connectedCallback(): void {
        super.connectedCallback()
        this.addEventListener('keydown', this.onKeyDown)
    }
    disconnectedCallback(): void {
        super.disconnectedCallback()
        this.removeEventListener('keydown', this.onKeyDown)
    }

    @property({ attribute: 'class', type: String, reflect: true })
    _class =
        'focus:shadow-ringlet dark:focus:shadow-ringlet-dark focus:rounded-md focus:ring-1 focus:ring-black dark:focus:ring-neutral-300 focus:outline-none'

    render() {
        const classes = classMap({
            'flex items-center cursor-pointer': true,
            dark: this.theme == Theme.dark,
        })

        return html`
            <div class=${classes} @click="${this.toggleCheckbox}">
                ${this.checked ? CustomCheckbox.checkedTemplate : CustomCheckbox.uncheckedTemplate}
                <input type="checkbox" ?checked="${this.checked}" @change="${this.toggleCheckbox}" class="hidden" />
            </div>
        `
    }
}
