import type { Observation, StructureDefinition } from '@myfhir/fhir-core';

/** Curated inspection fixture, not a complete generated Observation snapshot or validated IG. */
export const syntheticPulseProfile = {
  resourceType: 'StructureDefinition',
  id: 'synthetic-pulse-profile',
  url: 'https://myfhir.example/StructureDefinition/synthetic-pulse',
  version: '1.0.0',
  name: 'SyntheticPulseObservation',
  title: 'Synthetic pulse measurement',
  status: 'draft',
  experimental: true,
  description:
    'Fictional pulse profile with selected snapshot elements for metadata inspection only.',
  fhirVersion: '4.0.1',
  kind: 'resource',
  abstract: false,
  type: 'Observation',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
  derivation: 'constraint',
  snapshot: {
    element: [
      {
        id: 'Observation',
        path: 'Observation',
        min: 0,
        max: '*',
        base: { path: 'Observation', min: 0, max: '*' },
        short: 'Fictional pulse measurement',
        definition: 'A synthetic vital-sign measurement used solely to demonstrate inspection.',
      },
      {
        id: 'Observation.status',
        path: 'Observation.status',
        min: 1,
        max: '1',
        base: { path: 'Observation.status', min: 1, max: '1' },
        type: [{ code: 'code' }],
        isModifier: true,
        isModifierReason: 'Status can indicate that an observation was entered in error.',
        isSummary: true,
      },
      {
        id: 'Observation.code',
        path: 'Observation.code',
        min: 1,
        max: '1',
        base: { path: 'Observation.code', min: 1, max: '1' },
        type: [{ code: 'CodeableConcept' }],
        patternCodeableConcept: {
          coding: [{ system: 'http://loinc.org', code: '8867-4' }],
        },
        mustSupport: true,
        isSummary: true,
      },
      {
        id: 'Observation.subject',
        path: 'Observation.subject',
        min: 1,
        max: '1',
        base: { path: 'Observation.subject', min: 0, max: '1' },
        type: [
          { code: 'Reference', targetProfile: ['http://hl7.org/fhir/StructureDefinition/Patient'] },
        ],
        mustSupport: true,
      },
      {
        id: 'Observation.effective[x]',
        path: 'Observation.effective[x]',
        min: 1,
        max: '1',
        base: { path: 'Observation.effective[x]', min: 0, max: '1' },
        type: [{ code: 'dateTime' }],
        short: 'Clinically effective time',
      },
      {
        id: 'Observation.value[x]',
        path: 'Observation.value[x]',
        min: 1,
        max: '1',
        base: { path: 'Observation.value[x]', min: 0, max: '1' },
        type: [{ code: 'Quantity' }],
        short: 'Synthetic pulse rate as a quantity',
        mustSupport: true,
      },
      {
        id: 'Observation.value[x].value',
        path: 'Observation.value[x].value',
        min: 1,
        max: '1',
        base: { path: 'Quantity.value', min: 0, max: '1' },
        type: [{ code: 'decimal' }],
      },
    ],
  },
} satisfies StructureDefinition;

/** Separate from the patient overview fixtures to preserve existing application behavior. */
export const syntheticPulseObservation: Observation = {
  resourceType: 'Observation',
  id: 'synthetic-profiled-pulse',
  meta: { profile: [`${syntheticPulseProfile.url}|${syntheticPulseProfile.version}`] },
  status: 'final',
  category: [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        },
      ],
    },
  ],
  code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
  subject: { reference: 'Patient/demo-alex-morgan' },
  effectiveDateTime: '2026-10-01T09:30:00+01:00',
  valueQuantity: {
    value: 68,
    unit: 'beats/min',
    system: 'http://unitsofmeasure.org',
    code: '/min',
  },
};
