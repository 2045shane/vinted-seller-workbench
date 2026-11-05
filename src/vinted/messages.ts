import { nonJsonError, networkError } from "../core/copy";

const SECRET_HINT = /access_token|refresh_token|csrf|cookie|password|bearer|authorization/i;

export function cleanUpstreamMessage(value: string, fallback: string): string {
  const collapsed = value.replace(/\s+/g, " ").replace(/<[^>]*>/g, "").trim();
  if (!collapsed || SECRET_HINT.test(collapsed) || collapsed.length > 180) return fallback;
  return collapsed;
}

export function unchanged(message: string): string {
  if (/not changed|left unchanged|nothing was changed/i.test(message)) return message;
  const trimmed = message.trim();
  const separator = /[.!?]$/.test(trimmed) ? " " : ". ";
  return `${trimmed}${separator}The price was not changed.`;
}

export function httpFailure(status: number, json: unknown, fallback: string): string {
  const fromBody = messageFromJson(json);
  if (fromBody) return unchanged(cleanUpstreamMessage(fromBody, fallback));
  if (status === 0) return networkError();
  return fallback;
}

export function transportFailure(kind: "network" | "non-json" | "blocked", status: number): string {
  if (kind === "network" || kind === "blocked") return networkError();
  return nonJsonError(status);
}

function messageFromJson(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const fromErrors = errorsText(record.errors);
  if (fromErrors) return fromErrors;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  return null;
}

function errorsText(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const parts: string[] = [];
  for (const error of errors) {
    if (typeof error === "string" && error.trim()) parts.push(error.trim());
    else if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const text = [record.message, record.value, record.detail].find((part) => typeof part === "string" && part.trim());
      if (typeof text === "string") parts.push(text.trim());
    }
  }
  return parts.length ? parts.join(" ") : null;
}

export function jsonIndicatesFailure(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const errors = errorsText(record.errors);
  if (errors) return errors;
  if (typeof record.code === "number" && record.code !== 0) {
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    return `Vinted rejected the edit (code ${record.code}).`;
  }
  return null;
}
