// The cursor is the id of the last document of a page, wrapped so clients treat it as opaque and
// so a malformed value is rejected before it reaches Firestore.

const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VERSION = 1;

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid cursor.");
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(lastId: string): string {
  return Buffer.from(JSON.stringify({ v: VERSION, id: lastId })).toString("base64url");
}

export function decodeCursor(cursor: string): string {
  if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new InvalidCursorError();
  let parsed: { v?: unknown; id?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  if (parsed === null || typeof parsed !== "object" || parsed.v !== VERSION || typeof parsed.id !== "string" || !DOCUMENT_ID.test(parsed.id)) {
    throw new InvalidCursorError();
  }
  return parsed.id;
}
