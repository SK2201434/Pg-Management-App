// Development diagnostics for photo uploads. The user sees one friendly message; the developer sees,
// in the Metro terminal, where an upload failed and why. Nothing here is shown to users, and
// nothing sensitive is kept: no secrets, no full file paths, only the URI scheme and a trimmed,
// path-free message.

export type UploadStage =
  | 'file-validation'
  | 'local-image-access'
  | 'request-creation'
  | 'network-upload'
  | 'http-response'
  | 'response-parsing'
  | 'firestore-persistence'
  | 'unknown';

/** What is known about a failed upload. Every field is safe to log. */
export type UploadFailureDetails = {
  stage: UploadStage;
  /** True once the request has been handed to the network layer. */
  requestSent?: boolean;
  /** True when any response (even an error one) came back. */
  responseReceived?: boolean;
  httpStatus?: number;
  /** Cloudinary's `error.message`, sanitized. */
  responseMessage?: string;
  /** The original error, sanitized. */
  causeName?: string;
  causeMessage?: string;
};

const MAX_MESSAGE = 200;

/** Removes file paths, URIs and long token-like strings, then trims. */
export function sanitizeMessage(message: unknown): string {
  const text = typeof message === 'string' ? message : message instanceof Error ? message.message : '';
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"')]+/gi, '<uri>')
    .replace(/(?:[A-Za-z]:)?[\\/](?:[\w .@-]+[\\/])+[\w .@-]*/g, '<path>')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE);
}

/** Only the scheme of a URI (`file`, `content`, `ph`, ...), never its path. */
export function uriScheme(uri: string | undefined): string {
  const match = uri?.match(/^([a-z][a-z0-9+.-]*):/i);
  return match ? match[1].toLowerCase() : 'none';
}

/** Name and sanitized message of an arbitrary thrown value. */
export function describeCause(error: unknown): { causeName: string; causeMessage: string } {
  const e = error as { name?: unknown; message?: unknown } | null;
  return {
    causeName: typeof e?.name === 'string' ? e.name : typeof error,
    causeMessage: sanitizeMessage(e?.message ?? (typeof error === 'string' ? error : '')),
  };
}

/** Cloudinary's `error.message` from a response body, sanitized; undefined when absent or not JSON. */
export function responseErrorMessage(body: string | null | undefined): string | undefined {
  if (!body) return undefined;
  try {
    const message = (JSON.parse(body) as { error?: { message?: unknown } }).error?.message;
    return typeof message === 'string' ? sanitizeMessage(message) : undefined;
  } catch {
    return undefined;
  }
}

export type UploadLogContext = {
  /** Position of the photo in this save, 1-based. */
  index?: number;
  total?: number;
  room?: boolean;
  mimeType?: string | null;
  fileSize?: number | null;
  uri?: string;
  configured?: { cloudName: boolean; uploadPreset: boolean };
};

/** The structured record that is logged. Built separately so it can be tested. */
export function buildDiagnostic(error: unknown, context: UploadLogContext) {
  const e = error as { code?: unknown; details?: UploadFailureDetails } | null;
  const details: UploadFailureDetails = e?.details ?? { stage: 'unknown', ...describeCause(error) };
  return {
    code: typeof e?.code === 'string' ? e.code : undefined,
    ...details,
    photo: context.index !== undefined ? `${context.index}/${context.total ?? '?'}` : undefined,
    room: context.room,
    uriScheme: uriScheme(context.uri),
    mimeType: context.mimeType ?? undefined,
    fileSizeBytes: context.fileSize ?? undefined,
    cloudinaryConfigured: context.configured,
    beforeRequest: details.requestSent === undefined ? undefined : !details.requestSent,
  };
}

/** Logs the diagnostic to the Metro terminal in development builds only. */
export function logUploadFailure(error: unknown, context: UploadLogContext): void {
  if (__DEV__) {
    console.warn('[photo-upload] failed', JSON.stringify(buildDiagnostic(error, context)));
  }
}
