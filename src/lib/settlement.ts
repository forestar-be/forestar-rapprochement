import { formatAmount } from "@/lib/format";
import { ReminderSettlement } from "@/types";

// Facture sans virement au relevé mais soldée dans Dolibarr : ce que Dolibarr
// en dit, pour le tableau et la fenêtre de rappel.

export const settlementLabel = (settlement?: ReminderSettlement): string =>
  settlement?.status === "abandoned"
    ? "Abandonnée dans Dolibarr"
    : settlement?.status === "draft"
      ? "Brouillon dans Dolibarr"
      : "Soldée dans Dolibarr";

/** Ce que Dolibarr a pointé sur la facture, une ligne par paiement ou imputation. */
export const settlementLines = (settlement?: ReminderSettlement): string[] => {
  if (!settlement) return [];
  if (settlement.payments === null) return ["Détail du paiement illisible"];
  const lines = settlement.payments.map((payment) =>
    [
      payment.date,
      formatAmount(payment.amount),
      [payment.mode, payment.num && `n° ${payment.num}`]
        .filter(Boolean)
        .join(" "),
      payment.ref,
    ]
      .filter(Boolean)
      .join(" · ")
  );
  if (settlement.creditNotes > 0) {
    lines.push(`Avoir imputé · ${formatAmount(settlement.creditNotes)}`);
  }
  if (settlement.deposits > 0) {
    lines.push(`Acompte imputé · ${formatAmount(settlement.deposits)}`);
  }
  if (lines.length === 0 && settlement.status === "paid") {
    lines.push("Aucun paiement enregistré");
  }
  return lines;
};
