// Types pour la réconciliation bancaire

// Types de base des données CSV (inchangés)
export interface Invoice {
  ref: string;
  refClient: string;
  type: string;
  dateFacturation: string;
  dateEcheance: string;
  tiers: string;
  ville: string;
  codePostal: string;
  modeReglement: string;
  montantHT: number;
  montantTTC: number;
  etat: string;
  originalRow?: number;
}

export interface BankTransaction {
  numeroCompte: string;
  nomCompte: string;
  compteContrepartie: string;
  numeroMouvement: string;
  dateComptable: string;
  dateValeur: string;
  montant: number;
  devise: string;
  libelles: string;
  detailsMouvement: string;
  message: string;
  originalRow?: number;
}

// Nouveaux types pour le système de gestion des réconciliations
export type ReconciliationStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type MatchType = 'EXACT_REF' | 'EXACT_AMOUNT' | 'FUZZY_NAME' | 'COMBINED' | 'MANUAL' | 'NONE';

export interface ReconciliationSummary {
  id: string;
  status: ReconciliationStatus;
  createdAt: string;
  completedAt?: string;
  invoicesFileName: string;
  transactionsFileName: string;
  totalInvoices: number;
  totalTransactions: number;
  exactMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  multipleMatches: number;
  totalMatchedAmount: number;
  totalUnmatchedAmount: number;
  reconciliationRate: number;
  progress: number;
  errorMessage?: string;
}

export interface InvoiceData {
  id: string;
  reconciliationId: string;
  originalRow: number;
  ref: string;
  refClient: string;
  type: string;
  dateFacturation: string;
  dateEcheance: string;
  tiers: string;
  ville: string;
  codePostal: string;
  modeReglement: string;
  montantHT: number;
  montantTTC: number;
  etat: string;
}

export interface BankTransactionData {
  id: string;
  reconciliationId: string;
  originalRow: number;
  numeroCompte: string;
  nomCompte: string;
  compteContrepartie: string;
  numeroMouvement: string;
  dateComptable: string;
  dateValeur: string;
  montant: number;
  devise: string;
  libelles: string;
  detailsMouvement: string;
  message: string;
  isMatched: boolean;
}

export interface ReconciliationMatchData {
  id: string;
  reconciliationId: string;
  invoiceId: string;
  bankTransactionId?: string;
  matchType: MatchType;
  confidence: number;
  score: number;
  notes: string[];
  isManualMatch: boolean;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
  invoice: InvoiceData;
  bankTransaction?: BankTransactionData;
}

export interface ReconciliationDetail {
  id: string;
  status: ReconciliationStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  progress: number;
  invoicesFileName: string;
  transactionsFileName: string;
  totalInvoices: number;
  totalTransactions: number;
  exactMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  multipleMatches: number;
  totalMatchedAmount: number;
  totalUnmatchedAmount: number;
  reconciliationRate: number;
  invoiceData: InvoiceData[];
  bankTransactionData: BankTransactionData[];
  reconciliationMatches: ReconciliationMatchData[];
}

// Types legacy pour compatibilité (à supprimer progressivement)
export interface ReconciliationMatch {
  invoice: Invoice;
  bankTransaction: BankTransaction | null;
  matchType: MatchType;
  confidence: number;
  score: number;
  notes: string[];
  isManualMatch?: boolean;
  alternatives?: {
    transaction: BankTransaction;
    matchType: string;
    confidence: number;
    score: number;
  }[];
}

export interface ReconciliationResult {
  matches?: ReconciliationMatch[];
  statistics?: {
    totalInvoices: number;
    totalTransactions: number;
    exactMatches: number;
    fuzzyMatches: number;
    noMatches: number;
    multipleMatches?: number;
    totalMatchedAmount: number;
    totalUnmatchedAmount: number;
  };
  unmatchedTransactions?: BankTransaction[];
  summary?: {
    totalInvoices: number;
    totalTransactions: number;
    exactMatches: number;
    fuzzyMatches: number;
    noMatches: number;
    totalMatchedAmount: number;
    totalUnmatchedAmount: number;
    reconciliationRate: number;
  };
  downloadUrl?: string;
  fileName?: string;
}

export interface FileUploadData {
  invoices: Invoice[];
  transactions: BankTransaction[];
  errors: string[];
}

export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ReconciliationSettings {
  amountTolerance: number;
  fuzzySearchThreshold: number;
  enableFuzzyMatching: boolean;
  enableAmountMatching: boolean;
  enableReferenceMatching: boolean;
  enableCombinedMatching: boolean;
}

// Types pour les réponses API
export interface CreateReconciliationResponse {
  id: string;
  status: ReconciliationStatus;
  message: string;
}

// ====== PHASE 4: Types pour la gestion interactive des appariements ======

export interface AlternativeMatch {
  transaction: BankTransactionData;
  matchType: MatchType;
  confidence: number;
  score: number;
  reasons: string[];
}

export interface MatchValidationResult {
  isValid: boolean;
  conflicts: Array<{
    type: "TRANSACTION_ALREADY_MATCHED" | "AMOUNT_MISMATCH" | "DATE_MISMATCH";
    message: string;
    severity: "ERROR" | "WARNING";
    details?: any;
  }>;
  suggestions?: string[];
}

export interface MatchHistoryEntry {
  id: string;
  action: "CREATED" | "UPDATED" | "VALIDATED" | "REJECTED";
  userId?: string;
  timestamp: string;
  changes: Record<string, { from: any; to: any }>;
  notes?: string[];
}

export interface ReconciliationStats {
  totalMatched: number;
  totalUnmatched: number;
  reconciliationRate: number;
  matchesByType: Record<MatchType, number>;
}

export interface SearchFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  libelle?: string;
  client?: string;
  tolerance?: number;
}

// Types pour les résultats de recherche
export interface UnmatchedSearchResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface CreateReconciliationResponse {
  id: string;
  status: ReconciliationStatus;
  message: string;
}

export interface ReconciliationStatusResponse {
  status: ReconciliationStatus;
  progress: number;
  message?: string;
  reconciliationId: string;
}

export interface AlternativeMatch {
  transaction: BankTransactionData;
  matchType: MatchType;
  confidence: number;
  score: number;
  reasons: string[];
}

export interface UpdateMatchRequest {
  bankTransactionId?: string;
  matchType: MatchType;
  isManualMatch: boolean;
  notes?: string[];
}
