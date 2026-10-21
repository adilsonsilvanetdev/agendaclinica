import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

// Safe config with fallback in case file is absent in a git clone
const firebaseConfig = rawConfig || {
  projectId: 'tenacious-pager-djcsn',
  appId: '1:347375989936:web:01442b656ef33ab883f775',
  apiKey: 'AIzaSyCU4yfPGBtwsFFJVkh1ru0s0USW8zUJnMA',
  authDomain: 'tenacious-pager-djcsn.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-podoschedule-d16ad015-1c96-4298-9f7e-cd38ef930cb9',
  storageBucket: 'tenacious-pager-djcsn.firebasestorage.app',
  messagingSenderId: '347375989936',
};

let appInstance: any = null;
let firestoreInstance: any = null;
let authInstance: any = null;

try {
  appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  firestoreInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
  authInstance = getAuth(appInstance);
} catch (e) {
  console.warn('Firebase initialization notice:', e);
}

export const db = firestoreInstance;
export const auth = authInstance;

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on boot safely without throwing top-level errors
export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'settings', 'general'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or domain awaiting allowlist.');
    }
  }
}

// Run test asynchronously
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection().catch(() => {});
  }, 500);
}
