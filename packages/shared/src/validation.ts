export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationErr {
  ok: false;
  error: string;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

/** The validated, trimmed shape produced from a `CreateRoomRequest` body. */
export interface ValidatedCreateRoomRequest {
  topic: string;
}

/**
 * Validates the body of `POST /api/rooms`. The Topic is required and
 * non-blank; it is trimmed before storage.
 */
export function validateCreateRoomRequest(
  input: unknown
): ValidationResult<ValidatedCreateRoomRequest> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Request body must be an object" };
  }

  const topic = (input as Record<string, unknown>).topic;
  if (typeof topic !== "string") {
    return { ok: false, error: "topic must be a string" };
  }

  const trimmed = topic.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "topic is required" };
  }

  return { ok: true, value: { topic: trimmed } };
}

/**
 * Validates a Member's browser-local display name. A display name is a
 * label only; it is never an authorization and does not grant the Host
 * role.
 */
export function validateDisplayName(input: unknown): ValidationResult<string> {
  if (typeof input !== "string") {
    return { ok: false, error: "displayName must be a string" };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "displayName is required" };
  }

  return { ok: true, value: trimmed };
}
