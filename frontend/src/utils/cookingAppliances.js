/** Catalogo elettrodomestici / metodi cottura usati in UI (riconoscimento nel testo: cookingDetect.js). */

export const COOKING_APPLIANCES = [
  {
    id: 'friggitrice_aria',
    label: 'Friggitrice ad aria',
    short: 'Aria',
    common: true
  },
  {
    id: 'forno',
    label: 'Forno',
    short: 'Forno',
    common: true
  },
  {
    id: 'padella',
    label: 'Padella',
    short: 'Padella',
    common: true
  },
  {
    id: 'bollitura',
    label: 'Bollitura',
    short: 'Bollire',
    common: true
  },
  {
    id: 'vapore',
    label: 'Vapore',
    short: 'Vapore',
    common: false
  },
  {
    id: 'grill',
    label: 'Grill',
    short: 'Grill',
    common: false
  },
  {
    id: 'microonde',
    label: 'Microonde',
    short: 'Micro',
    common: false
  }
]

/** Icone sempre visibili in UI (i più usati in cucina casalinga). */
export const COMMON_COOKING_APPLIANCES = COOKING_APPLIANCES.filter((a) => a.common)

const METHOD_ALIASES = {
  friggitrice: 'friggitrice_aria',
  air_fryer: 'friggitrice_aria',
  airfryer: 'friggitrice_aria',
  oven: 'forno',
  pan: 'padella',
  boil: 'bollitura',
  steam: 'vapore',
  microwave: 'microonde'
}

export function normalizeMethodId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return METHOD_ALIASES[id] || id
}

export function applianceById(id) {
  const normalized = normalizeMethodId(id)
  return COOKING_APPLIANCES.find((a) => a.id === normalized) || null
}
