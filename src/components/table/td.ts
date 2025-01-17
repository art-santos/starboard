import { html, type PropertyValues, type TemplateResult } from 'lit'
import type { DirectiveResult } from 'lit/async-directive.js'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { unsafeHTML, UnsafeHTMLDirective } from 'lit/directives/unsafe-html.js'

import { eventTargetIsPlugin, eventTargetIsPluginEditor } from '../../lib/event-target-is-plugin.js'
import { type MenuSelectedEvent } from '../../lib/events.js'
import { PluginEvent, Theme, type ColumnPlugin } from '../../types.js'
import { BOOLEAN_TYPES, JSON_TYPES, MutableElement } from '../mutable-element.js'

import type { CellMenu } from '../menu/cell-menu.js'

import '../menu/cell-menu.js' // <outerbase-td-menu />

type PluginActionEvent = CustomEvent<{ action: PluginEvent.onEdit | PluginEvent.onStopEdit | PluginEvent.onCancelEdit; value: any }>

const isAlphanumericOrSpecial = (key: string): boolean => {
    // Regular expression to match alphanumeric characters and specified special characters
    return /^[a-zA-Z0-9 \.,]+$/.test(key)
}

// tl;dr <td/>, table-cell
@customElement('outerbase-td')
export class TableData extends MutableElement {
    protected override get classMap() {
        return {
            ...super.classMap,
            'table-cell relative focus:z-[1]': true,
            'px-cell-padding-x py-cell-padding-y ': !this.plugin && !this.blank,
            'px-5': this.blank,
            'border-theme-border dark:border-theme-border-dark': true,
            'bg-theme-cell dark:bg-theme-cell-dark text-theme-cell-text dark:text-theme-cell-text-dark': true,
            'bg-theme-cell-dirty dark:bg-theme-cell-dirty-dark': this.dirty && !this.hideDirt, // dirty cells
            'group-hover:bg-theme-row-hover dark:group-hover:bg-theme-row-hover-dark': !this.dirty || this.hideDirt,
            'focus:shadow-ringlet dark:focus:shadow-ringlet-dark focus:rounded-[4px] focus:ring-1 focus:ring-black dark:focus:ring-neutral-300 focus:outline-none':
                !this.isEditing && this.isInteractive,
            'border-r':
                this.isInteractive ||
                (this._drawRightBorder && this.separateCells && this.isLastColumn && this.outerBorder) || // include last column when outerBorder
                (this._drawRightBorder && this.separateCells && !this.isLastColumn), // internal cell walls
            'first:border-l': this.separateCells && this.outerBorder, // left/right borders when the `separate-cells` attribute is set
            'border-b': this.withBottomBorder, // bottom border when the `with-bottom-border` attribute is set
        }
    }

    @property({ attribute: 'plugin-attributes', type: String })
    public pluginAttributes: String = ''

    // allows, for example, <outerbase-td bottom-border="true" />
    @property({ type: Boolean, attribute: 'bottom-border' })
    public withBottomBorder: boolean = false

    @property({ type: Boolean, attribute: 'odd' })
    public isOdd?: boolean

    @property({ type: Boolean, attribute: 'draw-right-border' })
    public _drawRightBorder = false

    @property({ type: Boolean, attribute: 'menu' })
    public hasMenu = false

    @property({ type: Boolean, attribute: 'row-selector' })
    public isRowSelector = false

    @property({ attribute: 'is-last-column', type: Boolean })
    public isLastColumn = false

    @property({ attribute: 'is-last-row', type: Boolean })
    public isLastRow = false

    @property({ attribute: 'hide-dirt', type: Boolean })
    public hideDirt = false

    @property({ attribute: 'plugin', type: String })
    public plugin?: ColumnPlugin

    @state()
    protected options = [
        { label: 'Edit', value: 'edit' },
        { label: 'Copy', value: 'copy' },
        { label: 'Paste', value: 'paste' },
        { label: 'Clear', value: 'clear' },
    ]

    @state()
    public isDisplayingPluginEditor = false

    protected onContextMenu(event: MouseEvent) {
        const isPlugin = eventTargetIsPluginEditor(event)
        if (isPlugin) return

        if (this.blank) return

        const menu = this.shadowRoot?.querySelector('outerbase-td-menu') as CellMenu | null
        if (menu) {
            event.preventDefault()
            menu.focus()
            menu.open = true
        }
    }

    protected onPluginEvent({ detail: { action, value } }: PluginActionEvent) {
        // TODO not `.toLowerCase()`? update the enum to match what is emitted?
        const eventName = action.toLowerCase()

        if (eventName === PluginEvent.onEdit) {
            this.isDisplayingPluginEditor = true
        } else if (eventName === PluginEvent.onStopEdit) {
            this.isDisplayingPluginEditor = false
            // TODO update our value to match the one from the editor
        } else if (eventName === PluginEvent.onCancelEdit) {
            this.isDisplayingPluginEditor = false
        } else if (eventName === PluginEvent.updateCell) {
            this.value = value
        }
    }

    protected async onMenuSelection(event: MenuSelectedEvent) {
        switch (event.value) {
            case 'edit':
                return (this.isEditing = true)
            case 'copy':
                return this.copyValueToClipboard()
            case 'paste':
                this.value = await navigator.clipboard.readText()
                this.dispatchChangedEvent()
                return
            case 'clear':
                this.value = null
                this.dispatchChangedEvent()
                return
            case 'reset':
                this.value = this.originalValue
                this.dispatchChangedEvent()
                return
        }
    }

    public focus() {
        this.shadowRoot?.querySelector<HTMLElement>('[contenteditable]')?.focus()
    }

    public copyValueToClipboard() {
        if (this.value === null || this.value === undefined) return navigator.clipboard.writeText('')
        else if (typeof this.value === 'object') return navigator.clipboard.writeText(JSON.stringify(this.value))
        else return navigator.clipboard.writeText(this.value.toString())
    }

    protected async onKeyDown(event: KeyboardEvent): Promise<void> {
        // ignore events being fired from a Plugin
        if (eventTargetIsPlugin(event)) return

        // don't interfere with menu behavior
        const menu = this.shadowRoot?.querySelector('outerbase-td-menu') as CellMenu | null
        if (menu?.open) {
            return
        }

        if (this.plugin && event.code === 'Enter' && event.target instanceof HTMLElement) {
            this.moveFocusToNextRow(event.target)
            return
        }

        super.onKeyDown(event)

        // ignore events fired while editing
        if (this.isEditing) return

        const { code } = event

        let target = event.target
        if (!(target instanceof HTMLElement)) return

        // handle events from a <check-box />
        if (target.tagName.toLowerCase() === 'check-box') {
            const parent = target.parentElement?.parentElement?.parentElement

            if (code === 'ArrowDown') {
                event.preventDefault()
                ;(parent?.nextElementSibling?.querySelector('check-box') as HTMLElement | undefined)?.focus()
            } else if (code === 'ArrowUp') {
                event.preventDefault()
                ;(parent?.previousElementSibling?.querySelector('check-box') as HTMLElement | undefined)?.focus()
            } else if (code === 'ArrowRight') {
                event.preventDefault()
                ;(target.parentElement?.parentElement?.nextElementSibling as HTMLElement | undefined)?.focus()
            }
            return
        }

        // begin editing if keys are ASCII-ish
        const isInputTriggering = event.key.length === 1 && isAlphanumericOrSpecial(event.key)
        const noMetaKeys = !(event.metaKey || event.shiftKey)
        const typeIsNotJSON = !(this.type && JSON_TYPES.includes(this.type))
        const typeIsNotBoolean = !(this.type && BOOLEAN_TYPES.includes(this.type))

        if (isInputTriggering && noMetaKeys && typeIsNotJSON && typeIsNotBoolean) {
            event.preventDefault()

            // toggle editing mode
            this.isEditing = true

            // append this character
            if (this.value === undefined || this.value === null) this.value = event.key
            else this.value += event.key

            // set the cursor input to the end
            setTimeout(() => {
                const input = this.shadowRoot?.querySelector('input')
                input?.focus()
                input?.setSelectionRange(input.value.length, input.value.length)
            }, 0)
        }

        // navigating around the table

        if (code === 'ArrowRight') {
            event.preventDefault()
            ;(target?.nextElementSibling as HTMLElement)?.focus()
            return
        } else if (code === 'ArrowLeft') {
            event.preventDefault()
            const checkbox = target?.previousElementSibling?.querySelector('check-box') as HTMLElement | undefined
            if (checkbox) checkbox.focus()
            else (target?.previousElementSibling as HTMLElement | undefined)?.focus()
            return
        } else if (code === 'ArrowDown') {
            event.preventDefault()
            if (event.target instanceof HTMLElement && !this.isEditing) {
                this.moveFocusToNextRow(event.target)
                return
            }
        } else if (code === 'ArrowUp') {
            event.preventDefault()
            if (event.target instanceof HTMLElement && !this.isEditing) {
                this.moveFocusToPreviousRow(event.target)
                return
            }
        }

        // copy focused cells
        if (event.metaKey && code === 'KeyC') {
            event.preventDefault()
            return this.copyValueToClipboard()
        }

        if (code === 'Backspace' || code === 'Delete') {
            event.preventDefault()
            this.value = undefined
            return
        }
    }

    protected onClick(_event: MouseEvent) {
        // set focus on the inner contenteditable
        const didClickInsidePluginEditor = _event.composedPath().some((v) => {
            return v instanceof HTMLElement && v.id === 'plugin-editor'
        })
        if (!didClickInsidePluginEditor) this.focus()
    }

    protected onDoubleClick(event: MouseEvent) {
        if (this.isEditing) return // allow double-clicking to select text while editing

        if (!eventTargetIsPlugin(event)) {
            this.isEditing = true
            setTimeout(() => {
                const input = this.shadowRoot?.querySelector('input')

                if (input) {
                    input.focus()

                    // set cursor to end if writable
                    if (!this.readonly) input.setSelectionRange(input.value.length, input.value.length)
                }
            }, 0)
        }
    }

    public override connectedCallback(): void {
        super.connectedCallback()
        this.addEventListener('contextmenu', this.onContextMenu)
        // @ts-ignore insists on `Event` instead of `PluginActionEvent`
        this.addEventListener('custom-change', this.onPluginEvent)

        this.addEventListener('keydown', this.onKeyDown)

        if (this.isInteractive) {
            this.addEventListener('click', this.onClick)
            if (!this.plugin) this.addEventListener('dblclick', this.onDoubleClick)
        }
    }

    public override disconnectedCallback(): void {
        super.disconnectedCallback()
        this.removeEventListener('contextmenu', this.onContextMenu)
        // @ts-ignore insists on `Event` instead of `PluginActionEvent`
        this.removeEventListener('custom-change', this.onPluginEvent)
        this.removeEventListener('keydown', this.onKeyDown)

        if (this.isInteractive) {
            this.removeEventListener('click', this.onClick)
            if (!this.plugin) this.removeEventListener('dblclick', this.onDoubleClick)
        }
    }

    onDisplayEditor(event: MouseEvent) {
        const didClickInsidePluginEditor = event.composedPath().some((v) => {
            return v instanceof HTMLElement && v.id === 'plugin-editor'
        })

        if (!didClickInsidePluginEditor) {
            this.isDisplayingPluginEditor = false
        }
    }

    protected willUpdate(changedProperties: PropertyValues<this>): void {
        super.willUpdate(changedProperties)

        if (changedProperties.has('readonly')) {
            if (this.readonly) {
                this.options = [{ label: 'Copy', value: 'copy' }]
            } else {
                this.options = [
                    { label: 'Edit', value: 'edit' },
                    { label: 'Copy', value: 'copy' },
                    { label: 'Paste', value: 'paste' },
                    { label: 'Clear', value: 'clear' },
                ]
            }
        }

        if (changedProperties.has('isDisplayingPluginEditor')) {
            if (typeof document === 'undefined') return
            if (this.isDisplayingPluginEditor) {
                // setTimeout is necessary or else it receives the current click event (?!)
                setTimeout(() => {
                    document.addEventListener('click', this.onDisplayEditor.bind(this))
                }, 0)
            } else {
                document.removeEventListener('click', this.onDisplayEditor)
            }
        }
    }

    protected override render() {
        const value = this.value === null ? null : typeof this.value === 'object' ? JSON.stringify(this.value) : this.value
        const contentWrapperClass = classMap({ 'font-normal': true, dark: this.theme == Theme.dark })

        let cellContents: TemplateResult<1>
        let cellEditorContents: DirectiveResult<typeof UnsafeHTMLDirective> | undefined

        if (this.plugin) {
            const { config, tagName } = this.plugin
            const pluginAsString = unsafeHTML(
                `<${tagName} cellvalue='${value}' configuration='${config}' ${this.pluginAttributes}></${tagName}>`
            )
            cellContents = html`${pluginAsString}`

            if (this.isDisplayingPluginEditor) {
                cellEditorContents = unsafeHTML(
                    `<${tagName.replace(
                        'outerbase-plugin-cell',
                        'outerbase-plugin-editor'
                    )} cellvalue='${value}' configuration='${config}' ${this.pluginAttributes}></${tagName}>`
                )
            }
        } else {
            cellContents = html`${value ?? html`<span class="italic text-neutral-400 dark:text-neutral-500">NULL</span>`}`
        }

        const inputEl = this.isEditing // &nbsp; prevents the row from collapsing (in height) when there is only 1 column
            ? html`<span class=${contentWrapperClass}>&nbsp;<input .value=${value ?? ''} ?readonly=${
                  // disallow input on booleans (`t` and `f ` set it to true and false)
                  (this.type && BOOLEAN_TYPES.includes(this.type)) || this.readonly
              } @input=${this.onChange} class=${classMap({
                  'z-[2] absolute top-0 bottom-0 right-0 left-0': true,
                  'bg-blue-50 dark:bg-blue-950 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700': true,
                  'px-3 font-normal focus:rounded-[4px]': true,
              })} @blur=${this.onBlur}></input></span>`
            : html``

        const emptySlot = this.blank ? html`<slot></slot>` : html``

        const menuOptions = this.dirty
            ? [
                  ...this.options,
                  {
                      label:
                          typeof this.originalValue === 'object'
                              ? 'Revert'
                              : html`Revert to
                                    <span class="pointer-events-none italic whitespace-nowrap"
                                        >${this.originalValue !== null || this.originalValue !== undefined
                                            ? this.originalValue
                                            : 'NULL'}</span
                                    >`,
                      value: 'reset',
                  },
              ]
            : this.options

        // note: contenteditable is all so we can get the `paste` event that an arbitrary htmleelement does not otherwise receive
        const menuEl =
            !this.isEditing && !this.blank
                ? html`<span
                      class="outline-none caret-transparent"
                      contenteditable="true"
                      spellcheck="false"
                      autocorrect="off"
                      @paste=${(event: ClipboardEvent) => {
                          event.preventDefault()
                          this.value = event.clipboardData?.getData('text')
                      }}
                      @keydown=${(event: KeyboardEvent) => {
                          // our goal here is to prevent the user from engaging with the `contenteditable` component
                          const didNotOriginateInsidePluginEditor = event.composedPath().every((v) => {
                              return v instanceof HTMLElement && v.id !== 'plugin-editor'
                          })
                          if (didNotOriginateInsidePluginEditor) event.preventDefault()
                      }}
                      ><outerbase-td-menu
                          theme=${this.theme}
                          .options=${menuOptions}
                          ?without-padding=${!!this.plugin}
                          ?menu=${this.hasMenu}
                          ?selectable-text=${!this.isInteractive}
                          @menu-selection=${this.onMenuSelection}
                          ><span class=${contentWrapperClass}>${cellContents}</span
                          ><span id="plugin-editor" class="absolute top-8 caret-current">${cellEditorContents}</span></outerbase-td-menu
                      ></span
                  >`
                : html``

        return this.isEditing ? inputEl : this.blank ? emptySlot : menuEl
    }
}
