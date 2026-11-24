import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Primary Firebase app for Firestore + user identity (Gmail login)
const existingPrimary = getApps().find((a) => a.name === '[DEFAULT]');
export const app = existingPrimary ?? initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Secondary OAuth app configured by Workspace setup for Google Calendar + Gmail APIs
const WORKSPACE_OAUTH_CONFIG = {
  projectId: 'gen-lang-client-0615104750',
  appId: '1:211246016921:web:e96ea3511ea8c8f7174b08',
  apiKey: 'AIzaSyCLRjtKIj740iWZPpdN7Qn2lxxBhO87IxU',
  authDomain: 'gen-lang-client-0615104750.firebaseapp.com',
  storageBucket: 'gen-lang-client-0615104750.firebasestorage.app',
  messagingSenderId: '211246016921',
  measurementId: '',
  oAuthClientId: '211246016921-7hg4va9m66rd5hbcge2i2gk7ntepa500.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

const existingWorkspace = getApps().find((a) => a.name === 'workspace-oauth');
const workspaceApp = existingWorkspace ?? initializeApp(WORKSPACE_OAUTH_CONFIG, 'workspace-oauth');
const workspaceAuth = getAuth(workspaceApp);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

const primaryProvider = new GoogleAuthProvider();
primaryProvider.setCustomParameters({ prompt: 'select_account' });

const workspaceProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  workspaceProvider.addScope(scope);
}

// Strictly in-memory OAuth access token cache (never localStorage or sessionStorage)
let cachedWorkspaceToken: string | null = null;
let cachedWorkspaceEmail: string | null = null;
const tokenListeners = new Set<() => void>();

function notifyTokenListeners() {
  tokenListeners.forEach((cb) => cb());
}

export function subscribeWorkspaceToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceToken;
}

export function getWorkspaceConnectedEmail(): string | null {
  return cachedWorkspaceEmail;
}

export function hasWorkspaceToken(): boolean {
  return Boolean(cachedWorkspaceToken);
}

export function clearWorkspaceToken(): void {
  cachedWorkspaceToken = null;
  cachedWorkspaceEmail = null;
  notifyTokenListeners();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup Firestore connection verification
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      clearWorkspaceToken();
    }
    callback(user);
  });
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, primaryProvider);
  return result.user;
}

export async function connectWorkspaceApis(preferredEmail?: string | null): Promise<string> {
  if (preferredEmail) {
    workspaceProvider.setCustomParameters({
      login_hint: preferredEmail,
      prompt: 'consent',
    });
  } else {
    workspaceProvider.setCustomParameters({ prompt: 'consent' });
  }
  const result = await signInWithPopup(workspaceAuth, workspaceProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Não foi possível obter permissão de acesso para Google Agenda e Gmail.');
  }
  cachedWorkspaceToken = credential.accessToken;
  cachedWorkspaceEmail = result.user.email?.toLowerCase() ?? preferredEmail ?? null;
  notifyTokenListeners();
  return cachedWorkspaceToken;
}

export async function signOutUser(): Promise<void> {
  clearWorkspaceToken();
  await Promise.allSettled([signOut(auth), signOut(workspaceAuth)]);
}
