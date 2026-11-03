import type { DiagnosticReport, Observation } from '@myfhir/fhir-core';

// Separate hand-authored fiction. Explicitly shares the existing dashboard demo source.
// These records are NOT added to resources, Bundle, dashboard measurements or weight history.
export const laboratoryContext = Object.freeze({
  sourceNamespace: 'urn:myfhir:synthetic:dashboard',
  patientId: 'demo-alex-morgan',
});

export const laboratoryObservations: readonly Observation[] = [
  {
    resourceType: 'Observation',
    id: 'fictional-lab-sodium',
    meta: { versionId: '1' },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
          },
        ],
      },
    ],
    code: {
      coding: [
        { system: 'http://loinc.org', code: '2951-2', display: 'Sodium in serum or plasma' },
      ],
    },
    subject: { reference: 'Patient/demo-alex-morgan' },
    effectiveDateTime: '2026-10-15T09:00:00+01:00',
    valueQuantity: {
      value: 140,
      unit: 'mmol/L',
      system: 'http://unitsofmeasure.org',
      code: 'mmol/L',
    },
  },
  {
    resourceType: 'Observation',
    id: 'fictional-lab-potassium',
    meta: { versionId: '1' },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '2823-3',
          display: 'Potassium in serum or plasma',
        },
      ],
    },
    subject: { reference: 'Patient/demo-alex-morgan' },
    effectiveDateTime: '2026-10-15T09:00:00+01:00',
    valueQuantity: {
      value: 4.2,
      unit: 'mmol/L',
      system: 'http://unitsofmeasure.org',
      code: 'mmol/L',
    },
  },
];

export const laboratoryReport: DiagnosticReport = {
  resourceType: 'DiagnosticReport',
  id: 'fictional-lab-report',
  meta: { versionId: '1' },
  status: 'final',
  category: [
    { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' }] },
  ],
  code: { text: 'Fictional laboratory demonstration report' },
  subject: { reference: 'Patient/demo-alex-morgan' },
  effectiveDateTime: '2026-10-15T09:00:00+01:00',
  issued: '2026-10-15T12:15:00+01:00',
  result: [
    { reference: 'Observation/fictional-lab-sodium' },
    { reference: 'Observation/fictional-lab-potassium' },
  ],
};
