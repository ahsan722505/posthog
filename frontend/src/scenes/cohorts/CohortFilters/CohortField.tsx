import './CohortField.scss'

import clsx from 'clsx'
import { useActions, useValues } from 'kea'
import { PropertyValue } from 'lib/components/PropertyFilters/components/PropertyValue'
import { TaxonomicFilterGroupType, TaxonomicFilterValue } from 'lib/components/TaxonomicFilter/types'
import { TaxonomicPopover } from 'lib/components/TaxonomicPopover/TaxonomicPopover'
import { LemonButton, LemonButtonWithDropdown } from 'lib/lemon-ui/LemonButton'
import { LemonDivider } from 'lib/lemon-ui/LemonDivider'
import { LemonInput } from 'lib/lemon-ui/LemonInput/LemonInput'
import { useMemo } from 'react'
import { cohortFieldLogic } from 'scenes/cohorts/CohortFilters/cohortFieldLogic'
import {
    CohortFieldBaseProps,
    CohortNumberFieldProps,
    CohortPersonPropertiesValuesFieldProps,
    CohortSelectorFieldProps,
    CohortTaxonomicFieldProps,
    CohortTextFieldProps,
} from 'scenes/cohorts/CohortFilters/types'

import { PropertyFilterType, PropertyFilterValue, PropertyOperator } from '~/types'

import { ReadOnlyCohortField, useIsReadonlyCohort } from '../cohortUtils'

let uniqueMemoizedIndex = 0

const useCohortFieldLogic = (props: CohortFieldBaseProps): { logic: ReturnType<typeof cohortFieldLogic.build> } => {
    const cohortFilterLogicKey = useMemo(
        () => props.cohortFilterLogicKey || `cohort-filter-${uniqueMemoizedIndex++}`,
        [props.cohortFilterLogicKey]
    )
    return {
        logic: cohortFieldLogic({ ...props, cohortFilterLogicKey }),
    }
}

export function CohortSelectorField({
    fieldKey,
    cohortFilterLogicKey,
    criteria,
    fieldOptionGroupTypes,
    placeholder,
    onChange: _onChange,
    cohortId,
}: CohortSelectorFieldProps): JSX.Element {
    const { logic } = useCohortFieldLogic({
        fieldKey,
        cohortFilterLogicKey,
        criteria,
        fieldOptionGroupTypes,
        onChange: _onChange,
        cohortId,
    })
    const readOnly = useIsReadonlyCohort({ id: cohortId })
    const { fieldOptionGroups, currentOption, value } = useValues(logic)
    const { onChange } = useActions(logic)

    return (
        <>
            {!readOnly && (
                <LemonButtonWithDropdown
                    type="secondary"
                    status="stealth"
                    sideIcon={undefined}
                    data-attr={`cohort-selector-field-${fieldKey}`}
                    dropdown={{
                        className: 'Popover__CohortField',
                        placement: 'bottom-start',
                        overlay: (
                            <div className="CohortField__dropdown">
                                {fieldOptionGroups.map(({ label, type: groupKey, values }, i) =>
                                    Object.keys(values).length != 0 ? (
                                        <div key={i}>
                                            {i !== 0 && <LemonDivider />}
                                            <h5>{label}</h5>
                                            {Object.entries(values).map(([_value, option]) => (
                                                <LemonButton
                                                    key={_value}
                                                    onClick={() => {
                                                        onChange({ [fieldKey]: _value })
                                                    }}
                                                    status="stealth"
                                                    active={_value == value}
                                                    fullWidth
                                                    data-attr={`cohort-${groupKey}-${_value}-type`}
                                                >
                                                    {option.label}
                                                </LemonButton>
                                            ))}
                                        </div>
                                    ) : null
                                )}
                            </div>
                        ),
                    }}
                >
                    <span className="font-medium">
                        {currentOption?.label || <span className="text-muted">{placeholder}</span>}
                    </span>
                </LemonButtonWithDropdown>
            )}
            {readOnly && <ReadOnlyCohortField>{currentOption?.label}</ReadOnlyCohortField>}
        </>
    )
}

export function CohortTaxonomicField({
    fieldKey,
    groupTypeFieldKey = 'event_type',
    cohortFilterLogicKey,
    criteria,
    taxonomicGroupTypes = [TaxonomicFilterGroupType.Events, TaxonomicFilterGroupType.Actions],
    placeholder = 'Choose event',
    onChange: _onChange,
    cohortId,
}: CohortTaxonomicFieldProps): JSX.Element {
    const { logic } = useCohortFieldLogic({
        fieldKey,
        criteria,
        cohortFilterLogicKey,
        onChange: _onChange,
        cohortId,
    })

    const { calculatedValue, calculatedValueLoading } = useValues(logic)
    const { onChange } = useActions(logic)
    const readOnly = useIsReadonlyCohort({ id: cohortId })
    const groupType = criteria[groupTypeFieldKey] as TaxonomicFilterGroupType

    return (
        <>
            {!readOnly && (
                <TaxonomicPopover
                    className="CohortField"
                    type="secondary"
                    status="stealth"
                    groupType={groupType}
                    loading={calculatedValueLoading(groupType)}
                    value={calculatedValue(groupType) as TaxonomicFilterValue}
                    onChange={(v, g) => {
                        onChange({ [fieldKey]: v, [groupTypeFieldKey]: g })
                    }}
                    excludedProperties={{
                        [TaxonomicFilterGroupType.Events]: [null], // "All events" isn't supported by Cohorts currently
                    }}
                    groupTypes={taxonomicGroupTypes}
                    placeholder={placeholder}
                    data-attr={`cohort-taxonomic-field-${fieldKey}`}
                    renderValue={(value) => (
                        <span className="font-medium">
                            {value || <span className="text-muted">{placeholder}</span>}
                        </span>
                    )}
                />
            )}
            {readOnly && <ReadOnlyCohortField>{calculatedValue(groupType)}</ReadOnlyCohortField>}
        </>
    )
}

export function CohortPersonPropertiesValuesField({
    fieldKey,
    criteria,
    cohortFilterLogicKey,
    onChange: _onChange,
    propertyKey,
    operator,
    cohortId,
}: CohortPersonPropertiesValuesFieldProps): JSX.Element {
    const { logic } = useCohortFieldLogic({
        fieldKey,
        criteria,
        cohortFilterLogicKey,
        onChange: _onChange,
        cohortId,
    })
    const { value } = useValues(logic)
    const { onChange } = useActions(logic)
    const readOnly = useIsReadonlyCohort({ id: cohortId })

    return (
        <>
            {!readOnly && (
                <PropertyValue
                    className={clsx('CohortField', 'CohortField__CohortPersonPropertiesValuesField')}
                    operator={operator || PropertyOperator.Exact}
                    propertyKey={propertyKey as string}
                    type={PropertyFilterType.Person}
                    value={value as PropertyFilterValue}
                    onSet={(newValue: PropertyOperator) => {
                        onChange({ [fieldKey]: newValue })
                    }}
                    placeholder="Enter value..."
                />
            )}
            {readOnly &&
                Array.isArray(value) &&
                value.map((v, i) => <ReadOnlyCohortField key={i}>{v}</ReadOnlyCohortField>)}
        </>
    )
}

export function CohortTextField({ value }: CohortTextFieldProps): JSX.Element {
    return <span className={clsx('CohortField', 'CohortField__CohortTextField')}>{value}</span>
}

export function CohortNumberField({
    fieldKey,
    cohortFilterLogicKey,
    criteria,
    onChange: _onChange,
    cohortId,
}: CohortNumberFieldProps): JSX.Element {
    const { logic } = useCohortFieldLogic({
        fieldKey,
        cohortFilterLogicKey,
        criteria,
        onChange: _onChange,
        cohortId,
    })
    const { value } = useValues(logic)
    const { onChange } = useActions(logic)
    const readOnly = useIsReadonlyCohort({ id: cohortId })

    return (
        <>
            {!readOnly && (
                <LemonInput
                    type="number"
                    value={(value as number) ?? undefined}
                    onChange={(nextNumber) => {
                        onChange({ [fieldKey]: nextNumber })
                    }}
                    min={1}
                    step={1}
                    className={clsx('CohortField', 'CohortField__CohortNumberField')}
                />
            )}
            {readOnly && <ReadOnlyCohortField>{value}</ReadOnlyCohortField>}
        </>
    )
}
