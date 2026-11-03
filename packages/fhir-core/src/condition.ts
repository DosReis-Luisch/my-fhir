export const conditionCategorySystem = 'http://terminology.hl7.org/CodeSystem/condition-category';
export const conditionClinicalSystem = 'http://terminology.hl7.org/CodeSystem/condition-clinical';
export const conditionVerificationSystem =
  'http://terminology.hl7.org/CodeSystem/condition-ver-status';

const clinicalCodes = [
  'active',
  'recurrence',
  'relapse',
  'inactive',
  'remission',
  'resolved',
] as const;
const verificationCodes = [
  'unconfirmed',
  'provisional',
  'differential',
  'confirmed',
  'refuted',
  'entered-in-error',
] as const;
export type ConditionClinicalCode = (typeof clinicalCodes)[number];
export type ConditionVerificationCode = (typeof verificationCodes)[number];
export type ConditionCategoryCode = 'problem-list-item' | 'encounter-diagnosis';
export type ConditionCodingEvidence = Readonly<{
  path: string;
  system: string | undefined;
  code: string | undefined;
  version: string | undefined;
  display: string | undefined;
}>;
export type ConditionStatusSelection<Code extends string> = Readonly<
  | {
      state: 'selected';
      code: Code;
      evidence: readonly ConditionCodingEvidence[];
    }
  | {
      state: 'unavailable';
      reason: 'missing' | 'malformed' | 'unsupported' | 'conflicting';
      evidence: readonly ConditionCodingEvidence[];
    }
>;
export type ConditionStatusInspection = Readonly<{
  clinical: ConditionStatusSelection<ConditionClinicalCode>;
  verification: ConditionStatusSelection<ConditionVerificationCode>;
  limitations: readonly string[];
  validation: 'selected-consistency-checks-only';
}>;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function hasModifier(value: unknown, visited = new Set<object>()): boolean {
  if (typeof value !== 'object' || value === null || visited.has(value)) return false;
  visited.add(value);
  const modifier = object(value) ? value.modifierExtension : undefined;
  return (
    (object(value) &&
      Object.hasOwn(value, 'modifierExtension') &&
      (!Array.isArray(modifier) || modifier.length > 0)) ||
    Object.values(value).some((entry) => hasModifier(entry, visited))
  );
}
function conceptShape(value: unknown): boolean {
  if (!object(value)) return false;
  if (value.text !== undefined && typeof value.text !== 'string') return false;
  return (
    value.coding === undefined ||
    (Array.isArray(value.coding) &&
      value.coding.every(
        (entry) =>
          object(entry) &&
          ['system', 'code', 'version', 'display'].every(
            (key) => entry[key] === undefined || typeof entry[key] === 'string',
          ),
      ))
  );
}

/** Selected structural checks only; optional code/status metadata is never manufactured. */
export function hasSupportedConditionMetadata(value: unknown): boolean {
  if (!object(value)) return false;
  if (
    ['code', 'clinicalStatus', 'verificationStatus'].some(
      (key) => value[key] !== undefined && !conceptShape(value[key]),
    )
  )
    return false;
  if (
    ['recordedDate', 'onsetDateTime', 'abatementDateTime', 'onsetString', 'abatementString'].some(
      (key) => {
        const field = value[key];
        return field !== undefined && (typeof field !== 'string' || !field.trim());
      },
    )
  )
    return false;
  if (
    [
      'onsetAge',
      'onsetPeriod',
      'onsetRange',
      'abatementAge',
      'abatementPeriod',
      'abatementRange',
      'encounter',
      'recorder',
      'asserter',
    ].some((key) => value[key] !== undefined && !object(value[key]))
  )
    return false;
  return ['category', 'evidence', 'stage'].every((key) => {
    const field = value[key];
    return field === undefined || (Array.isArray(field) && field.every(object));
  });
}

function select<Code extends string>(
  concept: unknown,
  path: string,
  system: string,
  codes: readonly Code[],
): ConditionStatusSelection<Code> {
  const raw = object(concept) ? concept.coding : undefined;
  const evidence = Object.freeze(
    Array.isArray(raw)
      ? raw.map((entry, index) => {
          const coding = object(entry) ? entry : {};
          return Object.freeze({
            path: `${path}.coding[${index}]`,
            system: string(coding.system),
            code: string(coding.code),
            version: string(coding.version),
            display: string(coding.display),
          });
        })
      : [],
  );
  const unavailable = (
    reason: 'missing' | 'malformed' | 'unsupported' | 'conflicting',
  ): ConditionStatusSelection<Code> => Object.freeze({ state: 'unavailable', reason, evidence });
  if (concept === undefined) return unavailable('missing');
  if (!conceptShape(concept)) return unavailable('malformed');
  if (hasModifier(concept)) return unavailable('unsupported');
  if (!evidence.length) return unavailable('missing');
  if (new Set(evidence.map((entry) => entry.code)).size > 1) return unavailable('conflicting');
  if (
    evidence.some(
      (entry) =>
        entry.system !== system ||
        entry.version !== undefined ||
        !codes.includes(entry.code as Code),
    )
  )
    return unavailable('unsupported');
  return Object.freeze({ state: 'selected', code: evidence[0]!.code as Code, evidence });
}

/** Exact category policy shared by catalog and renderer; no diagnosis/Encounter inference. */
export function inspectConditionCategory(
  value: unknown,
): ConditionStatusSelection<ConditionCategoryCode> {
  const resource = object(value) ? value : {};
  const category = resource.category;
  const entries: unknown[] = [];
  const paths: string[] = [];
  let malformed = false;
  let unsupported = false;
  if (category !== undefined && !Array.isArray(category)) malformed = true;
  if (Array.isArray(category))
    category.forEach((concept, index) => {
      if (!object(concept) || !Array.isArray(concept.coding) || !concept.coding.length) {
        unsupported = true;
        return;
      }
      concept.coding.forEach((coding, codingIndex) => {
        entries.push(coding);
        paths.push(`category[${index}].coding[${codingIndex}]`);
      });
    });
  const selected = select({ coding: entries }, 'category', conditionCategorySystem, [
    'problem-list-item',
    'encounter-diagnosis',
  ] as const);
  const evidence = Object.freeze(
    selected.evidence.map((entry, index) => Object.freeze({ ...entry, path: paths[index]! })),
  );
  if (malformed || unsupported || hasModifier(resource))
    return Object.freeze({
      state: 'unavailable',
      reason: malformed ? 'malformed' : 'unsupported',
      evidence,
    });
  return Object.freeze({ ...selected, evidence });
}

/** Source assertions only; these selected consistency checks do not validate a diagnosis or full FHIR. */
export function inspectConditionStatuses(value: unknown): ConditionStatusInspection {
  const resource = object(value) ? value : {};
  const clinicalSelection = select(
    resource.clinicalStatus,
    'clinicalStatus',
    conditionClinicalSystem,
    clinicalCodes,
  );
  const verificationSelection = select(
    resource.verificationStatus,
    'verificationStatus',
    conditionVerificationSystem,
    verificationCodes,
  );
  const modified = hasModifier(resource);
  const clinical: ConditionStatusSelection<ConditionClinicalCode> = modified
    ? Object.freeze({
        state: 'unavailable',
        reason: 'unsupported',
        evidence: clinicalSelection.evidence,
      })
    : clinicalSelection;
  const verification: ConditionStatusSelection<ConditionVerificationCode> = modified
    ? Object.freeze({
        state: 'unavailable',
        reason: 'unsupported',
        evidence: verificationSelection.evidence,
      })
    : verificationSelection;
  const limitations: string[] = [];
  if (modified) limitations.push('unsupported-modifier-semantics');
  const problemList =
    Array.isArray(resource.category) &&
    resource.category.some(
      (category) =>
        object(category) &&
        Array.isArray(category.coding) &&
        category.coding.some(
          (coding) =>
            object(coding) &&
            coding.system === conditionCategorySystem &&
            coding.code === 'problem-list-item',
        ),
    );
  const enteredInError =
    verification.state === 'selected' && verification.code === 'entered-in-error';
  // Selected checks corresponding to R4 con-3, con-4 and con-5. Not an invariant validator.
  if (problemList && !enteredInError && clinical.state !== 'selected') {
    limitations.push('problem-list-clinical-status-required');
  }
  if (enteredInError && Object.hasOwn(resource, 'clinicalStatus')) {
    limitations.push('entered-in-error-clinical-status-present');
  }
  const hasAbatement = Object.keys(resource).some((key) => /^abatement[A-Z]/.test(key));
  if (
    hasAbatement &&
    (clinical.state !== 'selected' ||
      !['inactive', 'remission', 'resolved'].includes(clinical.code))
  ) {
    limitations.push('abatement-clinical-status-inconsistent');
  }
  return Object.freeze({
    clinical,
    verification,
    limitations: Object.freeze(limitations),
    validation: 'selected-consistency-checks-only',
  });
}
