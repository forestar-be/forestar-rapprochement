"use client";

import { useState, useEffect } from "react";
import {
  ReconciliationDetail as ReconciliationDetailType,
  ReconciliationMatchData,
  InvoiceData,
  BankTransactionData,
  AlternativeMatch,
} from "@/types";
import {
  getReconciliationMatches,
  getReconciliationInvoices,
  getReconciliationTransactions,
  getAlternativeMatches,
  updateMatch,
  validateMatch,
  rejectMatch,
  createManualMatch,
  cancelReconciliation,
} from "@/lib/reconciliationAPI";
import {
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
  CurrencyEuroIcon,
  DocumentTextIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

interface Props {
  reconciliation: ReconciliationDetailType;
  onUpdate: () => void;
}

interface InvoiceWithMatch {
  invoice: InvoiceData;
  match?: ReconciliationMatchData;
  transaction?: BankTransactionData;
}

const statusIcons = {
  QUEUED: ClockIcon,
  PROCESSING: ArrowPathIcon,
  COMPLETED: CheckCircleIcon,
  FAILED: XCircleIcon,
  CANCELLED: ExclamationTriangleIcon,
};

const statusColors = {
  QUEUED: "text-blue-600 bg-blue-100",
  PROCESSING: "text-blue-600 bg-blue-100",
  COMPLETED: "text-green-600 bg-green-100",
  FAILED: "text-red-600 bg-red-100",
  CANCELLED: "text-gray-600 bg-gray-100",
};

const statusLabels = {
  QUEUED: "En file d'attente",
  PROCESSING: "En cours",
  COMPLETED: "Terminée",
  FAILED: "Échouée",
  CANCELLED: "Annulée",
};

const matchTypeLabels = {
  EXACT_REF: "Référence exacte",
  EXACT_AMOUNT: "Montant exact",
  FUZZY_NAME: "Nom similaire",
  COMBINED: "Combiné",
  MANUAL: "Manuel",
  NONE: "Aucune",
};

const matchTypeColors = {
  EXACT_REF: "bg-green-100 text-green-800",
  EXACT_AMOUNT: "bg-blue-100 text-blue-800",
  FUZZY_NAME: "bg-yellow-100 text-yellow-800",
  COMBINED: "bg-purple-100 text-purple-800",
  MANUAL: "bg-indigo-100 text-indigo-800",
  NONE: "bg-gray-100 text-gray-800",
};

export default function ReconciliationSimpleView({
  reconciliation,
  onUpdate,
}: Props) {
  const [invoicesWithMatches, setInvoicesWithMatches] = useState<
    InvoiceWithMatch[]
  >([]);
  const [availableTransactions, setAvailableTransactions] = useState<
    BankTransactionData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [alternativeTransactions, setAlternativeTransactions] = useState<
    AlternativeMatch[]
  >([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [processingActions, setProcessingActions] = useState<Set<string>>(
    new Set()
  );

  const StatusIcon = statusIcons[reconciliation.status];

  useEffect(() => {
    if (reconciliation.status === "COMPLETED") {
      loadData();
    }
  }, [reconciliation.status]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoices, matches, transactions] = await Promise.all([
        getReconciliationInvoices(reconciliation.id),
        getReconciliationMatches(reconciliation.id),
        getReconciliationTransactions(reconciliation.id),
      ]);

      // Combine invoices with their matches and transactions
      const invoicesWithMatches: InvoiceWithMatch[] = invoices.map(
        (invoice) => {
          const match = matches.find((m) => m.invoiceId === invoice.id);
          const transaction = match?.bankTransaction;
          return {
            invoice,
            match,
            transaction,
          };
        }
      );

      setInvoicesWithMatches(invoicesWithMatches);
      setAvailableTransactions(transactions);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAlternatives = async (invoiceId: string) => {
    try {
      setLoadingAlternatives(true);
      setEditingInvoiceId(invoiceId);
      const alternatives = await getAlternativeMatches(
        reconciliation.id,
        invoiceId,
        {
          limit: 10,
          includeMatched: false,
        }
      );
      setAlternativeTransactions(alternatives);
    } catch (error) {
      console.error("Erreur lors de la recherche d'alternatives:", error);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleAssignTransaction = async (
    invoiceId: string,
    transactionId: string | null,
    isManual: boolean = true
  ) => {
    try {
      setProcessingActions((prev) => new Set(prev).add(invoiceId));

      const invoiceWithMatch = invoicesWithMatches.find(
        (iwm) => iwm.invoice.id === invoiceId
      );

      if (invoiceWithMatch?.match) {
        // Update existing match
        await updateMatch(reconciliation.id, invoiceWithMatch.match.id, {
          bankTransactionId: transactionId,
          isManualMatch: isManual,
          notes: [
            `Association ${isManual ? "manuelle" : "automatique"} le ${new Date().toLocaleString()}`,
          ],
        });
      } else if (transactionId) {
        // Create new manual match
        await createManualMatch(reconciliation.id, invoiceId, transactionId, [
          `Association manuelle le ${new Date().toLocaleString()}`,
        ]);
      }

      await loadData();
      onUpdate();
      setEditingInvoiceId(null);
    } catch (error) {
      console.error("Erreur lors de l'assignation:", error);
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const handleValidateMatch = async (matchId: string, invoiceId: string) => {
    try {
      setProcessingActions((prev) => new Set(prev).add(invoiceId));
      await validateMatch(reconciliation.id, matchId);
      await loadData();
      onUpdate();
    } catch (error) {
      console.error("Erreur lors de la validation:", error);
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const handleRejectMatch = async (matchId: string, invoiceId: string) => {
    try {
      setProcessingActions((prev) => new Set(prev).add(invoiceId));
      await rejectMatch(reconciliation.id, matchId);
      await loadData();
      onUpdate();
    } catch (error) {
      console.error("Erreur lors du rejet:", error);
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const handleCancelReconciliation = async () => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette réconciliation ?")) {
      return;
    }

    try {
      await cancelReconciliation(reconciliation.id);
      onUpdate();
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const filteredInvoices = invoicesWithMatches.filter((iwm) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      iwm.invoice.ref.toLowerCase().includes(searchLower) ||
      iwm.invoice.tiers.toLowerCase().includes(searchLower) ||
      iwm.transaction?.libelles.toLowerCase().includes(searchLower) ||
      iwm.transaction?.message.toLowerCase().includes(searchLower)
    );
  });

  const calculateStats = () => {
    const totalInvoices = invoicesWithMatches.length;
    const matchedCount = invoicesWithMatches.filter(
      (iwm) => iwm.match && iwm.match.matchType !== "NONE" && iwm.transaction
    ).length;
    const matchedAmount = invoicesWithMatches
      .filter(
        (iwm) => iwm.match && iwm.match.matchType !== "NONE" && iwm.transaction
      )
      .reduce((sum, iwm) => sum + iwm.invoice.montantTTC, 0);
    const matchRate =
      totalInvoices > 0 ? (matchedCount / totalInvoices) * 100 : 0;

    return {
      totalInvoices,
      matchedCount,
      matchedAmount,
      matchRate,
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <StatusIcon className="h-8 w-8 text-gray-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Réconciliation du {formatDate(reconciliation.createdAt)}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[reconciliation.status]}`}
                  >
                    {statusLabels[reconciliation.status]}
                  </span>
                  {reconciliation.status === "PROCESSING" && (
                    <span className="text-sm text-gray-500">
                      En cours de traitement...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              {(reconciliation.status === "QUEUED" ||
                reconciliation.status === "PROCESSING") && (
                <button
                  onClick={handleCancelReconciliation}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={onUpdate}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">Factures</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {stats.totalInvoices}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <UsersIcon className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-900">
                    Transactions
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    {reconciliation.totalTransactions}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-900">
                    Appariées
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    {stats.matchedCount}
                  </p>
                  <p className="text-xs text-purple-700">
                    {stats.matchRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CurrencyEuroIcon className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-900">Montant</p>
                  <p className="text-lg font-bold text-yellow-900">
                    {formatCurrency(stats.matchedAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {reconciliation.status !== "COMPLETED" ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-12">
            <StatusIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {statusLabels[reconciliation.status]}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {reconciliation.status === "PROCESSING"
                ? "La réconciliation est en cours de traitement..."
                : reconciliation.status === "QUEUED"
                  ? "La réconciliation est en file d'attente..."
                  : reconciliation.errorMessage || "Une erreur s'est produite"}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          {/* Search and filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par référence, client, libellé..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Main table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction associée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((iwm) => (
                  <tr key={iwm.invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {iwm.invoice.ref}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(iwm.invoice.dateFacturation)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {iwm.invoice.tiers}
                      </div>
                      <div className="text-sm text-gray-500">
                        {iwm.invoice.ville}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(iwm.invoice.montantTTC)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {iwm.transaction ? (
                        <div className="max-w-xs">
                          <div className="text-sm text-gray-900 truncate">
                            {iwm.transaction.libelles}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(iwm.transaction.dateComptable)} -{" "}
                            {formatCurrency(iwm.transaction.montant)}
                          </div>
                          {iwm.transaction.message && (
                            <div className="text-xs text-gray-400 truncate">
                              {iwm.transaction.message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Aucune transaction associée
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {iwm.match ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${matchTypeColors[iwm.match.matchType]}`}
                        >
                          {matchTypeLabels[iwm.match.matchType]}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Non traité
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {processingActions.has(iwm.invoice.id) ? (
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        ) : (
                          <>
                            {iwm.match &&
                              iwm.match.matchType !== "NONE" &&
                              !iwm.match.isManualMatch && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleValidateMatch(
                                        iwm.match!.id,
                                        iwm.invoice.id
                                      )
                                    }
                                    className="text-green-600 hover:text-green-900"
                                    title="Valider cette correspondance"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRejectMatch(
                                        iwm.match!.id,
                                        iwm.invoice.id
                                      )
                                    }
                                    className="text-red-600 hover:text-red-900"
                                    title="Rejeter cette correspondance"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            <button
                              onClick={() =>
                                handleSearchAlternatives(iwm.invoice.id)
                              }
                              className="text-blue-600 hover:text-blue-900"
                              title="Changer l'association"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Aucune facture trouvée
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm
                  ? "Aucun résultat pour votre recherche."
                  : "Aucune donnée disponible."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Alternative transactions modal */}
      {editingInvoiceId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Choisir une transaction pour la facture
                  </h3>
                  <button
                    onClick={() => {
                      setEditingInvoiceId(null);
                      setAlternativeTransactions([]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                {loadingAlternatives ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Option to remove association */}
                    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-red-900">
                            Supprimer l'association
                          </h4>
                          <p className="text-sm text-red-700">
                            Marquer cette facture comme non appariée
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleAssignTransaction(editingInvoiceId, null)
                          }
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Available transactions */}
                    <div className="max-h-96 overflow-y-auto">
                      {availableTransactions
                        .filter(
                          (t) =>
                            !t.isMatched ||
                            t.id ===
                              invoicesWithMatches.find(
                                (iwm) => iwm.invoice.id === editingInvoiceId
                              )?.transaction?.id
                        )
                        .map((transaction) => {
                          const alternative = alternativeTransactions.find(
                            (alt) => alt.transaction.id === transaction.id
                          );
                          const currentMatch =
                            invoicesWithMatches.find(
                              (iwm) => iwm.invoice.id === editingInvoiceId
                            )?.transaction?.id === transaction.id;

                          return (
                            <div
                              key={transaction.id}
                              className={`border rounded-lg p-4 ${currentMatch ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"} ${transaction.isMatched && !currentMatch ? "opacity-50" : ""}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="text-sm font-medium text-gray-900">
                                      {transaction.libelles}
                                    </h4>
                                    {alternative && (
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${matchTypeColors[alternative.matchType]}`}
                                      >
                                        {matchTypeLabels[alternative.matchType]}{" "}
                                        (
                                        {Math.round(
                                          alternative.confidence * 100
                                        )}
                                        %)
                                      </span>
                                    )}
                                    {currentMatch && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        Actuel
                                      </span>
                                    )}
                                    {transaction.isMatched && !currentMatch && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                        Déjà utilisée
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {formatDate(transaction.dateComptable)} -{" "}
                                    {formatCurrency(transaction.montant)}
                                  </p>
                                  {transaction.message && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {transaction.message}
                                    </p>
                                  )}
                                  {alternative &&
                                    alternative.reasons.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-xs text-gray-500">
                                          Raisons:
                                        </p>
                                        <ul className="text-xs text-gray-600 list-disc list-inside">
                                          {alternative.reasons.map(
                                            (reason, idx) => (
                                              <li key={idx}>{reason}</li>
                                            )
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                </div>
                                <div className="ml-4">
                                  {!currentMatch && (
                                    <button
                                      onClick={() =>
                                        handleAssignTransaction(
                                          editingInvoiceId,
                                          transaction.id
                                        )
                                      }
                                      disabled={transaction.isMatched}
                                      className={`px-3 py-1 rounded text-sm ${
                                        transaction.isMatched
                                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                          : "bg-blue-600 text-white hover:bg-blue-700"
                                      }`}
                                    >
                                      Associer
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {availableTransactions.filter((t) => !t.isMatched)
                      .length === 0 && (
                      <div className="text-center py-8">
                        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                          Aucune transaction disponible
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Toutes les transactions ont déjà été appariées.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
