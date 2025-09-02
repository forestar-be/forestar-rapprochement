// Script de test rapide pour vérifier la correction des statistiques
const matches = [
  {
    id: "cmf1on7ze001o2udo3b3w7pws",
    invoiceId: "cmf1omvwx000v2udoiuffjn8u",
    bankTransactionId: "cmf1omvxd001c2udo3a3fab92", // ✅ Transaction
    matchType: "EXACT_REF",
    invoice: { montantTTC: -200 },
  },
  {
    id: "cmf1on808001q2udor39t7wqi",
    invoiceId: "cmf1omvwx000r2udof8bw7ntu",
    bankTransactionId: "cmf1omvxd001a2udomqblo7um", // ✅ Transaction
    matchType: "EXACT_AMOUNT",
    invoice: { montantTTC: 1000 },
  },
  {
    id: "cmf1on80i001s2udo826u3wqr",
    invoiceId: "cmf1omvwx000s2udo31a400g0",
    bankTransactionId: "cmf1omvxd001a2udomqblo7um", // ✅ Transaction
    matchType: "EXACT_AMOUNT",
    invoice: { montantTTC: 1000 },
  },
  {
    id: "cmf1on80v001u2udoz92jfzk2",
    invoiceId: "cmf1omvwx00102udo687m9cbh",
    bankTransactionId: "cmf1omvxd001d2udokwnawj5s", // ✅ Transaction
    matchType: "EXACT_AMOUNT",
    invoice: { montantTTC: 1331 },
  },
  {
    id: "cmf1on81c001w2udoxgf034t3",
    invoiceId: "cmf1omvwx000t2udo08pfjqro",
    bankTransactionId: null, // ❌ Pas de transaction
    matchType: "FUZZY_NAME",
    invoice: { montantTTC: 2000 },
  },
  {
    id: "cmf1on81p001y2udow6q3e864",
    invoiceId: "cmf1omvwx000q2udo462h25qt",
    bankTransactionId: null, // ❌ Pas de transaction
    matchType: "NONE",
    invoice: { montantTTC: 605 },
  },
  {
    id: "cmf1on82000202udofr59ttfp",
    invoiceId: "cmf1omvwx000w2udoqo2842mr",
    bankTransactionId: null, // ❌ Pas de transaction
    matchType: "NONE",
    invoice: { montantTTC: 1500 },
  },
  {
    id: "cmf1on82a00222udo9gr6ymq7",
    invoiceId: "cmf1omvwx000x2udojlg33uo3",
    bankTransactionId: null, // ❌ Pas de transaction
    matchType: "NONE",
    invoice: { montantTTC: 500 },
  },
];

console.log("=== TEST DES CORRECTIONS STATISTIQUES ===\n");

// Ancienne logique (incorrecte)
let oldExactMatches = 0;
let oldFuzzyMatches = 0;
let oldNoMatches = 0;
let oldTotalMatchedAmount = 0;
let oldTotalUnmatchedAmount = 0;

matches.forEach((match) => {
  if (match.bankTransactionId) {
    if (match.matchType === "EXACT_REF" || match.matchType === "EXACT_AMOUNT") {
      oldExactMatches++;
    } else {
      oldFuzzyMatches++; // ❌ BUG: compte FUZZY même sans transaction
    }
    oldTotalMatchedAmount += match.invoice.montantTTC;
  } else {
    oldNoMatches++;
    oldTotalUnmatchedAmount += match.invoice.montantTTC;
  }
});

const oldReconciliationRate = Math.round(
  ((oldExactMatches + oldFuzzyMatches) / matches.length) * 100
);

console.log("ANCIENNE LOGIQUE (incorrecte):");
console.log(`- Exact matches: ${oldExactMatches}`);
console.log(`- Fuzzy matches: ${oldFuzzyMatches}`);
console.log(`- No matches: ${oldNoMatches}`);
console.log(`- Taux réconciliation: ${oldReconciliationRate}%`);
console.log(`- Montant apparié: ${oldTotalMatchedAmount}€`);

// Nouvelle logique (corrigée)
let newExactMatches = 0;
let newFuzzyMatches = 0;
let newNoMatches = 0;
let newTotalMatchedAmount = 0;
let newTotalUnmatchedAmount = 0;

matches.forEach((match) => {
  if (match.bankTransactionId) {
    // Seulement compter les matches avec vraie transaction
    if (match.matchType === "EXACT_REF" || match.matchType === "EXACT_AMOUNT") {
      newExactMatches++;
    } else if (
      match.matchType === "FUZZY_NAME" ||
      match.matchType === "COMBINED" ||
      match.matchType === "MANUAL"
    ) {
      newFuzzyMatches++;
    }
    newTotalMatchedAmount += match.invoice.montantTTC;
  } else {
    // Pas de transaction = pas d'appariement réel
    newNoMatches++;
    newTotalUnmatchedAmount += match.invoice.montantTTC;
  }
});

const newReconciliationRate = Math.round(
  ((newExactMatches + newFuzzyMatches) / matches.length) * 100
);

console.log("\nNOUVELLE LOGIQUE (corrigée):");
console.log(`- Exact matches: ${newExactMatches}`);
console.log(`- Fuzzy matches: ${newFuzzyMatches}`);
console.log(`- No matches: ${newNoMatches}`);
console.log(`- Taux réconciliation: ${newReconciliationRate}%`);
console.log(`- Montant apparié: ${newTotalMatchedAmount}€`);

console.log("\n=== RÉSUMÉ ===");
console.log(
  `Ancien taux: ${oldReconciliationRate}% → Nouveau taux: ${newReconciliationRate}%`
);
console.log(`Différence: ${newReconciliationRate - oldReconciliationRate}%`);

// Simulation avec 19 factures au total (comme dans les vraies données)
const totalInvoicesInDB = 19;
const realNewRate = Math.round(
  ((newExactMatches + newFuzzyMatches) / totalInvoicesInDB) * 100
);
console.log(`\nAvec ${totalInvoicesInDB} factures au total: ${realNewRate}%`);
