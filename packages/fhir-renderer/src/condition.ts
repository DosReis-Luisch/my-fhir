import {
  conceptText,
  hasSupportedConditionMetadata,
  inspectConditionCategory,
  inspectConditionStatuses,
  type Condition,
} from '@myfhir/fhir-core';
import type { PresentationField } from './descriptor';

export function conditionSummary(resource: Condition) {
  const statuses = inspectConditionStatuses(resource);
  const category = inspectConditionCategory(resource);
  const issues = [...statuses.limitations];
  if (!hasSupportedConditionMetadata(resource)) issues.push('unsupported-condition-metadata');
  if (category.state !== 'selected') issues.push('unavailable-condition-category');
  if (statuses.clinical.state !== 'selected')
    issues.push(`clinical-status-${statuses.clinical.reason}`);
  if (statuses.verification.state !== 'selected') {
    issues.push(`verification-status-${statuses.verification.reason}`);
  }
  if (
    statuses.verification.state === 'selected' &&
    ['entered-in-error', 'refuted'].includes(statuses.verification.code)
  ) {
    issues.push(`verification-${statuses.verification.code}`);
  }
  for (const prefix of ['onset', 'abatement']) {
    if (Object.keys(resource).some((key) => key.startsWith(prefix) && key !== `${prefix}DateTime`))
      issues.push(`unsupported-${prefix}-choice`);
  }
  if (
    ['text', 'note', '_recordedDate', '_onsetDateTime', '_abatementDateTime'].some((key) =>
      Object.hasOwn(resource, key),
    ) ||
    Object.keys(resource).some((key) => /^_(onset|abatement)[A-Z]/.test(key))
  ) {
    issues.push('unsupported-narrative-or-primitive-metadata');
  }
  if (
    issues.length ||
    category.state !== 'selected' ||
    statuses.clinical.state !== 'selected' ||
    statuses.verification.state !== 'selected'
  ) {
    return { supported: false as const, issues: Object.freeze(issues) };
  }
  const fields: PresentationField[] = [
    { label: 'Recorded Condition category', value: category.code, sourcePath: 'category' },
    {
      label: 'Source-supplied clinical status',
      value: statuses.clinical.code,
      sourcePath: 'clinicalStatus',
    },
    {
      label: 'Source-supplied verification status',
      value: statuses.verification.code,
      sourcePath: 'verificationStatus',
    },
  ];
  for (const [path, label] of [
    ['recordedDate', 'Recorded date (as supplied)'],
    ['onsetDateTime', 'Onset (as supplied)'],
    ['abatementDateTime', 'Abatement (as supplied)'],
  ] as const) {
    if (resource[path] !== undefined)
      fields.push({ label, value: resource[path], sourcePath: path });
  }
  return {
    supported: true as const,
    title: conceptText(resource.code) ?? 'Recorded Condition (code not supplied)',
    fields,
  };
}
