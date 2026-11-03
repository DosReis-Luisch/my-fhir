import { describe, expect, it } from 'vitest';
import {
  conditionClinicalSystem,
  conditionVerificationSystem,
  type Condition,
} from '@myfhir/fhir-core';
import { conditions } from '@myfhir/synthetic';
import { presentResource, presentResourceWithProfiles } from '../src/index';

const original = conditions[0]!;

describe('recorded Condition presentation', () => {
  it('shows separate source assertions and supplied dates without establishing a diagnosis', () => {
    const before = JSON.stringify(conditions);
    const problem = presentResource(original);
    expect(problem.kind).toBe('condition');
    expect(problem.subtitle).toBe('Recorded clinical assertion');
    expect(problem.fields.find((field) => field.sourcePath === 'clinicalStatus')?.value).toBe(
      'active',
    );
    expect(problem.fields.find((field) => field.sourcePath === 'verificationStatus')?.value).toBe(
      'provisional',
    );
    expect(problem.fields.find((field) => field.sourcePath === 'onsetDateTime')?.value).toBe(
      '2026-08',
    );
    expect(problem.fields.find((field) => field.sourcePath === 'recordedDate')?.value).toBe(
      '2026-09-12',
    );
    expect(problem.fields.some((field) => field.sourcePath === 'abatementDateTime')).toBe(false);
    const encounter = presentResource(conditions[1]!);
    expect(encounter.kind).toBe('condition');
    expect(encounter.fields.find((field) => field.sourcePath === 'verificationStatus')?.value).toBe(
      'confirmed',
    );
    expect(encounter.fields.find((field) => field.sourcePath === 'abatementDateTime')?.value).toBe(
      '2026-10-17',
    );
    expect(problem.notices.join(' ')).toContain('no independent medical validation');
    expect(problem.source).toBe(original);
    expect(JSON.stringify(conditions)).toBe(before);
    expect(presentResourceWithProfiles(original, []).fieldHints).toEqual([]);
  });

  it('does not require a code, infer clinical status, or infer current activity from absent abatement', () => {
    const withoutCode = { ...original };
    delete withoutCode.code;
    expect(presentResource(withoutCode)).toMatchObject({
      kind: 'condition',
      title: 'Recorded Condition (code not supplied)',
    });
    const missingStatus = { ...original };
    delete missingStatus.clinicalStatus;
    expect(presentResource(missingStatus)).toMatchObject({ kind: 'generic', fields: [] });
    expect(presentResource(missingStatus).notices).toContain(
      'problem-list-clinical-status-required',
    );
  });

  it.each([
    { verificationStatus: { coding: [{ system: conditionVerificationSystem, code: 'refuted' }] } },
    {
      verificationStatus: {
        coding: [{ system: conditionVerificationSystem, code: 'entered-in-error' }],
      },
    },
    {
      verificationStatus: {
        coding: [
          { system: conditionVerificationSystem, code: 'provisional' },
          { system: conditionVerificationSystem, code: 'confirmed' },
        ],
      },
    },
    {
      clinicalStatus: {
        coding: [
          { system: conditionClinicalSystem, code: 'active' },
          { system: conditionClinicalSystem, code: 'resolved' },
        ],
      },
    },
    {
      clinicalStatus: {
        coding: [{ system: conditionClinicalSystem, code: 'active', version: '1' }],
      },
    },
    { modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }] },
    { abatementDateTime: '2026-10' },
    { onsetAge: { value: 12, unit: 'years' } },
    { onsetPeriod: { start: '2026-01', end: '2026-02' } },
    { onsetRange: { low: { value: 10 }, high: { value: 12 } } },
    { onsetString: 'Fictional timing' },
    { abatementAge: { value: 13 } },
    { abatementPeriod: { start: '2026-01' } },
    { abatementRange: { low: { value: 13 }, high: { value: 14 } } },
    { abatementString: 'Fictional abatement' },
    {
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">Fictional narrative</div>',
      },
    },
  ])('preserves questionable or unsupported metadata in safe fallback: %j', (fields) => {
    const resource = { ...original, ...fields } as unknown as Condition;
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
  });

  it('does not clinically interpret severity, stage, body site or evidence', () => {
    const resource = {
      ...original,
      severity: { text: 'Do not interpret severity' },
      bodySite: [{ text: 'Do not interpret body site' }],
      stage: [{ summary: { text: 'Do not interpret stage' } }],
      evidence: [
        {
          code: [{ text: 'Do not interpret evidence' }],
          detail: [{ reference: 'Observation/fictional' }],
        },
      ],
    };
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('condition');
    expect(presentation.fields.some((field) => field.value.includes('Do not interpret'))).toBe(
      false,
    );
    expect(presentation.source).toBe(resource);
  });

  it('allows abatement metadata with inactive/remission/resolved but never rewrites status', () => {
    for (const code of ['inactive', 'remission', 'resolved']) {
      const resource = {
        ...original,
        clinicalStatus: { coding: [{ system: conditionClinicalSystem, code }] },
        abatementDateTime: '2026-10',
      };
      const presentation = presentResource(resource);
      expect(presentation.kind).toBe('condition');
      expect(
        presentation.fields.find((field) => field.sourcePath === 'clinicalStatus')?.value,
      ).toBe(code);
    }
  });
});
