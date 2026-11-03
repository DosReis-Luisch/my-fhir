// Bounded plain JSON data only. Never invoke accessors or silently strip unknown fields.
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function snapshotJson(input: unknown): unknown {
  let remaining = 10000;
  const ancestors = new Set<object>();

  function copy(value: unknown, depth: number): JsonValue {
    if (--remaining < 0 || depth > 64) throw new Error('JSON limits exceeded.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || ancestors.has(value)) throw new Error('Not plain JSON.');

    const array = Array.isArray(value) ? value : undefined;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) {
      throw new Error('Not a plain object.');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > remaining) throw new Error('JSON limits exceeded.');
    ancestors.add(value);
    const entries: [string, JsonValue][] = [];
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('Symbol properties are unsupported.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new Error('Only enumerable data properties are supported.');
      }
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= array.length)) {
        throw new Error('Custom array properties are unsupported.');
      }
      entries.push([key, copy(descriptor.value, depth + 1)]);
    }
    ancestors.delete(value);
    if (array && entries.length !== array.length) throw new Error('Sparse arrays are unsupported.');
    const result = array ? entries.map((entry) => entry[1]) : Object.fromEntries(entries);
    Object.freeze(result);
    return result;
  }

  return copy(input, 0);
}

// Object key order is insignificant; array order, all supplied fields and values matter.
// Called only on snapshots produced above. This is content comparison, not a security hash.
export function contentKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(contentKey).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${contentKey(object[key])}`)
      .join(',')}}`;
  }
  return Object.is(value, -0) ? '-0' : JSON.stringify(value)!;
}
