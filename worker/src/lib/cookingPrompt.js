/**
 * Prompt for "Come cuocerla" (POST /api/gemini/cooking-methods).
 * Kept apart from the route so scripts/check-ai-prompts.mjs can test the exact same text.
 */
import { recipeContextSummary } from './geminiClient.js'

export function buildCookingPrompt(recipe, { primary = null, params = {}, focusMethod = null } = {}) {
  const primaryBlock = primary
    ? `METODO DELLA RICETTA (già deciso, non cambiarlo): "${primary}"${
        params.temperature || params.time
          ? ` — dal testo: ${[params.temperature, params.time].filter(Boolean).join(', ')}`
          : ''
      }.
Per questo metodo copia ESATTAMENTE temperatura, modalità (statico/ventilato) e tempi scritti nella ricetta; non arrotondare e non "migliorare". Se la ricetta ha più fasi (es. griglia e poi forno), "time" è solo la fase di quel metodo.`
    : 'La ricetta non indica chiaramente un metodo: proponi quello più tradizionale per questo piatto.'

  const focusBlock = focusMethod
    ? `
FOCUS OBBLIGATORIO: l'utente ha scelto "${focusMethod}".
Restituisci UN oggetto con method="${focusMethod}": temperature, time, notes pratiche passo-passo, differences rispetto al metodo della ricetta.
Se "${focusMethod}" NON è adatto a questo piatto (es. bollitura per dei pancake), restituiscilo comunque con temperature e time vuoti e in notes spiega in 1-2 frasi perché è sconsigliato. Non inventare procedimenti assurdi.
Puoi aggiungere al massimo 1 alternativa breve.
`
    : ''

  const prompt = `Sei un cuoco esperto. Per questa ricetta indica come cuocerla con i metodi di cottura sensati.
Restituisci SOLO JSON:
{
"methods": [
  {
    "method": "forno|padella|friggitrice_aria|bollitura|vapore|grill|microonde",
    "label": "nome leggibile IT",
    "temperature": "es. 180°C statico, oppure fuoco medio; vuoto se non serve",
    "time": "es. 25-30 min",
    "notes": "come procedere, passi concreti e brevi",
    "differences": "cosa cambia rispetto al metodo della ricetta (texture, tempi, grassi)",
    "induction": "SOLO per padella, bollitura, vapore e grill su piastra: cosa cambia sul piano a induzione; stringa vuota per forno, friggitrice ad aria e microonde"
  }
],
"summary": "1-2 frasi: il metodo della ricetta e quando conviene un'alternativa"
}

${primaryBlock}

Regole per le ALTERNATIVE:
- Proponi solo metodi davvero adatti a QUESTO piatto (massimo 3 in totale, incluso quello della ricetta). Niente bollitura per impasti da cuocere in padella/forno, niente microonde per lievitati, ecc.
- Conversioni realistiche dal metodo della ricetta:
· forno ventilato ≈ statico −10/20 °C, tempi simili;
· friggitrice ad aria ≈ forno ventilato −10/20 °C e −20/30% del tempo, pezzi in un solo strato, girare a metà;
· teglie alte/sformati/torte in friggitrice ad aria solo se lo stampo ci sta: dillo.
- Carne, pollo, pesce, uova: se pertinente indica la temperatura al cuore di sicurezza (es. pollo 75 °C).
- "temperature" per i metodi sul fornello: indica l'intensità del fuoco (basso/medio/vivace) e tra parentesi il livello indicativo su un piano a induzione da 1 a 9, es. "fuoco medio (induzione 5-6)".

Campo "induction" (piano cottura a induzione), solo per i metodi sul fornello, 1-3 frasi concrete per QUESTO piatto:
- Tempi: l'induzione porta l'acqua a bollore e scalda la padella molto più in fretta (indicativamente −30/50% del tempo per arrivarci); una volta raggiunta la temperatura i tempi di cottura della ricetta restano quasi uguali. Dì esplicitamente se i tempi di QUESTA ricetta cambiano o no, e di quanto.
- Potenza: traduci le indicazioni della ricetta in livelli (es. fiamma vivace ≈ 7-8, media ≈ 5-6, bassa/sobbollire ≈ 2-3); non preriscaldare a vuoto alla massima potenza o con il booster; nei soffritti e nelle salse abbassa prima perché la risposta è immediata.
- Pentole: servono fondi magnetici e piatti; il wok a fondo tondo non va. Citalo solo se serve per questo piatto (es. wok, moka, pentole in alluminio o terracotta).
- Non ripetere la ricetta e non inventare tempi diversi senza motivo.
- Non inventare ingredienti; usa le quantità della ricetta. Lingua italiana.
${focusBlock}
RICETTA:
${recipeContextSummary(recipe)}`

  return prompt
}
