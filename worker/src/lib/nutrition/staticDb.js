/**
 * Static nutrition DB — values per 100 g (or 100 ml for oils/liquids ≈ g).
 * Italian common cooking ingredients for Recipe Book fallback.
 */

export const STATIC_NUTRITION = {
  // Cereali / farine / pasta
  pasta: { label: 'Pasta', calories: 359, protein: 12.5, fat: 1.5, carbs: 71.7, fiber: 3.2 },
  spaghetti: { label: 'Spaghetti', calories: 359, protein: 12.5, fat: 1.5, carbs: 71.7, fiber: 3.2 },
  penne: { label: 'Penne', calories: 359, protein: 12.5, fat: 1.5, carbs: 71.7, fiber: 3.2 },
  farina: { label: 'Farina 00', calories: 340, protein: 11, fat: 1, carbs: 72, fiber: 2.5 },
  'farina 00': { label: 'Farina 00', calories: 340, protein: 11, fat: 1, carbs: 72, fiber: 2.5 },
  riso: { label: 'Riso', calories: 358, protein: 6.7, fat: 0.5, carbs: 80, fiber: 1 },
  pane: { label: 'Pane', calories: 271, protein: 8.8, fat: 3.5, carbs: 50, fiber: 3.5 },
  pangrattato: { label: 'Pangrattato', calories: 365, protein: 12, fat: 2, carbs: 72, fiber: 4 },
  polenta: { label: 'Polenta / farina di mais', calories: 362, protein: 8.1, fat: 3.6, carbs: 74, fiber: 7 },

  // Latticini / uova
  uovo: { label: 'Uovo', calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7, fiber: 0 },
  uova: { label: 'Uova', calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7, fiber: 0 },
  tuorlo: { label: 'Tuorlo', calories: 322, protein: 15.9, fat: 26.5, carbs: 3.6, fiber: 0 },
  tuorli: { label: 'Tuorli', calories: 322, protein: 15.9, fat: 26.5, carbs: 3.6, fiber: 0 },
  albume: { label: 'Albume', calories: 48, protein: 10.9, fat: 0.2, carbs: 0.7, fiber: 0 },
  latte: { label: 'Latte intero', calories: 64, protein: 3.3, fat: 3.6, carbs: 4.8, fiber: 0 },
  'latte intero': { label: 'Latte intero', calories: 64, protein: 3.3, fat: 3.6, carbs: 4.8, fiber: 0 },
  burro: { label: 'Burro', calories: 717, protein: 0.9, fat: 81, carbs: 0.1, fiber: 0 },
  parmigiano: { label: 'Parmigiano', calories: 392, protein: 33, fat: 28.4, carbs: 3.2, fiber: 0 },
  'parmigiano reggiano': { label: 'Parmigiano', calories: 392, protein: 33, fat: 28.4, carbs: 3.2, fiber: 0 },
  pecorino: { label: 'Pecorino', calories: 387, protein: 28, fat: 30, carbs: 2, fiber: 0 },
  mozzarella: { label: 'Mozzarella', calories: 280, protein: 18, fat: 22, carbs: 2.2, fiber: 0 },
  ricotta: { label: 'Ricotta', calories: 174, protein: 11.3, fat: 13, carbs: 3, fiber: 0 },
  mascarpone: { label: 'Mascarpone', calories: 429, protein: 4.6, fat: 44, carbs: 4.2, fiber: 0 },
  panna: { label: 'Panna da cucina', calories: 292, protein: 2.2, fat: 30, carbs: 3.2, fiber: 0 },
  yogurt: { label: 'Yogurt bianco', calories: 61, protein: 3.5, fat: 3.3, carbs: 4.7, fiber: 0 },

  // Carni / salumi
  guanciale: { label: 'Guanciale', calories: 541, protein: 13, fat: 55, carbs: 0, fiber: 0 },
  pancetta: { label: 'Pancetta', calories: 458, protein: 15, fat: 44, carbs: 0.5, fiber: 0 },
  prosciutto: { label: 'Prosciutto crudo', calories: 250, protein: 26, fat: 16, carbs: 0.5, fiber: 0 },
  'prosciutto crudo': { label: 'Prosciutto crudo', calories: 250, protein: 26, fat: 16, carbs: 0.5, fiber: 0 },
  'prosciutto cotto': { label: 'Prosciutto cotto', calories: 145, protein: 20, fat: 7, carbs: 0.5, fiber: 0 },
  pollo: { label: 'Pollo (petto)', calories: 120, protein: 22.5, fat: 2.6, carbs: 0, fiber: 0 },
  'petto di pollo': { label: 'Petto di pollo', calories: 120, protein: 22.5, fat: 2.6, carbs: 0, fiber: 0 },
  manzo: { label: 'Manzo magro', calories: 150, protein: 21, fat: 7, carbs: 0, fiber: 0 },
  carne: { label: 'Carne magra', calories: 150, protein: 21, fat: 7, carbs: 0, fiber: 0 },
  salsiccia: { label: 'Salsiccia', calories: 301, protein: 15, fat: 26, carbs: 1, fiber: 0 },
  tonno: { label: 'Tonno', calories: 144, protein: 23, fat: 4.9, carbs: 0, fiber: 0 },
  salmone: { label: 'Salmone', calories: 208, protein: 20, fat: 13, carbs: 0, fiber: 0 },

  // Verdure / tuberi
  patate: { label: 'Patate', calories: 77, protein: 2, fat: 0.1, carbs: 17, fiber: 2.2 },
  patata: { label: 'Patata', calories: 77, protein: 2, fat: 0.1, carbs: 17, fiber: 2.2 },
  pomodoro: { label: 'Pomodoro', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2 },
  pomodori: { label: 'Pomodori', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2 },
  'passata di pomodoro': { label: 'Passata di pomodoro', calories: 24, protein: 1.2, fat: 0.2, carbs: 4.5, fiber: 1.5 },
  cipolla: { label: 'Cipolla', calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fiber: 1.7 },
  aglio: { label: 'Aglio', calories: 149, protein: 6.4, fat: 0.5, carbs: 33, fiber: 2.1 },
  carota: { label: 'Carota', calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6, fiber: 2.8 },
  carote: { label: 'Carote', calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6, fiber: 2.8 },
  zucchina: { label: 'Zucchina', calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1 },
  zucchine: { label: 'Zucchine', calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1 },
  melanzana: { label: 'Melanzana', calories: 25, protein: 1, fat: 0.2, carbs: 5.9, fiber: 3 },
  melanzane: { label: 'Melanzane', calories: 25, protein: 1, fat: 0.2, carbs: 5.9, fiber: 3 },
  spinaci: { label: 'Spinaci', calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2 },
  basilico: { label: 'Basilico', calories: 23, protein: 3.2, fat: 0.6, carbs: 2.7, fiber: 1.6 },
  prezzemolo: { label: 'Prezzemolo', calories: 36, protein: 3, fat: 0.8, carbs: 6.3, fiber: 3.3 },
  limone: { label: 'Limone', calories: 29, protein: 1.1, fat: 0.3, carbs: 9.3, fiber: 2.8 },
  arancia: { label: 'Arancia', calories: 47, protein: 0.9, fat: 0.1, carbs: 12, fiber: 2.4 },
  mela: { label: 'Mela', calories: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4 },
  banana: { label: 'Banana', calories: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6 },

  // Grassi / condimenti
  olio: { label: 'Olio di oliva', calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0 },
  'olio d\'oliva': { label: 'Olio di oliva', calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0 },
  'olio di oliva': { label: 'Olio di oliva', calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0 },
  'olio evo': { label: 'Olio EVO', calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0 },
  sale: { label: 'Sale', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  pepe: { label: 'Pepe', calories: 251, protein: 10, fat: 3.3, carbs: 64, fiber: 25 },
  zucchero: { label: 'Zucchero', calories: 387, protein: 0, fat: 0, carbs: 100, fiber: 0 },
  miele: { label: 'Miele', calories: 304, protein: 0.3, fat: 0, carbs: 82, fiber: 0.2 },
  aceto: { label: 'Aceto', calories: 18, protein: 0, fat: 0, carbs: 0.4, fiber: 0 },
  'aceto balsamico': { label: 'Aceto balsamico', calories: 88, protein: 0.5, fat: 0, carbs: 17, fiber: 0 },

  // Legumi / altro
  ceci: { label: 'Ceci', calories: 364, protein: 19, fat: 6, carbs: 61, fiber: 17 },
  lenticchie: { label: 'Lenticchie', calories: 352, protein: 25, fat: 1.1, carbs: 60, fiber: 11 },
  fagioli: { label: 'Fagioli', calories: 333, protein: 23, fat: 0.8, carbs: 60, fiber: 15 },
  lievito: { label: 'Lievito di birra', calories: 325, protein: 40, fat: 7.6, carbs: 41, fiber: 27 },
  'lievito di birra': { label: 'Lievito di birra', calories: 325, protein: 40, fat: 7.6, carbs: 41, fiber: 27 },
  'lievito per dolci': { label: 'Lievito per dolci', calories: 79, protein: 0.1, fat: 0, carbs: 19, fiber: 0 },
  cacao: { label: 'Cacao amaro', calories: 228, protein: 20, fat: 14, carbs: 58, fiber: 33 },
  cioccolato: { label: 'Cioccolato fondente', calories: 546, protein: 4.9, fat: 31, carbs: 61, fiber: 7 },
  vino: { label: 'Vino', calories: 85, protein: 0.1, fat: 0, carbs: 2.6, fiber: 0 },
  'vino bianco': { label: 'Vino bianco', calories: 82, protein: 0.1, fat: 0, carbs: 2.6, fiber: 0 },
  'vino rosso': { label: 'Vino rosso', calories: 85, protein: 0.1, fat: 0, carbs: 2.6, fiber: 0 },
  acqua: { label: 'Acqua', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
}

/** Normalize ingredient name for lookup. */
export function normalizeIngredientName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Find best static match for an ingredient name.
 * @returns {{ key, per100g, matchScore } | null}
 */
export function lookupStatic(name) {
  const n = normalizeIngredientName(name)
  if (!n) return null

  if (STATIC_NUTRITION[n]) {
    return { key: n, per100g: STATIC_NUTRITION[n], matchScore: 1 }
  }

  // Prefer longer keys that are contained in the name (e.g. "olio d'oliva evo")
  const keys = Object.keys(STATIC_NUTRITION).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (n.includes(key) || key.includes(n)) {
      return { key, per100g: STATIC_NUTRITION[key], matchScore: 0.85 }
    }
  }

  // Token overlap: first significant token
  const tokens = n.split(' ').filter((t) => t.length > 2)
  for (const token of tokens) {
    if (STATIC_NUTRITION[token]) {
      return { key: token, per100g: STATIC_NUTRITION[token], matchScore: 0.6 }
    }
  }

  return null
}
