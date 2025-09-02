// API client pour les réconciliations
import { apiClient, ApiError } from "./apiClient";
import {
  ReconciliationSummary,
  ReconciliationDetail,
  ReconciliationMatchData,
  BankTransactionData,
  InvoiceData,
  MatchType,
} from "@/types";

class ReconciliationAPI {
  private readonly basePath = "/facturation";

  async getReconciliations(): Promise<ReconciliationSummary[]> {
    try {
      return await apiClient.get<ReconciliationSummary[]>(
        `${this.basePath}/reconciliations`
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la récupération des réconciliations"
      );
    }
  }

  async getReconciliationDetail(id: string): Promise<ReconciliationDetail> {
    try {
      return await apiClient.get<ReconciliationDetail>(
        `${this.basePath}/reconciliation/${id}`
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new Error("Réconciliation non trouvée");
      }
      throw this.handleError(
        error,
        "Erreur lors de la récupération des détails"
      );
    }
  }

  async getReconciliationStatus(id: string) {
    try {
      return await apiClient.get(
        `${this.basePath}/reconciliation/${id}/status`
      );
    } catch (error) {
      throw this.handleError(error, "Erreur lors de la récupération du statut");
    }
  }

  async createReconciliation(invoicesFile: File, transactionsFile: File) {
    try {
      const formData = new FormData();
      formData.append("invoices", invoicesFile);
      formData.append("transactions", transactionsFile);

      return await apiClient.post(`${this.basePath}/upload`, formData, {
        isFormData: true,
      });
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la création de la réconciliation"
      );
    }
  }

  async getReconciliationMatches(
    id: string
  ): Promise<ReconciliationMatchData[]> {
    try {
      return await apiClient.get<ReconciliationMatchData[]>(
        `${this.basePath}/reconciliation/${id}/matches`
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la récupération des correspondances"
      );
    }
  }

  async getReconciliationInvoices(id: string): Promise<InvoiceData[]> {
    try {
      return await apiClient.get<InvoiceData[]>(
        `${this.basePath}/reconciliation/${id}/invoices`
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la récupération des factures"
      );
    }
  }

  async getReconciliationTransactions(
    id: string
  ): Promise<BankTransactionData[]> {
    try {
      return await apiClient.get<BankTransactionData[]>(
        `${this.basePath}/reconciliation/${id}/transactions`
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la récupération des transactions"
      );
    }
  }

  async cancelReconciliation(id: string) {
    try {
      return await apiClient.post(
        `${this.basePath}/reconciliation/${id}/cancel`
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de l'annulation de la réconciliation"
      );
    }
  }

  async deleteReconciliation(id: string) {
    try {
      return await apiClient.delete(`${this.basePath}/reconciliation/${id}`);
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la suppression de la réconciliation"
      );
    }
  }

  async downloadReconciliationFile(
    id: string,
    format: "excel" | "csv" = "excel"
  ) {
    try {
      // Pour le téléchargement, on utilisera fetch directement pour obtenir un blob
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${this.basePath}/reconciliation/${id}/download?format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `reconciliation-${id}.${format === "excel" ? "xlsx" : "csv"}`;

      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      throw this.handleError(error, "Erreur lors du téléchargement du fichier");
    }
  }

  // Récupérer le statut global des réconciliations actives
  async getReconciliationsStatus() {
    try {
      return await apiClient.get(`${this.basePath}/reconciliations/status`);
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la récupération du statut global"
      );
    }
  }

  // Vérifier s'il y a une réconciliation active
  async hasActiveReconciliation(): Promise<boolean> {
    try {
      const status = await this.getReconciliationsStatus();
      return (
        status.activeReconciliations && status.activeReconciliations.length > 0
      );
    } catch (error) {
      console.error(
        "Erreur lors de la vérification des réconciliations actives:",
        error
      );
      return false;
    }
  }

  // Récupérer la réconciliation active
  async getActiveReconciliation(): Promise<ReconciliationSummary | null> {
    try {
      const status = await this.getReconciliationsStatus();
      return status.activeReconciliations?.[0] || null;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la réconciliation active:",
        error
      );
      return null;
    }
  }

  // ====== PHASE 4: Gestion Interactive des Appariements ======

  /**
   * Modifier un appariement existant
   */
  async updateMatch(
    reconciliationId: string,
    matchId: string,
    data: {
      bankTransactionId?: string | null;
      notes?: string[];
      isManualMatch?: boolean;
    }
  ): Promise<ReconciliationMatchData> {
    try {
      return await apiClient.put<ReconciliationMatchData>(
        `${this.basePath}/reconciliation/${reconciliationId}/match/${matchId}`,
        data
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la modification de l'appariement"
      );
    }
  }

  /**
   * Valider un appariement (accepter une correspondance automatique)
   */
  async validateMatch(
    reconciliationId: string,
    matchId: string,
    notes?: string[]
  ): Promise<ReconciliationMatchData> {
    try {
      return await apiClient.post<ReconciliationMatchData>(
        `${this.basePath}/reconciliation/${reconciliationId}/match/${matchId}/validate`,
        { notes }
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la validation de l'appariement"
      );
    }
  }

  /**
   * Rejeter un appariement (marquer comme non correspondant)
   */
  async rejectMatch(
    reconciliationId: string,
    matchId: string,
    notes?: string[]
  ): Promise<ReconciliationMatchData> {
    try {
      return await apiClient.post<ReconciliationMatchData>(
        `${this.basePath}/reconciliation/${reconciliationId}/match/${matchId}/reject`,
        { notes }
      );
    } catch (error) {
      throw this.handleError(error, "Erreur lors du rejet de l'appariement");
    }
  }

  /**
   * Créer un appariement manuel
   */
  async createManualMatch(
    reconciliationId: string,
    invoiceId: string,
    bankTransactionId: string,
    notes?: string[]
  ): Promise<ReconciliationMatchData> {
    try {
      return await apiClient.post<ReconciliationMatchData>(
        `${this.basePath}/reconciliation/${reconciliationId}/matches/manual`,
        {
          invoiceId,
          bankTransactionId,
          notes,
        }
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la création de l'appariement manuel"
      );
    }
  }

  /**
   * Rechercher des transactions alternatives pour une facture
   */
  async getAlternativeMatches(
    reconciliationId: string,
    invoiceId: string,
    options: {
      limit?: number;
      searchTerm?: string;
      includeMatched?: boolean;
    } = {}
  ): Promise<
    Array<{
      transaction: BankTransactionData;
      matchType: MatchType;
      confidence: number;
      score: number;
      reasons: string[];
    }>
  > {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.searchTerm) params.append("search", options.searchTerm);
      if (options.includeMatched) params.append("includeMatched", "true");

      return await apiClient.get(
        `${this.basePath}/reconciliation/${reconciliationId}/invoices/${invoiceId}/alternatives?${params.toString()}`
      );
    } catch (error) {
      throw this.handleError(
        error,
        "Erreur lors de la recherche d'alternatives"
      );
    }
  }

  // Méthodes supprimées car non utilisées dans l'interface simplifiée :
  // - getUnmatchedTransactions
  // - getUnmatchedInvoices
  // - getMatchHistory
  // - recalculateStats
  // - validateMatchConsistency

  private handleError(error: unknown, defaultMessage: string): Error {
    if (error instanceof ApiError) {
      return new Error(error.message);
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(defaultMessage);
  }
}

export const reconciliationAPI = new ReconciliationAPI();

// Export avec bind pour préserver le contexte 'this'
export const getReconciliations =
  reconciliationAPI.getReconciliations.bind(reconciliationAPI);
export const getReconciliationDetail =
  reconciliationAPI.getReconciliationDetail.bind(reconciliationAPI);
export const getReconciliationStatus =
  reconciliationAPI.getReconciliationStatus.bind(reconciliationAPI);
export const createReconciliation =
  reconciliationAPI.createReconciliation.bind(reconciliationAPI);
export const getReconciliationMatches =
  reconciliationAPI.getReconciliationMatches.bind(reconciliationAPI);
export const getReconciliationInvoices =
  reconciliationAPI.getReconciliationInvoices.bind(reconciliationAPI);
export const getReconciliationTransactions =
  reconciliationAPI.getReconciliationTransactions.bind(reconciliationAPI);
export const cancelReconciliation =
  reconciliationAPI.cancelReconciliation.bind(reconciliationAPI);
export const deleteReconciliation =
  reconciliationAPI.deleteReconciliation.bind(reconciliationAPI);
export const downloadReconciliationFile =
  reconciliationAPI.downloadReconciliationFile.bind(reconciliationAPI);
export const getReconciliationsStatus =
  reconciliationAPI.getReconciliationsStatus.bind(reconciliationAPI);
export const hasActiveReconciliation =
  reconciliationAPI.hasActiveReconciliation.bind(reconciliationAPI);
export const getActiveReconciliation =
  reconciliationAPI.getActiveReconciliation.bind(reconciliationAPI);

// ====== PHASE 4: Exports pour la gestion interactive des appariements ======
export const updateMatch =
  reconciliationAPI.updateMatch.bind(reconciliationAPI);
export const validateMatch =
  reconciliationAPI.validateMatch.bind(reconciliationAPI);
export const rejectMatch =
  reconciliationAPI.rejectMatch.bind(reconciliationAPI);
export const createManualMatch =
  reconciliationAPI.createManualMatch.bind(reconciliationAPI);
export const getAlternativeMatches =
  reconciliationAPI.getAlternativeMatches.bind(reconciliationAPI);

// Exports supprimés (non utilisés dans l'interface simplifiée) :
// - getUnmatchedTransactions
// - getUnmatchedInvoices
// - getMatchHistory
// - recalculateStats
// - validateMatchConsistency
