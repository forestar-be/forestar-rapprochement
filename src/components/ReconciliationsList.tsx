"use client";

import { useState, useEffect } from "react";
import { ReconciliationSummary } from "@/types";
import {
  getReconciliations,
  deleteReconciliation,
} from "@/lib/reconciliationAPI";
import {
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  AlertCircle,
  Calendar,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

interface ReconciliationsListProps {}

export default function ReconciliationsList({}: ReconciliationsListProps) {
  const [reconciliations, setReconciliations] = useState<
    ReconciliationSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "COMPLETED" | "PROCESSING" | "FAILED"
  >("all");

  useEffect(() => {
    loadReconciliations();
  }, []);

  const loadReconciliations = async () => {
    try {
      setLoading(true);
      const data = await getReconciliations();
      setReconciliations(data);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette réconciliation ?")) {
      return;
    }

    try {
      await deleteReconciliation(id);
      loadReconciliations(); // Recharger la liste
    } catch (error) {
      alert(`Erreur lors de la suppression: ${(error as Error).message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "PROCESSING":
      case "QUEUED":
        return <Clock className="h-5 w-5 text-blue-500" />;
      case "FAILED":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "CANCELLED":
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "Terminée";
      case "PROCESSING":
        return "En cours";
      case "QUEUED":
        return "En attente";
      case "FAILED":
        return "Échouée";
      case "CANCELLED":
        return "Annulée";
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "PROCESSING":
      case "QUEUED":
        return "bg-blue-100 text-blue-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const filteredReconciliations = reconciliations.filter(
    (r) => filter === "all" || r.status === filter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <XCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Erreur de chargement
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={loadReconciliations}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Filtres</h2>
          <div className="flex space-x-2">
            {[
              { key: "all" as const, label: "Toutes" },
              { key: "COMPLETED" as const, label: "Terminées" },
              { key: "PROCESSING" as const, label: "En cours" },
              { key: "FAILED" as const, label: "Échouées" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des réconciliations */}
      <div className="bg-white shadow rounded-lg">
        {filteredReconciliations.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Aucune réconciliation
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === "all"
                ? "Commencez par créer votre première réconciliation."
                : `Aucune réconciliation ${getStatusLabel(filter).toLowerCase()} trouvée.`}
            </p>
            {filter === "all" && (
              <div className="mt-6">
                <Link
                  href="/reconciliations/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Nouvelle réconciliation
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fichiers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Éléments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Réconciliation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montants
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReconciliations.map((reconciliation) => (
                  <tr key={reconciliation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(reconciliation.status)}
                        <span
                          className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(reconciliation.status)}`}
                        >
                          {getStatusLabel(reconciliation.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(reconciliation.createdAt)}
                          </div>
                          {reconciliation.completedAt && (
                            <div className="text-xs text-gray-500">
                              Terminée: {formatDate(reconciliation.completedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div
                          className="truncate max-w-32"
                          title={reconciliation.invoicesFileName}
                        >
                          📄 {reconciliation.invoicesFileName}
                        </div>
                        <div
                          className="truncate max-w-32 text-gray-500"
                          title={reconciliation.transactionsFileName}
                        >
                          🏦 {reconciliation.transactionsFileName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div>{reconciliation.totalInvoices} factures</div>
                        <div className="text-gray-500">
                          {reconciliation.totalTransactions} transactions
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrendingUp className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reconciliation.reconciliationRate}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {reconciliation.exactMatches +
                              reconciliation.fuzzyMatches}{" "}
                            / {reconciliation.totalInvoices}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-green-600">
                            {formatCurrency(reconciliation.totalMatchedAmount)}
                          </div>
                          {reconciliation.totalUnmatchedAmount > 0 && (
                            <div className="text-xs text-red-600">
                              -
                              {formatCurrency(
                                reconciliation.totalUnmatchedAmount
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/reconciliations/${reconciliation.id}`}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {(reconciliation.status === "COMPLETED" ||
                          reconciliation.status === "FAILED") && (
                          <button
                            onClick={() => handleDelete(reconciliation.id)}
                            className="text-red-600 hover:text-red-900 flex items-center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statistiques rapides */}
      {reconciliations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total réconciliations
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliations.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Terminées
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {
                      reconciliations.filter((r) => r.status === "COMPLETED")
                        .length
                    }
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    En cours
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {
                      reconciliations.filter((r) =>
                        ["PROCESSING", "QUEUED"].includes(r.status)
                      ).length
                    }
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Taux moyen
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliations.length > 0
                      ? Math.round(
                          reconciliations
                            .filter((r) => r.status === "COMPLETED")
                            .reduce((sum, r) => sum + r.reconciliationRate, 0) /
                            reconciliations.filter(
                              (r) => r.status === "COMPLETED"
                            ).length || 0
                        )
                      : 0}
                    %
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
