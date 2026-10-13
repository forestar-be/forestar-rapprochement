import type { StatusTone } from "@forestar-be/ui";
import type { InvoiceFamilySummary } from "@/types";

export const getStatusLabel = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "Terminé";
    case "ERROR":
      return "Erreur";
    case "PROCESSING":
      return "En cours";
    case "PENDING":
      return "En attente";
    default:
      return "Inconnu";
  }
};

export const getMatchTypeLabel = (
  matchType: string,
  validationStatus?: string,
  isManualMatch?: boolean
) => {
  // Si c'est une correspondance manuelle, afficher "Manuel" en priorité
  if (isManualMatch) {
    return "Manuel";
  }

  // Si c'est validé ou rejeté, afficher le statut de validation
  if (validationStatus === "VALIDATED") {
    return "Validée";
  }
  if (validationStatus === "REJECTED") {
    return "Rejetée";
  }

  // Sinon, afficher le type de correspondance normal
  switch (matchType) {
    case "EXACT_REF":
      return "Référence";
    case "EXACT_AMOUNT":
      return "Montant seul";
    case "REFINED_AMOUNT":
      return "Montant + payeur";
    case "SIMPLE_NAME":
      return "Nom exact";
    case "FUZZY_NAME":
      return "Nom approchant";
    case "COMBINED":
      return "Combiné";
    case "NONE":
      return "Non appariée";
    default:
      return "Inconnu";
  }
};

// Nouvelle fonction pour obtenir uniquement le type de correspondance
export const getMatchTypeOnly = (
  matchType: string,
  isManualMatch?: boolean
) => {
  if (isManualMatch) {
    return "Manuel";
  }

  switch (matchType) {
    case "EXACT_REF":
      return "Référence";
    case "EXACT_AMOUNT":
      return "Montant seul";
    case "REFINED_AMOUNT":
      return "Montant + payeur";
    case "SIMPLE_NAME":
      return "Nom exact";
    case "FUZZY_NAME":
      return "Nom approchant";
    case "COMBINED":
      return "Combiné";
    case "NONE":
      return "Non appariée";
    default:
      return "Inconnu";
  }
};

// Nouvelle fonction pour obtenir uniquement le statut de validation
export const getValidationStatusLabel = (validationStatus?: string) => {
  switch (validationStatus) {
    case "VALIDATED":
      return "Validée";
    case "REJECTED":
      return "Rejetée";
    case "PENDING":
      return "En attente";
    default:
      return "En attente";
  }
};

/** Intention d'un statut de rapprochement, pour `StatusBadge`. */
export const getStatusTone = (status: string): StatusTone => {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "ERROR":
      return "danger";
    case "PROCESSING":
      return "info";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
};

/** Intention du statut de validation d'une correspondance. */
export const getValidationStatusTone = (
  validationStatus?: string
): StatusTone => {
  switch (validationStatus) {
    case "VALIDATED":
      return "success";
    case "REJECTED":
      return "danger";
    default:
      return "warning";
  }
};

/**
 * Intention du type de correspondance : plus l'algorithme est sûr, plus la
 * teinte est franche. Une correspondance manuelle est un choix de la personne,
 * pas un score : elle reste neutre.
 */
export const getMatchTypeTone = (
  matchType: string,
  isManualMatch?: boolean
): StatusTone => {
  if (isManualMatch) return "neutral";

  switch (matchType) {
    case "EXACT_REF":
      return "success";
    case "REFINED_AMOUNT":
    case "SIMPLE_NAME":
      return "info";
    // Montant égal sans payeur reconnu : proposé, à vérifier.
    case "EXACT_AMOUNT":
    case "FUZZY_NAME":
      return "warning";
    case "NONE":
      return "danger";
    default:
      return "neutral";
  }
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDuration = (startTime: string, endTime?: string) => {
  if (!endTime) return "-";

  const start = new Date(startTime);
  const end = new Date(endTime);
  const duration = Math.round((end.getTime() - start.getTime()) / 1000);

  if (duration < 60) {
    return `${duration}s`;
  } else if (duration < 3600) {
    return `${Math.round(duration / 60)}min`;
  } else {
    return `${Math.round(duration / 3600)}h`;
  }
};

// Capitalise la première lettre d'une chaîne
export const capitalizeFirstLetter = (str: string) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Formate le titre d'affichage d'un rapprochement
export const getReconciliationDisplayTitle = (
  title?: string,
  createdAt?: string
) => {
  if (title && title.trim()) {
    return capitalizeFirstLetter(title.trim());
  }

  if (createdAt) {
    return `Rapprochement du ${formatDate(createdAt)}`;
  }

  return "Rapprochement";
};

/** Confiance à partir de laquelle une association est sûre (comme le serveur). */
export const SURE_CONFIDENCE = 80;

export interface ConfidenceDisplay {
  percent: number;
  tone: "primary" | "success" | "warning" | "danger";
  label: string;
}

/**
 * Niveau de confiance affiché d'une correspondance : une correspondance
 * manuelle ou validée vaut 100 %, une rejetée 0 %, les autres leur score
 * (vert à partir de 80, jaune à partir de 50, rouge en dessous).
 *
 * `hasTransaction` à `false` donne 0 % à une correspondance non manuelle et non
 * rejetée : sans transaction, il n'y a rien à valider.
 */
export const getConfidenceDisplay = (
  match: {
    isManualMatch: boolean;
    validationStatus?: string;
    confidence: number;
  },
  hasTransaction: boolean
): ConfidenceDisplay => {
  if (match.isManualMatch && hasTransaction) {
    return { percent: 100, tone: "primary", label: "100%" };
  }
  if (match.validationStatus === "VALIDATED" && hasTransaction) {
    return { percent: 100, tone: "success", label: "100%" };
  }
  if (match.validationStatus === "REJECTED" || !hasTransaction) {
    return { percent: 0, tone: "danger", label: "0%" };
  }
  return {
    percent: match.confidence,
    tone:
      match.confidence >= SURE_CONFIDENCE
        ? "success"
        : match.confidence >= 50
          ? "warning"
          : "danger",
    label: `${match.confidence.toFixed(0)}%`,
  };
};

/**
 * Familles de factures retenues au lancement (R005), pour l'historique et le
 * détail. Liste absente ou vide : rapprochement antérieur, toutes les factures.
 */
export const formatInvoiceFamilies = (families?: string[] | null): string =>
  families && families.length > 0 ? families.join(", ") : "Toutes";

/** Cumul des familles cochées : lignes, dont écartées d'office, et total TTC. */
export const summarizeSelectedFamilies = (
  families: InvoiceFamilySummary[],
  selected: ReadonlySet<string>
) =>
  families
    .filter((f) => selected.has(f.family))
    .reduce(
      (total, f) => ({
        count: total.count + f.count,
        excludedCash: total.excludedCash + f.excludedCash,
        totalTTC: total.totalTTC + f.totalTTC,
      }),
      { count: 0, excludedCash: 0, totalTTC: 0 }
    );

export type InvoicePaymentState = "sure" | "to-verify" | "unpaid";

/**
 * Où en est le paiement d'une facture, d'après toutes ses lignes d'association
 * (comme le serveur, qui enregistre les mêmes comptes) :
 * - sûr : une ligne a une transaction ET (confiance sûre, validée ou manuelle) ;
 * - à vérifier : une ligne a une transaction, sans que ce soit sûr ;
 * - sans paiement : aucune ligne n'a de transaction.
 */
export const getInvoicePaymentState = (
  matches: {
    transactionId?: string | null;
    confidence: number;
    isManualMatch: boolean;
    validationStatus?: string;
  }[]
): InvoicePaymentState => {
  const linked = matches.filter((m) => m.transactionId);
  if (linked.length === 0) return "unpaid";
  return linked.some(
    (m) =>
      m.confidence >= SURE_CONFIDENCE ||
      m.validationStatus === "VALIDATED" ||
      m.isManualMatch
  )
    ? "sure"
    : "to-verify";
};

/** Factures sûres, à vérifier et sans paiement, une fois par facture. */
export const countInvoicePaymentStates = (
  matches: (Parameters<typeof getInvoicePaymentState>[0][number] & {
    invoiceId: string;
  })[]
): Record<InvoicePaymentState, number> => {
  const byInvoice = new Map<string, typeof matches>();
  for (const match of matches) {
    const group = byInvoice.get(match.invoiceId);
    if (group) group.push(match);
    else byInvoice.set(match.invoiceId, [match]);
  }
  const counts = { sure: 0, "to-verify": 0, unpaid: 0 };
  for (const group of byInvoice.values()) {
    counts[getInvoicePaymentState(group)]++;
  }
  return counts;
};

/**
 * Payeur et communication d'un libellé de virement Belfius :
 * « Virement en euros (SEPA) De: NOM - BE00… Communication: TEXTE Info
 * personnelle: … ». Une partie introuvable est omise ; sans rien d'extrait, le
 * libellé reste à l'appelant.
 */
export const parseTransactionLabel = (
  label?: string | null
): { payer?: string; communication?: string } => {
  if (!label) return {};
  const payer = label.match(/\bDe:\s*(.+?)\s+-\s+[A-Z]{2}\d{2}/)?.[1]?.trim();
  const communication = label
    .match(
      /\bCommunication:\s*([\s\S]*?)\s*(?:Info personnelle|Virement\b|$)/
    )?.[1]
    ?.trim();
  return {
    ...(payer ? { payer } : {}),
    ...(communication ? { communication } : {}),
  };
};
