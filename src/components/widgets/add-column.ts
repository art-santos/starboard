import { html, type TemplateResult } from 'lit'
import { ClassifiedElement } from '../classified-element'
import { customElement, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { WarningOctagon } from '../../lib/icons/warning-octagon.js'
import { ColumnAddedEvent } from '../../lib/events.js'

@customElement('outerbase-add-column')
export class AddColumnElement extends ClassifiedElement {
    protected get classMap() {
        return {
            'inline-block p-3.5 w-40': true,
            'text-xs': true,
            'bg-neutral-50 dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50': true,
            'rounded-lg border border-neutral-400 dark:border-neutral-600': true,
            ...super.classMap,
        }
    }

    static labelClasses = {
        'font-medium': true,
    }

    static inputClasses = {
        'bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400': true,
        'placeholder-neutral-400 dark:placeholder-neutral-600': true,
        'rounded-md border border-neutral-400 dark:border-neutral-600': true,
        'px-2 py-1.5': true,
    }

    static buttonClasses = {
        'bg-neutral-950 dark:bg-neutral-50 hover:bg-neutral-800 hover:dark:bg-neutral-200': true,
        'text-neutral-50 dark:text-neutral-950': true,
        'px-5 py-1.5 rounded-md': true,
    }

    @state()
    protected columnName = ''

    @state()
    protected errorMessage: TemplateResult<1> | undefined

    protected onChange(event: InputEvent) {
        const { value } = event.target as HTMLInputElement
        this.columnName = value
    }

    protected onSubmit(event: Event) {
        event.preventDefault()
        this.errorMessage = html` <div class="flex items-center gap-1 text-[8px] leading-[9.6px] text-wrap">
            <span class="text-neutral-950">${WarningOctagon(12)}</span>
            <span>Name cannot contain special&nbsp;characters</span>
        </div>`

        if (!this.columnName) throw new Error('Missing column name')

        // JOHNNY listen for this event in `<OuterbaseTable />` and update the stuff
        //        be mindful to avoid double-firing the event
        this.dispatchEvent(new ColumnAddedEvent({ name: this.columnName }))
    }

    render() {
        return html`<form @submit=${this.onSubmit} class="flex flex-col gap-3.5 text-xs">
            <div class="flex flex-col gap-1">
                <label for="column-name" class=${classMap(AddColumnElement.labelClasses)}>Column Name</label>
                <input
                    required
                    type="text"
                    name="column-name"
                    id="column-name"
                    class=${classMap(AddColumnElement.inputClasses)}
                    placeholder="Enter name"
                    autocomplete="off"
                    .value=${this.columnName}
                    @input=${this.onChange}
                />
                ${this.errorMessage}
            </div>

            <div class="flex flex-col gap-1">
                <label for="data-type" class=${classMap(AddColumnElement.labelClasses)}>Select Type</label>
                <input
                    required
                    type="text"
                    name="data-type"
                    id="data-type"
                    class=${classMap(AddColumnElement.inputClasses)}
                    autocomplete="off"
                />
            </div>

            <button class=${classMap(AddColumnElement.buttonClasses)} type="submit">Create Column</button>
        </form>`
    }
}
