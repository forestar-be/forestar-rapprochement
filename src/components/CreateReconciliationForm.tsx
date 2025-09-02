"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/ui/FileUpload";
import ReconciliationProgress from "@/components/ReconciliationProgress";
import { validateCSVFile } from "@/lib/csvUtils";
import {
  createReconciliation,
  getReconciliationStatus,
} from "@/lib/reconciliationAPI";
import { FileText, Play } from "lucide-react";

export default function CreateReconciliationForm() {
  const router = useRouter();

  const [loadingStates, setLoadingStates] = useState({
    invoices: false,
    transactions: false,
    reconciliation: false,
  });

  const [errors, setErrors] = useState({
    invoices: "",
    transactions: "",
    reconciliation: "",
  });

  const [fileNames, setFileNames] = useState({
    invoices: "",
    transactions: "",
  });

  const [selectedFiles, setSelectedFiles] = useState<{
    invoices: File | null;
    transactions: File | null;
  }>({
    invoices: null,
    transactions: null,
  });

  const [uploadProgress, setUploadProgress] = useState<{
    status: string;
    progress: number;
    message: string;
  } | null>(null);

  const [reconciliationId, setReconciliationId] = useState<string | null>(null);

  const handleInvoiceFileSelect = async (file: File) => {
    setLoadingStates((prev) => ({ ...prev, invoices: true }));
    setErrors((prev) => ({ ...prev, invoices: "" }));

    try {
      const validation = await validateCSVFile(file);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      setSelectedFiles((prev) => ({ ...prev, invoices: file }));
      setFileNames((prev) => ({ ...prev, invoices: file.name }));
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        invoices: (error as Error).message,
      }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, invoices: false }));
    }
  };

  const handleTransactionFileSelect = async (file: File) => {
    setLoadingStates((prev) => ({ ...prev, transactions: true }));
    setErrors((prev) => ({ ...prev, transactions: "" }));

    try {
      const validation = await validateCSVFile(file);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      setSelectedFiles((prev) => ({ ...prev, transactions: file }));
      setFileNames((prev) => ({ ...prev, transactions: file.name }));
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        transactions: (error as Error).message,
      }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, transactions: false }));
    }
  };

  const handleReconcile = async () => {
    if (!selectedFiles.invoices || !selectedFiles.transactions) {
      return;
    }

    setLoadingStates((prev) => ({ ...prev, reconciliation: true }));
    setErrors((prev) => ({ ...prev, reconciliation: "" }));

    try {
      const result = await createReconciliation(
        selectedFiles.invoices,
        selectedFiles.transactions
      );

      if (result.reconciliationId) {
        setReconciliationId(result.reconciliationId);
        setUploadProgress({
          status: "queued",
          progress: 0,
          message: "Réconciliation créée, en attente de traitement...",
        });

        // Démarrer le polling
        startPolling(result.reconciliationId);
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        reconciliation: (error as Error).message,
      }));
      setLoadingStates((prev) => ({ ...prev, reconciliation: false }));
    }
  };

  const startPolling = async (reconciliationId: string) => {
    const pollStatus = async () => {
      try {
        const statusData = await getReconciliationStatus(reconciliationId);

        setUploadProgress({
          status: statusData.status.toLowerCase(),
          progress: statusData.progress || 0,
          message: getStatusMessage(statusData.status, statusData.progress),
        });

        if (statusData.status === "COMPLETED") {
          // Rediriger vers la page de détail
          router.push(`/reconciliations/${reconciliationId}`);
          return;
        } else if (
          statusData.status === "FAILED" ||
          statusData.status === "CANCELLED"
        ) {
          setErrors((prev) => ({
            ...prev,
            reconciliation:
              statusData.errorMessage || "La réconciliation a échoué",
          }));
          setLoadingStates((prev) => ({ ...prev, reconciliation: false }));
          setUploadProgress(null);
          return;
        }

        // Continuer le polling si en cours
        if (
          statusData.status === "QUEUED" ||
          statusData.status === "PROCESSING"
        ) {
          setTimeout(pollStatus, 5000);
        }
      } catch (error) {
        console.error("Erreur lors du polling:", error);
        setTimeout(pollStatus, 5000);
      }
    };

    pollStatus();
  };

  const getStatusMessage = (status: string, progress: number): string => {
    switch (status) {
      case "QUEUED":
        return "En attente dans la file de traitement...";
      case "PROCESSING":
        return `Traitement en cours... ${progress}%`;
      case "COMPLETED":
        return "Réconciliation terminée avec succès !";
      case "FAILED":
        return "Erreur lors du traitement";
      case "CANCELLED":
        return "Réconciliation annulée";
      default:
        return "Statut inconnu";
    }
  };

  const canReconcile =
    selectedFiles.invoices &&
    selectedFiles.transactions &&
    !loadingStates.reconciliation;

  if (uploadProgress) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Réconciliation en cours
          </h1>
          <p className="mt-2 text-gray-600">
            Traitement de votre réconciliation bancaire...
          </p>
        </div>

        <ReconciliationProgress
          progress={uploadProgress.progress}
          status={uploadProgress.status}
          message={uploadProgress.message}
        />

        {reconciliationId && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  ID de réconciliation:{" "}
                  <span className="font-mono font-medium">
                    {reconciliationId}
                  </span>
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Vous pouvez fermer cette page, la réconciliation continuera en
                  arrière-plan.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Nouvelle Réconciliation Bancaire
        </h1>
        <p className="mt-2 text-gray-600">
          Importez vos fichiers de factures et d'extraits bancaires pour lancer
          la réconciliation automatique
        </p>
      </div>

      {/* Section d'import des fichiers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <FileText className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Fichier Factures
            </h2>
          </div>
          <FileUpload
            label="Fichier CSV des factures"
            accept=".csv"
            onFileSelect={handleInvoiceFileSelect}
            loading={loadingStates.invoices}
            error={errors.invoices}
            success={!!selectedFiles.invoices}
            fileName={fileNames.invoices}
          />
          {selectedFiles.invoices && (
            <div className="mt-3 text-sm text-green-600">
              ✓ Fichier sélectionné: {fileNames.invoices}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <FileText className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Fichier Banque
            </h2>
          </div>
          <FileUpload
            label="Fichier CSV des transactions bancaires"
            accept=".csv"
            onFileSelect={handleTransactionFileSelect}
            loading={loadingStates.transactions}
            error={errors.transactions}
            success={!!selectedFiles.transactions}
            fileName={fileNames.transactions}
          />
          {selectedFiles.transactions && (
            <div className="mt-3 text-sm text-green-600">
              ✓ Fichier sélectionné: {fileNames.transactions}
            </div>
          )}
        </div>
      </div>

      {/* Bouton de réconciliation */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Lancer la réconciliation
            </h3>
            <p className="text-gray-600">
              Vérifiez que les deux fichiers sont correctement importés
            </p>
          </div>
          <button
            onClick={handleReconcile}
            disabled={!canReconcile}
            className={`flex items-center px-6 py-3 rounded-lg text-white font-medium ${
              canReconcile
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            <Play className="h-4 w-4 mr-2" />
            Démarrer la réconciliation
          </button>
        </div>

        {errors.reconciliation && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Erreur de réconciliation
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <pre className="whitespace-pre-wrap">
                    {errors.reconciliation}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
