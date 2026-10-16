import { conceptText, type Observation, type Quantity } from '@myfhir/fhir-core';
import type { PresentationField } from './descriptor';

function quantityText(quantity: Quantity): string | undefined {
  if (quantity.value === undefined || !Number.isFinite(quantity.value)) return undefined;
  return [quantity.comparator, String(quantity.value), quantity.unit ?? quantity.code]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');
}

type ValueSource = Pick<
  Observation,
  'valueQuantity' | 'valueCodeableConcept' | 'valueString' | 'valueBoolean' | 'valueInteger'
>;

function resultField(
  source: ValueSource,
  label: string,
  prefix = '',
): PresentationField | undefined {
  const choices: [string, string | undefined][] = [
    ['valueQuantity', source.valueQuantity && quantityText(source.valueQuantity)],
    ['valueCodeableConcept', conceptText(source.valueCodeableConcept)],
    ['valueString', source.valueString],
    [
      'valueBoolean',
      source.valueBoolean === undefined ? undefined : source.valueBoolean ? 'Yes' : 'No',
    ],
    ['valueInteger', source.valueInteger?.toString()],
  ];
  const value = choices.find(([, text]) => text !== undefined && text !== '');
  return value ? { label, value: value[1] ?? '', sourcePath: `${prefix}${value[0]}` } : undefined;
}

export function observationFields(resource: Observation): PresentationField[] {
  const fields: PresentationField[] = [];
  const result = resultField(resource, 'Result');
  if (result) fields.push(result);

  resource.component?.forEach((component, index) => {
    const field = resultField(
      component,
      conceptText(component.code) ?? `Component ${index + 1}`,
      `component[${index}].`,
    );
    fields.push(
      field ?? {
        label: conceptText(component.code) ?? `Component ${index + 1}`,
        value: conceptText(component.dataAbsentReason) ?? 'Result unavailable in this view',
        sourcePath: `component[${index}]`,
      },
    );
  });

  if (!result && !resource.component?.length) {
    fields.push({
      label: 'Result',
      value: conceptText(resource.dataAbsentReason) ?? 'Result unavailable in this view',
      sourcePath: resource.dataAbsentReason ? 'dataAbsentReason' : 'resourceType',
    });
  }
  // Keep the supplied precision and timezone; do not invent a complete date or local time.
  if (resource.effectiveDateTime) {
    fields.push({
      label: 'Recorded',
      value: resource.effectiveDateTime,
      sourcePath: 'effectiveDateTime',
    });
  }
  fields.push({ label: 'Status', value: resource.status, sourcePath: 'status' });
  return fields;
}
