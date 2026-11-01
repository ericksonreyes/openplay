// Server-side calls go over the shared Docker network; browser calls use the
// published localhost port (NEXT_PUBLIC_API_URL).
export function apiBaseUrl(): string {
  return process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8000';
}
