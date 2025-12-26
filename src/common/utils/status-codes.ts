/**
 * Status Codes Utility
 *
 * Defines custom internal status codes (e.g., 'SUCCESS', 'MISSING_FIELDS') mapping
 * to HTTP codes. Ported from the legacy PMS system to maintain compatibility.
 */
export const STATUS_CODES = {
  /* ---------------------------------------------------------
   * ✅ SUCCESS RESPONSES (2xx)
   * --------------------------------------------------------- */
  SUCCESS: 200, // Generic success (GET, PATCH, etc.)
  OK: 200, // Alias for SUCCESS (common alternative)
  CREATED: 201, // Resource successfully created (POST)
  ACCEPTED: 202, // Request accepted for async processing
  NO_CONTENT: 204, // Success but no body (DELETE, PUT silent success)

  /* ---------------------------------------------------------
   * ⚠️ CLIENT ERRORS (4xx)
   * --------------------------------------------------------- */
  BAD_REQUEST: 400, // Malformed request body or parameters
  UNAUTHORIZED: 401, // Missing/invalid authentication token
  FORBIDDEN: 403, // Authenticated but not permitted
  NOT_FOUND: 404, // Resource not found
  METHOD_NOT_ALLOWED: 405, // Wrong HTTP method used
  CONFLICT: 409, // Duplicate record or business conflict
  PAYLOAD_TOO_LARGE: 413, // Exceeds allowed request size
  UNSUPPORTED_MEDIA_TYPE: 415, // Invalid content-type
  UNPROCESSABLE_ENTITY: 422, // Validation or semantic error (Zod validation, etc.)
  TOO_MANY_REQUESTS: 429, // Rate limiting, throttling applied
  TOKEN_EXPIRED: 498, // Non-standard: Token expired / invalid session
  TOKEN_REQUIRED: 499, // Non-standard: Missing token for protected route

  /* ---------------------------------------------------------
   * 💥 SERVER ERRORS (5xx)
   * --------------------------------------------------------- */
  SERVER_ERROR: 500, // Generic internal server error
  NOT_IMPLEMENTED: 501, // Feature or endpoint not implemented
  BAD_GATEWAY: 502, // Invalid response from upstream server
  SERVICE_UNAVAILABLE: 503, // Server temporarily unavailable (maintenance, overload)
  GATEWAY_TIMEOUT: 504, // Upstream service timeout
  DEPENDENCY_FAILED: 520, // External service (Redis, API, AI, DB) failure
  TIMEOUT_ERROR: 524, // Long-running Redis or AI microservice timeout
  DATABASE_ERROR: 530, // Database connection or query issue
  REDIS_ERROR: 531, // Redis / Cache unavailable
};

export function getStatusCode(name: string | number): number {
  // If the user passed in the number directly (e.g. 201), return it
  if (typeof name === "number") {
    return name;
  }

  // If passed as string number "201"
  if (!isNaN(Number(name))) {
    return Number(name);
  }

  // Lookup the key
  if (name in STATUS_CODES) {
    return STATUS_CODES[name as keyof typeof STATUS_CODES];
  }

  return 500;
}
