import type { Condition } from '@myfhir/fhir-core';

// Hand-authored fictional assertions, not real diagnoses. Separate from resources and Bundle.
export const conditionsContext = Object.freeze({
  sourceNamespace: 'urn:myfhir:synthetic:dashboard',
  patientId: 'demo-alex-morgan',
});

export const conditions: readonly Condition[] = [
  {
    resourceType: 'Condition',
    id: 'fictional-problem-entry',
    meta: { versionId: '1' },
    subject: { reference: 'Patient/demo-alex-morgan' },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'problem-list-item',
          },
        ],
      },
    ],
    code: { text: 'Fictional problem-list example Alpha' },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'provisional',
        },
      ],
    },
    recordedDate: '2026-09-12',
    onsetDateTime: '2026-08',
  },
  {
    resourceType: 'Condition',
    id: 'fictional-encounter-assertion',
    meta: { versionId: '1' },
    subject: { reference: 'Patient/demo-alex-morgan' },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
          },
        ],
      },
    ],
    code: { text: 'Fictional encounter assertion Beta — distinct from Alpha' },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'resolved',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
        },
      ],
    },
    recordedDate: '2026-10-18',
    onsetDateTime: '2026-10-15',
    abatementDateTime: '2026-10-17',
    encounter: { reference: 'Encounter/fictional-unavailable-encounter' },
  },
];
