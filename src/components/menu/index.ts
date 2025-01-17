import { html, type PropertyValueMap } from 'lit'
import { property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'

import classMapToClassName from '../../lib/class-map-to-class-name.js'
import { MenuOpenEvent, MenuSelectedEvent } from '../../lib/events.js'
import { CaretDown } from '../../lib/icons/caret-down.js'
import { Theme, type HeaderMenuOptions } from '../../types.js'
import { ClassifiedElement } from '../classified-element.js'

export class Menu extends ClassifiedElement {
    protected override get classMap() {
        return {
            relative: true,
            'flex items-center justify-between gap-2': !this.withoutPadding,
            'font-medium select-none whitespace-nowrap': true,
            dark: this.theme == Theme.dark,
        }
    }

    @property({ type: Boolean, attribute: 'open', reflect: true })
    public open = false

    // @property({ attribute: 'selection', type: String })
    @state()
    public selection?: string

    @property({ type: Array, attribute: 'options' })
    public options: HeaderMenuOptions = []

    @state()
    protected activeOptions: HeaderMenuOptions = []

    @property({ attribute: 'theme', type: String })
    public theme = Theme.light

    @property({ attribute: 'without-padding', type: Boolean })
    public withoutPadding = false

    @state()
    protected historyStack: Array<HeaderMenuOptions> = []

    @state()
    protected focused?: string

    // this function is intended to be overriden in a subclass
    // and not accessed otherwise
    protected get menuPositionClasses() {
        return ''
    }

    // for closing menus when an ousside click occurs
    private outsideClicker: ((event: MouseEvent) => void) | undefined
    private activeEvent: Event | undefined

    // storing this as a variable instead of anonymous function
    // so that the listener can determine if it's the same closer or not
    // for the scenario when the same menu is repeatedly opened
    private close = () => (this.open = false)

    protected override willUpdate(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.willUpdate(_changedProperties)

        // when the menu is being opened
        if (_changedProperties.has('open') && this.open) {
            this.setAttribute('aria-expanded', '')
            this.outsideClicker = (event: MouseEvent) => {
                if (event !== this.activeEvent) {
                    this.open = false
                    delete this.activeEvent
                    if (this.outsideClicker) document.removeEventListener('click', this.outsideClicker)
                }
            }
            document.addEventListener('click', this.outsideClicker)

            this.dispatchEvent(new MenuOpenEvent(this.close))
        }
        // when the menu is being closed
        else if (_changedProperties.has('open') && !this.open) {
            this.removeAttribute('aria-expanded')

            // reset history; restore root menu ietms
            if (this.historyStack.length > 0) {
                this.options = this.historyStack[0]
                this.historyStack = []
            }
            if (this.outsideClicker) {
                delete this.activeEvent
                document.removeEventListener('click', this.outsideClicker)
            }
        }

        if (_changedProperties.has('options')) {
            // reset the menu to it's root
            this.activeOptions = this.options
        }
    }

    protected override updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.updated(_changedProperties)

        // when closing
        if (_changedProperties.has('open') && !this.open) {
            this.focused = undefined
        }
    }

    protected onTrigger(event: Event) {
        this.open = !this.open
        this.activeEvent = event
    }

    protected onItemClick(event: MouseEvent) {
        const el = event.target as HTMLElement

        // look for someone with a `data-value`
        // this was necessary when passing in a label that
        // is itself another html element such that the literal thing
        // being clicked does NOT have the value
        let parent = el
        while (parent && !parent.hasAttribute('data-value') && parent.parentElement) {
            parent = parent.parentElement
        }

        const value = parent.getAttribute('data-value')
        if (!value) throw new Error("onItemClick didn't recover a selection value")
        this.onSelection(event, value)
    }

    protected onSelection(event: Event, value: string) {
        const submenu = this.options.find((opt) => opt.value === value)
        if (submenu && submenu.options) {
            event.stopPropagation()
            event.preventDefault()
            this.historyStack.push(this.options)
            this.options = submenu.options
            return
        }

        if (typeof value === 'string') {
            const selectionEvent = new MenuSelectedEvent(value)
            this.selection = value
            this.dispatchEvent(selectionEvent)
        }
    }

    protected onKeyDown(event: KeyboardEvent & { didCloseMenu: boolean }) {
        const { code } = event

        if (code === 'Escape') {
            this.open = false
        } else if (code === 'Space' || code === 'Enter') {
            event.preventDefault()
            this.open = !this.open
            event.didCloseMenu = true

            if (!this.open && this.focused) this.onSelection(event, this.focused)
        } else if (code === 'ArrowDown' || code === 'ArrowRight') {
            event.preventDefault()
            if (!this.focused) this.focused = this.activeOptions[0]?.value
            else {
                const idx = this.activeOptions.findIndex(({ value }, _idx) => value === this.focused)
                if (idx > -1 && idx < this.activeOptions.length - 1) this.focused = this.activeOptions[idx + 1].value
                else if (idx === this.activeOptions.length - 1) this.focused = this.activeOptions[0].value
            }
        } else if (code === 'ArrowUp' || code === 'ArrowLeft') {
            event.preventDefault()
            if (!this.focused) this.focused = this.activeOptions[this.activeOptions.length - 1]?.value
            else {
                const idx = this.activeOptions.findIndex(({ value }, _idx) => value === this.focused)
                if (idx > 0) this.focused = this.activeOptions[idx - 1].value
                else if (idx === 0) this.focused = this.activeOptions[this.activeOptions.length - 1].value
            }
        } else if (code === 'Tab') {
            // prevent tabbing focus away from an open menu
            if (this.open) event.preventDefault()
        }
    }

    public override focus() {
        const trigger = this.shadowRoot?.querySelector('#trigger') as HTMLElement | null
        trigger?.focus()
    }

    protected get listElement() {
        if (!this.open) return null

        const classes = {
            [this.menuPositionClasses]: true,
            'absolute z-[2] max-w-56 overflow-hidden': true,
            'text-base': true,
            'bg-white dark:bg-black shadow-lg': true,
            'rounded-2xl p-1': true,
            'duration-150 ease-bounce': true,
        }

        return html`<ul class=${classMap(classes)} role="menu">
            ${repeat(
                this.activeOptions,
                ({ label }) => label,
                ({ label, value, classes }) =>
                    html`<li
                        @click=${this.onItemClick}
                        data-value=${value}
                        class=${classMapToClassName({
                            [classes ?? '']: !!classes,
                            'text-ellipsis overflow-hidden': true,
                            'rounded-xl px-4 py-3': true,
                            'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700': true,
                            'bg-neutral-100 dark:bg-neutral-700': this.focused === value,
                        })}
                        role="menuitem"
                        ?selected=${this.selection === value}
                    >
                        ${label}
                    </li>`
            )}
        </ul>`
    }

    protected override render() {
        // @click shows/hides the menu
        // @dblclick prevents parent's dblclick
        // @keydown navigates the menu

        const outerClasses = {
            'relative -mr-1 cursor-pointer': true,
            dark: this.theme == Theme.dark,
        }

        const innerClasses = {
            'border border-transparent': true,
            'hover:bg-neutral-100 dark:hover:bg-neutral-900 active:border-neutral-200 dark:active:border-neutral-800': true,
            'p-0.5 rounded-md': true,
        }

        return html`
            <slot></slot>
            <div
                id="trigger"
                class=${classMap(outerClasses)}
                aria-haspopup="menu"
                tabindex="0"
                @click=${this.onTrigger}
                @dblclick=${(e: MouseEvent) => e.stopPropagation()}
                @keydown=${this.onKeyDown}
            >
                <div class=${classMap(innerClasses)}>${CaretDown(16)}</div>
                ${this.listElement}
            </div>
        `
    }
}
