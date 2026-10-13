import { useCallback, useEffect, useMemo, useState } from "react";
import { getPaymentReminders } from "@/lib/api";
import {
  DetailedReconciliationMatch,
  PaymentReminders,
  ReminderGroup,
  ReminderInvoice,
} from "@/types";

/** Une facture à rappeler, avec le client (et toutes ses factures) qui la porte. */
export interface ReminderTarget {
  group: ReminderGroup;
  invoice: ReminderInvoice;
}

export interface PaymentReminderIndex {
  /** `loading` : première lecture de Dolibarr en cours ; `error` : injoignable. */
  status: "loading" | "ready" | "error";
  error: string;
  /** Factures à rappeler, par référence. */
  toRemind: Map<string, ReminderTarget>;
  /** Factures sans virement au relevé, mais soldées dans Dolibarr. */
  settled: Set<string>;
  resendAfterDays: number;
}

const DEFAULT_RESEND_AFTER_DAYS = 7;

/**
 * Rappels de paiement du rapprochement, lus en tâche de fond : le tableau
 * n'attend pas Dolibarr. La lecture est refaite dès que les associations
 * changent (validation, rejet, association à la main…) et sur demande après un
 * envoi, car ce qui est à rappeler en dépend.
 */
export function usePaymentReminders(
  reconciliationId: string,
  matches: DetailedReconciliationMatch[] | undefined
) {
  const [reminders, setReminders] = useState<PaymentReminders | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  // Empreinte des associations : ce qui change le résultat des rappels.
  const signature = useMemo(
    () =>
      matches
        ?.map(
          (m) =>
            `${m.id}:${m.transactionId ?? ""}:${m.validationStatus}:${m.isManualMatch}`
        )
        .join("|"),
    [matches]
  );

  useEffect(() => {
    if (signature === undefined) return;
    // Une lecture plus récente rend celle-ci caduque.
    let cancelled = false;
    getPaymentReminders(reconciliationId)
      .then((data) => {
        if (cancelled) return;
        setReminders(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setReminders(null);
        setError(
          e instanceof Error && e.message
            ? e.message
            : "Les rappels n'ont pas pu être préparés."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [reconciliationId, signature, revision]);

  const reload = useCallback(() => setRevision((n) => n + 1), []);

  const index = useMemo<PaymentReminderIndex>(() => {
    const toRemind = new Map<string, ReminderTarget>();
    for (const group of reminders?.groups ?? []) {
      for (const invoice of group.invoices) {
        toRemind.set(invoice.ref, { group, invoice });
      }
    }
    return {
      status: error ? "error" : reminders ? "ready" : "loading",
      error,
      toRemind,
      settled: new Set(reminders?.settledInDolibarr ?? []),
      resendAfterDays: reminders?.resendAfterDays ?? DEFAULT_RESEND_AFTER_DAYS,
    };
  }, [reminders, error]);

  return { reminders: index, reloadReminders: reload };
}
