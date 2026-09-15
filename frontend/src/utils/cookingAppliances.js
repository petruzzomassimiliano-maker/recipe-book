/** Catalogo elettrodomestici / metodi cottura usati in UI e API. */

export const COOKING_APPLIANCES = [
  {
    id: 'friggitrice_aria',
    label: 'Friggitrice ad aria',
    short: 'Aria',
    common: true,
    patterns: [
      /friggitrice\s+ad\s+aria/i,
      /friggitrice\s+adaria/i,
      /air\s*[- ]?\s*fryer/i,
      /\bairfryer\b/i,
      /cottura\s+ad\s+aria/i
    ]
  },
  {
    id: 'forno',
    label: 'Forno',
    short: 'Forno',
    common: true,
    patterns: [
      /\bin\s+forno\b/i,
      /\bforno\b/i,
      /pre.?riscalda(re|to)?\s+il\s+forno/i
    ]
  },
  {
    id: 'padella',
    label: 'Padella',
    short: 'Padella',
    common: true,
    patterns: [
      /\bpadella\b/i,
      /\bin\s+padella\b/i,
      /\bsoffrigg/i,
      /\brosol/i,
      /\bwok\b/i
    ]
  },
  {
    id: 'bollitura',
    label: 'Bollitura',
    short: 'Bollire',
    common: true,
    patterns: [/\bboll[ie]/i, /\bin\s+acqua\s+(bollente|salata)/i, /\bcasseruola\b/i]
  },
  {
    id: 'vapore',
    label: 'Vapore',
    short: 'Vapore',
    common: false,
    patterns: [/\bavapore\b/i, /\ba\s+vapore\b/i, /\bvaporiera\b/i, /\bsteam(er)?\b/i]
  },
  {
    id: 'grill',
    label: 'Grill',
    short: 'Grill',
    common: false,
    patterns: [/\bgrill\b/i, /\bgriglia\b/i, /\bbarbecue\b/i, /\bbbq\b/i]
  },
  {
    id: 'microonde',
    label: 'Microonde',
    short: 'Micro',
    common: false,
    patterns: [/\bmicroonde\b/i, /\bmicrowave\b/i]
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

export function recipeSearchBlob(recipe) {
  if (!recipe) return ''
  const steps = (recipe.steps || []).map((s) => s.instruction || s.text || '').join(' ')
  const ings = (recipe.ingredients || []).map((i) => i.name || '').join(' ')
  return [
    recipe.title,
    recipe.notes,
    recipe.sourceUrl,
    recipe.source,
    steps,
    ings,
    ...(recipe.metadata?.tags || [])
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Metodi esplicitamente citati nel titolo / testo (senza IA).
 * Il titolo pesa di più: un match nel titolo è sempre "nella ricetta".
 */
export function detectMentionedMethods(recipe) {
  const title = String(recipe?.title || '')
  const blob = recipeSearchBlob(recipe)
  const found = []

  for (const app of COOKING_APPLIANCES) {
    const inTitle = app.patterns.some((re) => re.test(title))
    const inBody = app.patterns.some((re) => re.test(blob))
    if (inTitle || inBody) {
      found.push({
        method: app.id,
        label: app.label,
        fromTitle: inTitle,
        recommended: inTitle
      })
    }
  }

  // Titolo "friggitrice" vince su match deboli tipo °C → forno
  if (found.some((f) => f.method === 'friggitrice_aria' && f.fromTitle)) {
    return found.map((f) =>
      f.method === 'friggitrice_aria'
        ? { ...f, recommended: true }
        : { ...f, recommended: false }
    )
  }

  return found
}

export function applianceById(id) {
  const normalized = normalizeMethodId(id)
  return COOKING_APPLIANCES.find((a) => a.id === normalized) || null
}
