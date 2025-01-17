import type { PropertyValueMap } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import { ClassifiedElement } from '../classified-element.js'

// tl;dr <tr/>, table-row
@customElement('outerbase-tr')
export class TableRow extends ClassifiedElement {
    protected override get classMap() {
        return {
            'table-row group': true,
            // 'hover:bg-theme-row-hover dark:hover:bg-theme-row-hover-dark': true,

            // when a header
            'text-theme-column-text dark:text-theme-column-text-dark': this.isHeaderRow,

            // when new, not selected
            'bg-theme-row-new dark:bg-theme-row-new-dark': this.new && !this.selected,

            // not selected, not new, not a header
            'odd:bg-theme-row-odd dark:odd:bg-theme-row-odd-dark even:bg-theme-row-even dark:even:bg-theme-row-even-dark':
                !this.new && !this.isHeaderRow && !this.selected,

            // when selected
            'bg-theme-row-selected dark:bg-theme-row-selected-dark hover:bg-theme-row-selected-hover dark:hover:bg-theme-row-selected-hover-dark':
                this.selected && !this.isHeaderRow,
        }
    }

    @property({ type: Boolean, attribute: 'selected' })
    public selected: boolean = false

    @property({ type: Boolean, attribute: 'header', reflect: true })
    protected isHeaderRow: boolean = false

    @property({ type: Boolean, attribute: 'new' })
    public new = false

    protected override willUpdate(_changedProperties: PropertyValueMap<this>): void {
        super.willUpdate(_changedProperties)

        // dispatch event when row is selected/unselected
        if (_changedProperties.has('selected') && _changedProperties.get('selected') !== undefined)
            this.dispatchEvent(new Event('on-selection'))
    }
}
