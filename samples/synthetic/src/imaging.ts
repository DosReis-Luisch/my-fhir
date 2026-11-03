import type { DiagnosticReport, ImagingStudy } from '@myfhir/fhir-core';

// Hand-authored fiction in the explicitly shared dashboard demo namespace. No clinical export.
export const imagingContext = Object.freeze({
  sourceNamespace: 'urn:myfhir:synthetic:dashboard',
  patientId: 'demo-alex-morgan',
});

export const imagingStudy: ImagingStudy = {
  resourceType: 'ImagingStudy',
  id: 'fictional-chest-study',
  meta: { versionId: '1' },
  status: 'available',
  subject: { reference: 'Patient/demo-alex-morgan' },
  description: 'Fictional chest examination — metadata only',
  identifier: [{ system: 'urn:dicom:uid', value: 'urn:oid:2.25.202611030401' }],
  started: '2026-10-20T10:00:00+01:00',
  modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'DX' }],
  numberOfSeries: 1,
  numberOfInstances: 1,
  series: [
    {
      uid: '2.25.2026110304011',
      number: 1,
      modality: { system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'DX' },
      description: 'Fictional series metadata',
      numberOfInstances: 1,
      instance: [
        {
          uid: '2.25.20261103040111',
          number: 1,
          sopClass: { system: 'urn:ietf:rfc:3986', code: 'urn:oid:1.2.840.10008.5.1.4.1.1.1.1' },
          title: 'Fictional instance metadata — no pixels supplied',
        },
      ],
    },
  ],
};

export const radiologyReport: DiagnosticReport = {
  resourceType: 'DiagnosticReport',
  id: 'fictional-radiology-report',
  meta: { versionId: '1' },
  status: 'final',
  subject: { reference: 'Patient/demo-alex-morgan' },
  category: [
    { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'RAD' }] },
  ],
  code: { text: 'Fictional radiology report — metadata only' },
  effectiveDateTime: '2026-10-20T10:05:00+01:00',
  issued: '2026-10-20T11:30:00+01:00',
  imagingStudy: [{ reference: 'ImagingStudy/fictional-chest-study' }],
};
