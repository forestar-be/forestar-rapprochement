import React, { useMemo } from "react";
import { AlertTriangle, Check, Eye, Mail, Pencil, X } from "lucide-react";
import {
  Button,
  DataTable,
  Progress,
  StatusBadge,
  type ColumnDef,
} from "@forestar-be/ui";
import {
  DetailedBankTransaction,
  DetailedInvoice,
  DetailedReconciliationMatch,
} from "@/types";
import {
  getConfidenceDisplay,
  getMatchTypeOnly,
  getMatchTypeTone,
  getValidationStatusLabel,
  getValidationStatusTone,
  parseTransactionLabel,
} from "@/lib/reconciliationUtils";
import { formatAmount, formatShortDay, formatSignedAmount } from "@/lib/format";
import type {
  PaymentReminderIndex,
  ReminderTarget,
} from "@/hooks/usePaymentReminders";
import { TransactionDetailsButton } from "./TransactionDetailsModal";

export interface DisplayItem {
  type: "single" | "multiple";
  invoiceId: string;
  invoice: any;
  match?: DetailedReconciliationMatch;
  matches?: DetailedReconciliationMatch[];
  sortValue?: any;
}

interface MatchesTableProps {
  displayItems: DisplayItem[];
  searchTerm?: string;
  getTransactionFromMatch: (match: DetailedReconciliationMatch) => any;
  onViewMatch: (match: DetailedReconciliationMatch) => void;
  onEditMatch: (match: DetailedReconciliationMatch) => void;
  onValidateMatch?: (match: DetailedReconciliationMatch) => void;
  onRejectMatch?: (match: DetailedReconciliationMatch) => void;
  onResolveMultiple: (
    invoiceId: string,
    matches: DetailedReconciliationMatch[]
  ) => void;
  /** Factures à rappeler ou soldées, lues dans Dolibarr en tâche de fond. */
  reminders: PaymentReminderIndex;
  onRemind: (target: ReminderTarget) => void;
}

const MAX_LABEL_LENGTH = 40;

/** Combien de transactions d'une facture à correspondances multiples répondent à la recherche. */
function getMatchingTransactionsInfo(
  invoice: any,
  matches: DetailedReconciliationMatch[],
  searchTerm: string | undefined,
  getTransactionFromMatch: (match: DetailedReconciliationMatch) => any
) {
  if (!searchTerm) {
    return {
      matchingCount: matches.length,
      totalCount: matches.length,
      hasFilter: false,
    };
  }

  const term = searchTerm.toLowerCase();

  // Vérifier si la facture elle-même correspond au terme de recherche
  const invoiceMatches =
    invoice?.ref?.toLowerCase().includes(term) ||
    invoice?.tiers?.toLowerCase().includes(term);

  // Si la facture correspond, toutes les transactions sont considérées comme correspondantes
  if (invoiceMatches) {
    return {
      matchingCount: matches.length,
      totalCount: matches.length,
      hasFilter: true,
    };
  }

  // Sinon, compter les transactions qui correspondent
  const matchingTransactions = matches.filter((match) => {
    const transaction = getTransactionFromMatch(match);
    return (
      transaction?.libelles?.toLowerCase().includes(term) ||
      transaction?.detailsMouvement?.toLowerCase().includes(term) ||
      match.matchType.toLowerCase().includes(term)
    );
  });

  return {
    matchingCount: matchingTransactions.length,
    totalCount: matches.length,
    hasFilter: true,
  };
}

function InvoiceCell({
  invoice,
  reminders,
}: {
  invoice: any;
  reminders?: PaymentReminderIndex;
}) {
  const ref: string | undefined = invoice?.ref;
  const lastReminder = ref
    ? reminders?.toRemind.get(ref)?.invoice.lastReminder
    : null;
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{ref || "N/A"}</div>
      <div className="text-muted-foreground">{invoice?.tiers || "N/A"}</div>
      {invoice?.dateFacturation && (
        <div className="text-xs text-muted-foreground">
          {invoice.dateFacturation}
        </div>
      )}
      <div className="font-semibold">
        {invoice ? formatAmount(invoice.montantTTC) : "N/A"}
      </div>
      {lastReminder ? (
        <div className="text-xs text-success">
          Rappel envoyé le {formatShortDay(lastReminder.sentAt)}
        </div>
      ) : (
        ref &&
        reminders?.settled.has(ref) && (
          <div className="text-xs text-muted-foreground">
            Soldée dans Dolibarr
          </div>
        )
      )}
    </div>
  );
}

/** Paiement trouvé : date · montant, payeur, communication, écart avec le TTC. */
function PaymentCell({
  transaction,
  invoice,
}: {
  transaction: DetailedBankTransaction;
  invoice?: DetailedInvoice;
}) {
  const { payer, communication } = parseTransactionLabel(transaction.libelles);
  const label: string = transaction.libelles || "Libellé N/A";
  const gap = invoice
    ? Math.round((transaction.montant - invoice.montantTTC) * 100) / 100
    : 0;
  return (
    <div className="flex max-w-xs items-start gap-1">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-semibold">
          {[transaction.dateComptable, formatAmount(transaction.montant)]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {payer && <div className="truncate">{payer}</div>}
        {communication && (
          <div className="truncate text-xs text-muted-foreground">
            {communication}
          </div>
        )}
        {!payer && !communication && (
          <div className="truncate text-muted-foreground">
            {label.length > MAX_LABEL_LENGTH
              ? `${label.substring(0, MAX_LABEL_LENGTH)}...`
              : label}
          </div>
        )}
        {gap !== 0 && (
          <div className="text-xs text-warning">
            écart {formatSignedAmount(gap)}
          </div>
        )}
      </div>
      <TransactionDetailsButton transaction={transaction} />
    </div>
  );
}

export default function MatchesTable({
  displayItems,
  searchTerm,
  getTransactionFromMatch,
  onViewMatch,
  onEditMatch,
  onValidateMatch,
  onRejectMatch,
  onResolveMultiple,
  reminders,
  onRemind,
}: MatchesTableProps) {
  const columns = useMemo<ColumnDef<DisplayItem>[]>(
    () => [
      {
        id: "invoice",
        header: "Facture",
        enableSorting: false,
        meta: { maxWidth: false },
        cell: ({ row }) => (
          <InvoiceCell
            invoice={row.original.invoice}
            reminders={row.original.type === "single" ? reminders : undefined}
          />
        ),
      },
      {
        id: "transaction",
        header: "Paiement trouvé",
        enableSorting: false,
        meta: { maxWidth: false },
        cell: ({ row }) => {
          const item = row.original;

          if (item.type === "multiple") {
            const matches = item.matches || [];
            const { matchingCount, totalCount, hasFilter } =
              getMatchingTransactionsInfo(
                item.invoice,
                matches,
                searchTerm,
                getTransactionFromMatch
              );
            const hasFilteredTransactions =
              hasFilter && matchingCount < totalCount && matchingCount > 0;

            return (
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="size-4 shrink-0" />
                <div>
                  <div className="font-medium">
                    {totalCount} correspondances possibles
                    {hasFilteredTransactions && matchingCount && (
                      <div className="mt-1 text-xs text-info">
                        ({matchingCount} correspondent au filtre de recherche)
                      </div>
                    )}
                  </div>
                  <div className="text-xs">Résolution manuelle requise</div>
                </div>
              </div>
            );
          }

          const match = item.match!;
          const transaction = getTransactionFromMatch(match);
          return transaction ? (
            <PaymentCell transaction={transaction} invoice={item.invoice} />
          ) : (
            <div
              className={`italic ${
                match.validationStatus === "REJECTED"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {match.validationStatus === "REJECTED"
                ? "Association rejetée"
                : "Aucun paiement trouvé"}
            </div>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        enableSorting: false,
        meta: { maxWidth: false },
        cell: ({ row }) => {
          const item = row.original;

          if (item.type === "multiple") {
            return (
              <div className="flex flex-col items-start gap-1">
                <StatusBadge tone="warning">
                  <AlertTriangle />
                  Multiple
                </StatusBadge>
                <StatusBadge tone="warning">Action requise</StatusBadge>
              </div>
            );
          }

          const match = item.match!;
          return (
            <div className="flex flex-col items-start gap-1">
              <StatusBadge
                tone={getMatchTypeTone(match.matchType, match.isManualMatch)}
              >
                {getMatchTypeOnly(match.matchType, match.isManualMatch)}
              </StatusBadge>
              {match.matchType !== "NONE" && match.notes?.[0] && (
                <span className="max-w-64 text-xs whitespace-normal text-muted-foreground">
                  {match.notes[0]}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "confidence",
        header: "Confiance",
        enableSorting: false,
        meta: { maxWidth: false },
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "multiple") {
            return <div className="text-warning">-</div>;
          }

          const match = item.match!;
          const hasTransaction = Boolean(getTransactionFromMatch(match));
          // Sans paiement trouvé, rien à mesurer : une association rejetée le
          // dit, les autres n'ont qu'un tiret.
          if (!hasTransaction) {
            return match.validationStatus === "REJECTED" ? (
              <StatusBadge tone={getValidationStatusTone("REJECTED")}>
                {getValidationStatusLabel("REJECTED")}
              </StatusBadge>
            ) : (
              <div className="text-muted-foreground">-</div>
            );
          }

          const confidence = getConfidenceDisplay(match, true);
          return (
            <div className="flex flex-col items-start gap-1.5">
              <StatusBadge
                tone={getValidationStatusTone(match.validationStatus)}
              >
                {getValidationStatusLabel(match.validationStatus)}
              </StatusBadge>
              <div className="flex min-w-28 items-center gap-2">
                <Progress
                  value={confidence.percent}
                  tone={confidence.tone}
                  aria-label="Confiance"
                />
                <span className="text-muted-foreground">
                  {confidence.label}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { maxWidth: false },
        cell: ({ row }) => {
          const item = row.original;

          if (item.type === "multiple") {
            return (
              <Button
                variant="outline"
                size="xs"
                onClick={() =>
                  onResolveMultiple(item.invoiceId, item.matches || [])
                }
              >
                <AlertTriangle />
                Résoudre
              </Button>
            );
          }

          const match = item.match!;
          const hasTransaction = Boolean(getTransactionFromMatch(match));
          // Le choix se fait une fois : validée ou rejetée, l'association ne se
          // rejuge plus ici (« Modifier » reste ouvert).
          const canDecide =
            hasTransaction && match.validationStatus === "PENDING";
          const ref: string | undefined = item.invoice?.ref;
          const target = ref ? reminders.toRemind.get(ref) : undefined;
          // Tant que Dolibarr n'a pas répondu (ou ne répond pas), le bouton
          // reste visible mais éteint sur les factures sans paiement.
          const remindUnavailable =
            reminders.status !== "ready" &&
            !hasTransaction &&
            Boolean(ref) &&
            item.invoice?.montantTTC > 0;
          return (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onViewMatch(match)}
                >
                  <Eye />
                  Voir
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onEditMatch(match)}
                >
                  <Pencil />
                  Modifier
                </Button>
              </div>

              {canDecide && onValidateMatch && onRejectMatch && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-success"
                    title="Valider cette correspondance"
                    onClick={() => onValidateMatch(match)}
                  >
                    <Check />
                    Valider
                  </Button>
                  <Button
                    variant="destructive"
                    size="xs"
                    title="Rejeter cette correspondance"
                    onClick={() => onRejectMatch(match)}
                  >
                    <X />
                    Rejeter
                  </Button>
                </div>
              )}

              {target && (
                <Button
                  variant="outline"
                  size="xs"
                  className="self-start"
                  title="Préparer le rappel de paiement de ce client"
                  onClick={() => onRemind(target)}
                >
                  <Mail />
                  Rappeler
                </Button>
              )}
              {remindUnavailable && (
                <Button
                  variant="outline"
                  size="xs"
                  className="self-start"
                  disabled
                  title={
                    reminders.status === "error"
                      ? `Rappel indisponible : ${reminders.error}`
                      : "Lecture des factures impayées dans Dolibarr…"
                  }
                >
                  <Mail />
                  Rappeler
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      searchTerm,
      getTransactionFromMatch,
      onViewMatch,
      onEditMatch,
      onValidateMatch,
      onRejectMatch,
      onResolveMultiple,
      reminders,
      onRemind,
    ]
  );

  return (
    <DataTable
      columns={columns}
      data={displayItems}
      // La page porte déjà la pagination : le tableau reçoit la page courante
      // (100 lignes au plus) et ne doit pas la redécouper. `pageSize` n'est lu
      // qu'au premier rendu, d'où un plafond large plutôt que la longueur.
      pageSize={1000}
      emptyMessage="Aucune correspondance trouvée"
      getRowId={(item) =>
        item.type === "multiple" ? `multiple-${item.invoiceId}` : item.match!.id
      }
      getRowClassName={(item) =>
        item.type === "multiple" ? "bg-warning/10" : undefined
      }
    />
  );
}
