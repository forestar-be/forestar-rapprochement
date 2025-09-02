"use client";

import { useState, useEffect } from "react";
import { ReconciliationSummary } from "@/types";
import {
  getReconciliations,
  getReconciliationDetail,
  cancelReconciliation,
} from "@/lib/reconciliationAPI";
import {
  ClockIcon,
  ArrowPathIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface Props {
  onReconciliationComplete?: () => void;
}

const statusColors = {
  QUEUED: "text-blue-600 bg-blue-100",
  PROCESSING: "text-blue-600 bg-blue-100",
  COMPLETED: "text-green-600 bg-green-100",
  FAILED: "text-red-600 bg-red-100",
  CANCELLED: "text-gray-600 bg-gray-100",
};

const statusIcons = {
  QUEUED: ClockIcon,
  PROCESSING: ArrowPathIcon,
  COMPLETED: ClockIcon,
  FAILED: XCircleIcon,
  CANCELLED: ExclamationTriangleIcon,
};

const statusLabels = {
  QUEUED: "En file d'attente",
  PROCESSING: "En cours de traitement",
  COMPLETED: "Terminée",
  FAILED: "Échouée",
  CANCELLED: "Annulée",
};

export default function ProcessingStatus({ onReconciliationComplete }: Props) {
  const [activeReconciliation, setActiveReconciliation] =
    useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkActiveReconciliation();
    const interval = setInterval(checkActiveReconciliation, 5000); // Poll toutes les 5 secondes

    return () => clearInterval(interval);
  }, []);

  const checkActiveReconciliation = async () => {
    try {
      const reconciliations = await getReconciliations();

      // Chercher une réconciliation active (QUEUED ou PROCESSING)
      const active = reconciliations.find(
        (r: ReconciliationSummary) =>
          r.status === "QUEUED" || r.status === "PROCESSING"
      );

      if (active) {
        // Si on a une réconciliation active, récupérer ses détails
        const detail = await getReconciliationDetail(active.id);
        setActiveReconciliation(detail);
      } else {
        // Vérifier si on avait une réconciliation active qui vient de se terminer
        if (
          activeReconciliation &&
          (activeReconciliation.status === "QUEUED" ||
            activeReconciliation.status === "PROCESSING")
        ) {
          onReconciliationComplete?.();
        }
        setActiveReconciliation(null);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du statut:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReconciliation = async () => {
    if (!activeReconciliation) return;

    if (!confirm("Êtes-vous sûr de vouloir annuler cette réconciliation ?")) {
      return;
    }

    try {
      await cancelReconciliation(activeReconciliation.id);
      // Actualiser immédiatement
      checkActiveReconciliation();
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
      alert("Erreur lors de l'annulation de la réconciliation");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("fr-FR");
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeReconciliation) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ClockIcon className="h-5 w-5 text-green-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Aucune réconciliation en cours
            </h3>
            <p className="mt-1 text-sm text-green-700">
              Vous pouvez démarrer une nouvelle réconciliation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = statusIcons[activeReconciliation.status];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusIcon className="h-8 w-8 text-blue-500 animate-spin" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Réconciliation en cours
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[activeReconciliation.status]}`}
              >
                {statusLabels[activeReconciliation.status]}
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(activeReconciliation.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {(activeReconciliation.status === "QUEUED" ||
          activeReconciliation.status === "PROCESSING") && (
          <button
            onClick={handleCancelReconciliation}
            className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700"
          >
            Annuler
          </button>
        )}
      </div>

      {/* Barre de progression */}
      {activeReconciliation.status === "PROCESSING" && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-700 mb-1">
            <span>Progression</span>
            <span>{activeReconciliation.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${activeReconciliation.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Informations sur les fichiers */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-gray-500">Factures:</span>
          <div className="text-gray-900">
            {activeReconciliation.totalInvoices} lignes
          </div>
          <div className="text-xs text-gray-500 truncate">
            {activeReconciliation.invoicesFileName}
          </div>
        </div>
        <div>
          <span className="font-medium text-gray-500">Transactions:</span>
          <div className="text-gray-900">
            {activeReconciliation.totalTransactions} lignes
          </div>
          <div className="text-xs text-gray-500 truncate">
            {activeReconciliation.transactionsFileName}
          </div>
        </div>
      </div>

      {/* Message d'erreur si applicable */}
      {activeReconciliation.status === "FAILED" &&
        activeReconciliation.errorMessage && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-700">
              {activeReconciliation.errorMessage}
            </p>
          </div>
        )}
    </div>
  );
}
