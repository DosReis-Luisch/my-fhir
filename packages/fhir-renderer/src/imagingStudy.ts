import { hasSupportedImagingStudyMetadata, type ImagingStudy } from '@myfhir/fhir-core';
import type { PresentationField } from './descriptor';

const modalitySystem = 'http://dicom.nema.org/resources/ontology/DCM';

/** Metadata only. Available/registered do not prove completion or that images can be retrieved. */
export function imagingStudySummary(resource: ImagingStudy) {
  if (
    (resource.status !== 'available' && resource.status !== 'registered') ||
    !hasSupportedImagingStudyMetadata(resource)
  )
    return undefined;
  if (
    ['text', 'note', 'endpoint', '_started', '_description'].some((field) =>
      Object.hasOwn(resource, field),
    )
  )
    return undefined;
  if (
    resource.modality?.some(
      (coding) => coding.system !== modalitySystem || coding.version !== undefined,
    ) ||
    resource.series?.some(
      (series) =>
        series.modality.system !== modalitySystem ||
        series.modality.version !== undefined ||
        ['endpoint', '_uid', '_description', '_started'].some((field) =>
          Object.hasOwn(series, field),
        ) ||
        series.instance?.some((instance) => Object.hasOwn(instance, '_uid')),
    )
  )
    return undefined;
  const fields: PresentationField[] = [
    { label: 'Study status', value: resource.status, sourcePath: 'status' },
  ];
  if (resource.started !== undefined)
    fields.push({
      label: 'Study started (as supplied)',
      value: resource.started,
      sourcePath: 'started',
    });
  resource.identifier?.forEach((identifier, index) =>
    fields.push({
      label: 'Study identifier (not the FHIR logical ID)',
      value: `${identifier.system ?? 'System not supplied'} | ${identifier.value}`,
      sourcePath: `identifier[${index}]`,
    }),
  );
  for (const [key, label] of [
    ['numberOfSeries', 'Reported number of series'],
    ['numberOfInstances', 'Reported number of instances'],
  ] as const) {
    if (resource[key] !== undefined)
      fields.push({ label, value: String(resource[key]), sourcePath: key });
  }
  resource.modality?.forEach((coding, index) =>
    fields.push({
      label: 'Supplied modality coding',
      value: `${coding.system} | ${coding.code}`,
      sourcePath: `modality[${index}]`,
    }),
  );
  if (resource.series !== undefined)
    fields.push({
      label: 'Listed series metadata entries (may be partial)',
      value: String(resource.series.length),
      sourcePath: 'series',
    });
  resource.series?.forEach((series, index) => {
    const path = `series[${index}]`;
    fields.push({ label: 'Series UID', value: series.uid, sourcePath: `${path}.uid` });
    if (series.description !== undefined)
      fields.push({
        label: 'Series description (as supplied)',
        value: series.description,
        sourcePath: `${path}.description`,
      });
    fields.push({
      label: 'Supplied series modality coding',
      value: `${series.modality.system} | ${series.modality.code}`,
      sourcePath: `${path}.modality`,
    });
    if (series.numberOfInstances !== undefined)
      fields.push({
        label: 'Reported series instance count',
        value: String(series.numberOfInstances),
        sourcePath: `${path}.numberOfInstances`,
      });
    if (series.instance !== undefined)
      fields.push({
        label: 'Listed instance metadata entries (may be partial)',
        value: String(series.instance.length),
        sourcePath: `${path}.instance`,
      });
    series.instance?.forEach((instance, instanceIndex) =>
      fields.push({
        label: 'SOP Instance UID (metadata only)',
        value: instance.uid,
        sourcePath: `${path}.instance[${instanceIndex}].uid`,
      }),
    );
  });
  return { title: resource.description ?? 'Imaging study', fields };
}
