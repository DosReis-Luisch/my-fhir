import type { Patient } from '@myfhir/fhir-core';

export const patient = {
  resourceType: 'Patient',
  id: 'demo-alex-morgan',
  meta: {
    tag: [{ system: 'https://myfhir.example/tags', code: 'synthetic', display: 'Synthetic data' }],
  },
  active: true,
  name: [{ use: 'usual', given: ['Alex'], family: 'Morgan' }],
  gender: 'female',
  birthDate: '1990-04-12',
  extension: [
    {
      url: 'https://myfhir.example/StructureDefinition/demo-note',
      valueString: 'Entirely fictional record',
    },
  ],
} satisfies Patient;
