import React from "react";
import { AlertCircle } from "lucide-react";
import { DetailedReconciliationMatch } from "@/types";

interface ReconciliationAlertsProps {
  /** Factures dont le paiement proposé reste à valider ou à rejeter. */
  toVerifyCount: number;
  invoicesWithMultipleMatches: {
    invoiceId: string;
    matches: DetailedReconciliationMatch[];
  }[];
}

// Les bandeaux ne restent que tant qu'il reste quelque chose à faire.
export default function ReconciliationAlerts({
  toVerifyCount,
  invoicesWithMultipleMatches,
}: ReconciliationAlertsProps) {
  const hasMultipleMatches = invoicesWithMultipleMatches.length > 0;

  if (toVerifyCount === 0 && !hasMultipleMatches) {
    return null;
  }

  return (
    <div className="space-y-2">
      {toVerifyCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm">
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <span>
            <strong>{toVerifyCount} association(s) à vérifier</strong> :
            validez-les ou rejetez-les
          </span>
        </div>
      )}

      {hasMultipleMatches && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm">
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <span>
            <strong>{invoicesWithMultipleMatches.length} facture(s)</strong> ont
            des correspondances multiples qui nécessitent un choix manuel
          </span>
        </div>
      )}
    </div>
  );
}
