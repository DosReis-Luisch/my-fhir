import type { Observation } from '@myfhir/fhir-core';

// Hand-authored fictional examples, not exported patient records.
export const observations: Observation[] = [
  {
    resourceType: 'Observation',
    id: 'demo-blood-pressure',
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
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '85354-9',
          display: 'Blood pressure panel with all children optional',
        },
      ],
      text: 'Blood pressure',
    },
    subject: { reference: 'Patient/demo-alex-morgan' },
    effectiveDateTime: '2026-10-01T09:30:00+01:00',
    component: [
      {
        code: {
          coding: [
            { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
          ],
          text: 'Systolic',
        },
        valueQuantity: {
          value: 118,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
      {
        code: {
          coding: [
            { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
          ],
          text: 'Diastolic',
        },
        valueQuantity: {
          value: 76,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
    ],
  },
  {
    resourceType: 'Observation',
    id: 'demo-heart-rate',
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
  },
  {
    resourceType: 'Observation',
    id: 'demo-body-weight',
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
    code: { coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body weight' }] },
    subject: { reference: 'Patient/demo-alex-morgan' },
    effectiveDateTime: '2026-10-01T09:30:00+01:00',
    valueQuantity: { value: 72.4, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' },
  },
];
