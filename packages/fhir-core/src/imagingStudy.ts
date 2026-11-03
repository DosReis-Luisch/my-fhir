function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function optionalText(value: unknown, field: string): boolean {
  const entry = object(value) && Object.hasOwn(value, field) ? value[field] : undefined;
  return entry === undefined || text(entry);
}
function count(value: unknown): boolean {
  return (
    value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  );
}
// Selected UID syntax only; not DICOM conformance, allocation or real-world uniqueness validation.
function uid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length <= 64 &&
    /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+$/.test(value)
  );
}
function coding(value: unknown): boolean {
  return (
    object(value) &&
    text(value.system) &&
    text(value.code) &&
    optionalText(value, 'display') &&
    optionalText(value, 'version')
  );
}

/** Basic selected metadata shapes only. Not a resource type guard or FHIR/DICOM validator. */
export function hasSupportedImagingStudyMetadata(value: unknown): boolean {
  if (
    !object(value) ||
    !optionalText(value, 'description') ||
    !optionalText(value, 'started') ||
    !count(value.numberOfSeries) ||
    !count(value.numberOfInstances)
  )
    return false;
  if (
    value.identifier !== undefined &&
    (!Array.isArray(value.identifier) ||
      !value.identifier.every((identifier) => {
        if (!object(identifier) || !text(identifier.value) || !optionalText(identifier, 'system')) {
          return false;
        }
        return (
          identifier.system !== 'urn:dicom:uid' ||
          (identifier.value.startsWith('urn:oid:') && uid(identifier.value.slice(8)))
        );
      }))
  )
    return false;
  if (
    value.modality !== undefined &&
    (!Array.isArray(value.modality) || !value.modality.every(coding))
  )
    return false;
  if (value.series === undefined) return true;
  if (!Array.isArray(value.series)) return false;
  return value.series.every((series) => {
    if (
      !object(series) ||
      !uid(series.uid) ||
      !coding(series.modality) ||
      !optionalText(series, 'description') ||
      !optionalText(series, 'started') ||
      !count(series.number) ||
      !count(series.numberOfInstances)
    )
      return false;
    if (series.instance === undefined) return true;
    return (
      Array.isArray(series.instance) &&
      series.instance.every(
        (instance) =>
          object(instance) &&
          uid(instance.uid) &&
          coding(instance.sopClass) &&
          count(instance.number) &&
          optionalText(instance, 'title'),
      )
    );
  });
}
