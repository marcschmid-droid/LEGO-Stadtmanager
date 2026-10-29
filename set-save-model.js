/* Parse a complete set form without dropping existing purchase/instance data. */
(function(root){
  'use strict';
  function build(get, previous, now = new Date().toISOString()) {
    const old = previous || {};
    const text = id => String(get(id) ?? '').trim();
    function number(id, fallback) {
      const value = text(id);
      if (!value) return fallback;
      const parsed = Number(value.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0) throw Error('Bitte gültige, nicht negative Zahlen eingeben.');
      return parsed;
    }
    const item = { ...old, setNumber: text('fSet'), name: text('fName'),
      quantity: number('fQty', old.quantity ?? 1),
      purchasePrice: number('fPrice', old.purchasePrice ?? null),
      currentValue: number('fValue', old.currentValue ?? null),
      cityArea: text('fArea'), category: text('fCat'), imageUrl: text('fImage'), note: text('fNote'),
      addedAt: old.addedAt || now };
    if (!item.setNumber || !item.name) throw Error('Setnummer und Setname fehlen.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw Error('Die Anzahl muss eine ganze Zahl ab 1 sein.');
    for (const dimension of ['Width','Depth','Height']) item[dimension.toLowerCase()] = number('f'+dimension, old[dimension.toLowerCase()] ?? null);
    // Optional enhancement fields may not exist if an older script failed to load.
    const fields = { fModule:'module', fCondition:'condition', fBuild:'buildStatus', fStorage:'storage',
      fStorageRoom:'storageRoom', fStorageShelf:'storageShelf', fStorageBin:'storageBin',
      fBarcode:'barcode', fPurchaseDate:'purchaseDate', fSeller:'seller' };
    for (const [id,key] of Object.entries(fields)) if (get(id) !== undefined && get(id) !== null) item[key] = text(id);
    if (item.module) item.module = item.module.toUpperCase();
    return item;
  }
  function canonical(value) {
    return Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  }
  function matches(actual, expected) {
    return !!actual && Object.keys(expected).every(key => JSON.stringify(canonical(actual[key])) === JSON.stringify(canonical(expected[key])));
  }
  const api = {build,matches};
  if(typeof module === 'object' && module.exports) module.exports=api;
  else root.BrickSetSave=api;
})(typeof window === 'object' ? window : globalThis);
