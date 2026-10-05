import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { SavedMatch, TournamentConfig } from '../types/pubg';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth: Auth = getAuth(app);

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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
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

// Validate connection to Firestore as required by Firebase integration guidelines
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or connecting...');
    }
  }
}
testConnection();

const TOURNAMENT_DOC_ID = 'current_tournament';

/**
 * Saves tournament config and matches to Firebase Firestore for cross-device/OBS synchronization
 */
export async function syncTournamentToFirestore(
  config: TournamentConfig,
  matches?: SavedMatch[]
) {
  try {
    const tournamentRef = doc(db, 'tournaments', TOURNAMENT_DOC_ID);
    const payload: any = {
      id: TOURNAMENT_DOC_ID,
      name: config.name || 'PUBG Mobile Tournament',
      config,
      updatedAt: Date.now(),
    };
    if (matches !== undefined) {
      payload.matches = matches;
    }
    await setDoc(tournamentRef, payload, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message).includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${TOURNAMENT_DOC_ID}`);
    } else {
      console.warn('Failed to sync tournament state to Firestore:', err);
    }
  }
}

/**
 * Saves matches specifically to Firestore
 */
export async function syncMatchesToFirestore(matches: SavedMatch[]) {
  try {
    const tournamentRef = doc(db, 'tournaments', TOURNAMENT_DOC_ID);
    await setDoc(
      tournamentRef,
      {
        matches,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message).includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${TOURNAMENT_DOC_ID}`);
    } else {
      console.warn('Failed to sync matches to Firestore:', err);
    }
  }
}

/**
 * Subscribes to real-time updates of the tournament from Firestore
 */
export function subscribeToFirestoreTournament(
  onUpdate: (data: { config?: TournamentConfig; matches?: SavedMatch[] }) => void
): () => void {
  try {
    const tournamentRef = doc(db, 'tournaments', TOURNAMENT_DOC_ID);
    const unsubscribe = onSnapshot(
      tournamentRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onUpdate({
            config: data?.config,
            matches: data?.matches,
          });
        }
      },
      (error) => {
        if (error?.code === 'permission-denied' || String(error?.message).includes('insufficient permissions')) {
          handleFirestoreError(error, OperationType.GET, `tournaments/${TOURNAMENT_DOC_ID}`);
        } else {
          console.warn('Firestore real-time subscription error:', error);
        }
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Could not establish Firestore subscription:', err);
    return () => {};
  }
}
