const LOCAL_API_URL = "http://localhost:8000";

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_API_URL;
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is required in production. Point it at the deployed FastAPI backend."
  );
}
