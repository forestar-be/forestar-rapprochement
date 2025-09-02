"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CreateReconciliationForm from "@/components/CreateReconciliationForm";

// Forcer le rendu côté client pour les données dynamiques
export const dynamic = "force-dynamic";

export default function NewReconciliationPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/connexion");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Nouvelle Réconciliation
          </h1>
          <p className="mt-2 text-gray-600">
            Importez vos fichiers de factures et d'extraits bancaires pour
            lancer la réconciliation automatique
          </p>
        </div>
        <CreateReconciliationForm />
      </main>
    </div>
  );
}
