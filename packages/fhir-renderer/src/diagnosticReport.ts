import { ownField, type DiagnosticReport } from '@myfhir/fhir-core';
import type { PresentationField } from './descriptor';

/** A deliberately small metadata summary. No narrative, attachments or conclusions are interpreted. */
export function diagnosticReportSummary(resource: DiagnosticReport) {
  if (resource.status !== 'final') return undefined;
  const unsupported = [
    'text',
    'conclusion',
    'conclusionCode',
    'presentedForm',
    'media',
    'imagingStudy',
    '_effectiveDateTime',
    '_issued',
  ];
  if (
    unsupported.some((field) => ownField(resource, field) !== undefined) ||
    Object.keys(resource).some(
      (field) => /^effective[A-Z]/.test(field) && field !== 'effectiveDateTime',
    )
  ) {
    return undefined;
  }
  const result = ownField(resource, 'result');
  if (
    result !== undefined &&
    (!Array.isArray(result) || result.some((entry) =>
      typeof entry !== 'object' || entry === null || Array.isArray(entry),
    ))
  ) {
    return undefined;
  }
  const codeText = ownField(resource.code, 'text');
  const coding = ownField(resource.code, 'coding');
  if (
    (codeText !== undefined && (typeof codeText !== 'string' || !codeText.trim())) ||
    (coding !== undefined && (!Array.isArray(coding) || !coding.length || coding.some((entry) =>
      typeof ownField(entry, 'code') !== 'string' ||
      (ownField(entry, 'display') !== undefined && typeof ownField(entry, 'display') !== 'string'),
    )))
  ) {
    return undefined;
  }
  const display = Array.isArray(coding)
    ? coding
        .map((entry) => ownField(entry, 'display'))
        .find((value) => typeof value === 'string' && value.trim())
    : undefined;
  const title =
    typeof codeText === 'string'
      ? codeText
      : typeof display === 'string'
        ? display
        : 'Diagnostic report';
  if (codeText === undefined && coding === undefined) return undefined;
  const fields: PresentationField[] = [
    { label: 'Report status', value: resource.status, sourcePath: 'status' },
  ];
  for (const [sourcePath, label] of [
    ['effectiveDateTime', 'Clinically effective time (as supplied)'],
    ['issued', 'Issued time (as supplied)'],
  ] as const) {
    const value = ownField(resource, sourcePath);
    if (value === undefined) continue;
    // Display source precision verbatim. No parsing, sorting or invented instants.
    if (typeof value !== 'string' || !value.trim()) return undefined;
    fields.push({ label, value, sourcePath });
  }
  return { title, fields };
}
