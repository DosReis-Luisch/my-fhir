import { describe, expect, it } from 'vitest';
import {
  conditionCategorySystem,
  conditionClinicalSystem,
  conditionVerificationSystem,
  inspectConditionCategory,
  inspectConditionStatuses,
} from '../src/index';

function clinical(code: string) {
  return { coding: [{ system: conditionClinicalSystem, code }] };
}
function verification(code: string) {
  return { coding: [{ system: conditionVerificationSystem, code }] };
}

describe('source-supplied Condition status selection', () => {
  it.each(['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'])(
    'recognizes exact clinical code %s without inferring verification',
    (code) => {
      const inspected = inspectConditionStatuses({ clinicalStatus: clinical(code) });
      expect(inspected.clinical).toMatchObject({ state: 'selected', code });
      expect(inspected.verification).toMatchObject({ state: 'unavailable', reason: 'missing' });
    },
  );
  it.each([
    'unconfirmed',
    'provisional',
    'differential',
    'confirmed',
    'refuted',
    'entered-in-error',
  ])('recognizes exact verification code %s without inferring clinical status', (code) => {
    const inspected = inspectConditionStatuses({ verificationStatus: verification(code) });
    expect(inspected.verification).toMatchObject({ state: 'selected', code });
    expect(inspected.clinical).toMatchObject({ state: 'unavailable', reason: 'missing' });
  });
  it.each([
    [{ clinicalStatus: {} }, 'missing'],
    [{ clinicalStatus: { text: 'active' } }, 'missing'],
    [{ clinicalStatus: { coding: 'malformed' } }, 'malformed'],
    [{ clinicalStatus: { coding: [{ system: 'urn:foreign', code: 'active' }] } }, 'unsupported'],
    [
      {
        clinicalStatus: {
          coding: [{ system: conditionClinicalSystem, code: 'active', version: '1' }],
        },
      },
      'unsupported',
    ],
    [
      {
        clinicalStatus: {
          coding: [
            { system: conditionClinicalSystem, code: 'active' },
            { system: conditionClinicalSystem, code: 'resolved' },
          ],
        },
      },
      'conflicting',
    ],
  ] as const)('preserves uncertainty for %j', (resource, reason) => {
    const result = inspectConditionStatuses(resource);
    expect(result.clinical).toMatchObject({ state: 'unavailable', reason });
    expect(result.clinical).not.toHaveProperty('code');
  });

  it('retains all coding evidence, accepts duplicates and does not promote provisional', () => {
    const resource = {
      clinicalStatus: { coding: [...clinical('active').coding, ...clinical('active').coding] },
      verificationStatus: verification('provisional'),
    };
    const before = JSON.stringify(resource);
    const result = inspectConditionStatuses(resource);
    expect(result.clinical).toMatchObject({ state: 'selected', code: 'active' });
    expect(result.clinical.evidence).toHaveLength(2);
    expect(result.verification).toMatchObject({ state: 'selected', code: 'provisional' });
    expect(result.clinical.evidence[1]?.path).toBe('clinicalStatus.coding[1]');
    for (const value of [
      result,
      result.clinical,
      result.clinical.evidence,
      result.clinical.evidence[0],
      result.limitations,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(Object.isFrozen(resource)).toBe(false);
    expect(JSON.stringify(resource)).toBe(before);
  });

  it('does not choose between conflicting verification statuses or combine clinical/verification systems', () => {
    const result = inspectConditionStatuses({
      clinicalStatus: verification('confirmed'),
      verificationStatus: {
        coding: [...verification('provisional').coding, ...verification('confirmed').coding],
      },
    });
    expect(result.clinical).toMatchObject({ state: 'unavailable', reason: 'unsupported' });
    expect(result.verification).toMatchObject({ state: 'unavailable', reason: 'conflicting' });
    expect(result.verification.evidence).toHaveLength(2);
    const modified = inspectConditionStatuses({
      clinicalStatus: clinical('active'),
      verificationStatus: verification('confirmed'),
      modifierExtension: [{ url: 'urn:fictional:modifier' }],
    });
    expect(modified.clinical).toMatchObject({ state: 'unavailable', reason: 'unsupported' });
    expect(modified.verification).toMatchObject({ state: 'unavailable', reason: 'unsupported' });
    expect(modified.clinical.evidence).toHaveLength(1);
    expect(modified.limitations).toContain('unsupported-modifier-semantics');
  });

  it('flags selected problem-list, entered-in-error and abatement inconsistencies without changing assertions', () => {
    const category = [{ coding: [{ system: conditionCategorySystem, code: 'problem-list-item' }] }];
    expect(inspectConditionStatuses({ category }).limitations).toContain(
      'problem-list-clinical-status-required',
    );
    expect(
      inspectConditionStatuses({ category, verificationStatus: verification('entered-in-error') })
        .limitations,
    ).toEqual([]);
    expect(
      inspectConditionStatuses({
        clinicalStatus: clinical('active'),
        verificationStatus: verification('entered-in-error'),
      }).limitations,
    ).toContain('entered-in-error-clinical-status-present');
    expect(
      inspectConditionStatuses({ clinicalStatus: clinical('active'), abatementDateTime: '2026' })
        .limitations,
    ).toContain('abatement-clinical-status-inconsistent');
    expect(
      inspectConditionStatuses({ abatementString: 'Fictional abatement' }).limitations,
    ).toContain('abatement-clinical-status-inconsistent');
    for (const code of ['inactive', 'remission', 'resolved']) {
      expect(
        inspectConditionStatuses({ clinicalStatus: clinical(code), abatementDateTime: '2026' })
          .limitations,
      ).toEqual([]);
    }
  });

  it('selects only agreeing exact category codes with original evidence paths', () => {
    const category = [{ coding: [{ system: conditionCategorySystem, code: 'problem-list-item' }] }];
    const selected = inspectConditionCategory({ category: [...category, ...category] });
    expect(selected).toMatchObject({ state: 'selected', code: 'problem-list-item' });
    expect(selected.evidence[1]?.path).toBe('category[1].coding[0]');
    expect(
      inspectConditionCategory({
        category: [
          ...category,
          { coding: [{ system: conditionCategorySystem, code: 'encounter-diagnosis' }] },
        ],
      }),
    ).toMatchObject({ state: 'unavailable', reason: 'conflicting' });
  });
});
