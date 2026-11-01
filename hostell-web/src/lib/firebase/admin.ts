import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

/** Thrown when server credentials or project settings are missing or unreadable. */
export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

type ServiceAccountFields = { projectId: string; clientEmail: string; privateKey: string };

function fromFile(path: string): ServiceAccountFields {
  let parsed: { project_id?: unknown; client_email?: unknown; private_key?: unknown };
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // Never include the path contents or the parser message: it can echo file text.
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_PATH could not be read as a service-account JSON file.");
  }
  const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = parsed;
  if (typeof projectId !== "string" || typeof clientEmail !== "string" || typeof privateKey !== "string") {
    throw new AdminConfigError("The service-account file is missing project_id, client_email or private_key.");
  }
  return { projectId, clientEmail, privateKey };
}

function fromEnv(): ServiceAccountFields | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail && !privateKey) return null;
  if (!projectId || !clientEmail || !privateKey) {
    throw new AdminConfigError("Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY together.");
  }
  // Env files and hosting dashboards store the key with literal "\n" sequences.
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

/**
 * Credential order: service-account file (local development), then individual env variables,
 * then Application Default Credentials (the supported route on Google Cloud and similar hosts).
 */
function createApp(): App {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const account = path ? fromFile(path) : fromEnv();
  if (account) return initializeApp({ credential: cert(account), projectId: account.projectId });

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new AdminConfigError("FIREBASE_PROJECT_ID is not set.");
  return initializeApp({ projectId });
}

/** The shared Admin app: created once per server process and reused by every request. */
function getAdminApp(): App {
  return getApps().length > 0 ? getApp() : createApp();
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
