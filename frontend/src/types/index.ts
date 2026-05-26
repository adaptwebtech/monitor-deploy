export interface User {
  id: string;
  name: string;
  email: string;
  profilePictureUrl: string | null;
  githubId: string | null;
  root: boolean;
  del: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PipelineQueue {
  id: string;
  id_user?: string | null;
  event?: string;
  app: string;
  environment: "development" | "staging" | "production";
  commitSha: string;
  commitMessage: string;
  commitAuthor: string;
  commitAuthorAvatar: string | null;
  commitAuthorId?: string | null;
  status: "Queued" | "Running" | "Completed" | "Failed";
  del?: boolean;
  createdAt: string;
  updatedAt: string;
  currentStep?: string | null;
}

export interface KpiStats {
  total: number;
  succeeded: number;
  failed: number;
  errorRate: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}

// Extend window to include config
declare global {
  interface Window {
    config: {
      API_URL: string;
      WS_URL: string;
      API_KEY?: string;
    };
  }
}
