"use client";

import { useAuth } from "@/lib/auth";
import { LogOut, Plus, History } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { logOut, isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated) return null;

  const isNewReconciliation = pathname === "/reconciliations/new";
  const isReconciliationsList = pathname === "/reconciliations";

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Link
              href="/reconciliations"
              className="flex items-center space-x-3"
            >
              <Image
                src="/logo-70x70.png"
                alt="Forestar Logo"
                width={50}
                height={50}
                className="rounded-full"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  FORESTAR FACTURATION
                </h1>
                <p className="text-sm text-gray-500">Réconciliation Bancaire</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation Links */}
            <nav className="flex items-center space-x-2">
              <Link
                href="/reconciliations/new"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isNewReconciliation
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle réconciliation
              </Link>

              <Link
                href="/reconciliations"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isReconciliationsList
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                }`}
              >
                <History className="h-4 w-4 mr-2" />
                Historique
              </Link>
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-4 border-l border-gray-200 pl-4">
              <button
                onClick={logOut}
                className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
