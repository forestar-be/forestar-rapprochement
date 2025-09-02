// Client API centralisé avec gestion de l'authentification et des erreurs
// Suit les meilleures pratiques React et TypeScript

type ApiResponse<T = any> = {
  data?: T;
  error?: string;
  status: number;
};

type RequestConfig = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  isFormData?: boolean;
  timeout?: number;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private baseURL: string;
  private defaultTimeout: number = 30000;

  constructor(baseURL?: string) {
    this.baseURL =
      baseURL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }

  // Récupère le token d'authentification
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("facturation_token");
  }

  // Prépare les headers par défaut
  private getDefaultHeaders(isFormData = false): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // Méthode principale pour les requêtes HTTP
  private async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const {
      method = "GET",
      headers = {},
      body,
      isFormData = false,
      timeout = this.defaultTimeout,
    } = config;

    const url = `${this.baseURL}${endpoint}`;
    const defaultHeaders = this.getDefaultHeaders(isFormData);
    const finalHeaders = { ...defaultHeaders, ...headers };

    // Configuration de la requête
    const fetchConfig: RequestInit = {
      method,
      headers: finalHeaders,
    };

    // Gestion du body
    if (body) {
      if (isFormData) {
        fetchConfig.body = body; // FormData
      } else {
        fetchConfig.body =
          typeof body === "string" ? body : JSON.stringify(body);
      }
    }

    // Gestion du timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchConfig.signal = controller.signal;

    try {
      const response = await fetch(url, fetchConfig);
      clearTimeout(timeoutId);

      // Gestion des erreurs HTTP
      if (!response.ok) {
        let errorMessage = `Erreur HTTP ${response.status}`;
        let errorData = null;

        try {
          errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Si impossible de parser le JSON, utiliser le status text
          errorMessage = response.statusText || errorMessage;
        }

        throw new ApiError(errorMessage, response.status, errorData);
      }

      // Tenter de parser en JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }

      // Retourner la réponse brute pour les autres types de contenu
      return response as any;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Timeout de la requête", 408);
      }

      throw new ApiError(
        error instanceof Error ? error.message : "Erreur réseau inconnue",
        0
      );
    }
  }

  // Méthodes HTTP simplifiées
  async get<T = any>(
    endpoint: string,
    config?: Omit<RequestConfig, "method">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  async post<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "POST", body });
  }

  async put<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "PUT", body });
  }

  async patch<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "PATCH", body });
  }

  async delete<T = any>(
    endpoint: string,
    config?: Omit<RequestConfig, "method">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }

  // Méthode spécialisée pour l'upload de fichiers
  async uploadFiles<T = any>(
    endpoint: string,
    files: Record<string, File>,
    config?: Omit<RequestConfig, "method" | "body" | "isFormData">
  ): Promise<T> {
    const formData = new FormData();

    Object.entries(files).forEach(([key, file]) => {
      formData.append(key, file);
    });

    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: formData,
      isFormData: true,
    });
  }

  // Méthode pour télécharger des fichiers
  async downloadFile(endpoint: string, filename?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: this.getDefaultHeaders(),
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors du téléchargement: ${response.status}`,
          response.status
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Utiliser le filename fourni ou extraire du header Content-Disposition
      if (filename) {
        link.download = filename;
      } else {
        const contentDisposition = response.headers.get("Content-Disposition");
        if (contentDisposition) {
          const matches = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
          );
          if (matches && matches[1]) {
            link.download = matches[1].replace(/['"]/g, "");
          }
        }
      }

      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error
          ? error.message
          : "Erreur lors du téléchargement",
        0
      );
    }
  }

  // Gestion des requêtes avec retry automatique
  async requestWithRetry<T = any>(
    endpoint: string,
    config: RequestConfig = {},
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: ApiError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, config);
      } catch (error) {
        lastError =
          error instanceof ApiError
            ? error
            : new ApiError("Erreur inconnue", 0);

        // Ne pas retry sur les erreurs client (4xx) sauf 408 (timeout)
        if (
          lastError.status >= 400 &&
          lastError.status < 500 &&
          lastError.status !== 408
        ) {
          throw lastError;
        }

        // Attendre avant le prochain essai (sauf au dernier)
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError!;
  }

  // Polling avec gestion automatique
  async poll<T = any>(
    endpoint: string,
    predicate: (data: T) => boolean,
    config: RequestConfig = {},
    options: {
      interval?: number;
      maxAttempts?: number;
      onUpdate?: (data: T) => void;
    } = {}
  ): Promise<T> {
    const { interval = 2000, maxAttempts = 60, onUpdate } = options;

    return new Promise((resolve, reject) => {
      let attempts = 0;

      const poll = async () => {
        try {
          attempts++;
          const data = await this.request<T>(endpoint, config);

          if (onUpdate) {
            onUpdate(data);
          }

          if (predicate(data)) {
            resolve(data);
            return;
          }

          if (attempts >= maxAttempts) {
            reject(new ApiError("Nombre maximum de tentatives atteint", 408));
            return;
          }

          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  // Intercepteurs globaux pour la gestion d'erreurs
  onError?: (error: ApiError) => void;
  onUnauthorized?: () => void;

  // Middleware pour traiter les erreurs globalement
  private handleGlobalError(error: ApiError): void {
    if (error.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    }

    if (this.onError) {
      this.onError(error);
    }
  }
}

// Instance singleton du client API
export const apiClient = new ApiClient();

// Configuration des intercepteurs globaux
apiClient.onError = (error: ApiError) => {
  console.error("Erreur API:", error.message, error);
};

apiClient.onUnauthorized = () => {
  // Rediriger vers la page de connexion en cas d'erreur 401
  if (typeof window !== "undefined") {
    localStorage.removeItem("facturation_token");
    window.location.href = "/connexion";
  }
};

export { ApiError };
export default apiClient;
