import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TournamentConfig, SavedMatch } from '../types/pubg';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Workspace Drive scope accepted by user
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory access token cache (Per security requirements, NEVER store access tokens in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
}

/**
 * Initialize Firebase Auth listener.
 */
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Access token is only available right after popup sign-in in Firebase client SDK.
        // Prompt re-auth when needed.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * User-triggered sign-in with Google to obtain Drive access token.
 */
export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access token not returned.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('[Google Drive] Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Find or create designated Google Drive folder for tournament backups.
 */
export const findOrCreateTournamentFolder = async (
  folderName: string = 'PUBG Tournament Backups'
): Promise<DriveFolderInfo> => {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Not authenticated with Google Drive. Please sign in first.');
  }

  // 1. Search for existing folder with exact name
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Failed to search Drive folder: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existing = searchData.files[0];
    return {
      id: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink,
    };
  }

  // 2. Folder does not exist, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated match backups created by PUBG Spectator Tournament System',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Drive folder: ${errText}`);
  }

  const created = await createRes.json();
  return {
    id: created.id,
    name: created.name,
    webViewLink: created.webViewLink,
  };
};

/**
 * Upload tournament backup JSON file to Google Drive.
 */
export const uploadTournamentBackupToDrive = async (
  config: TournamentConfig,
  matches: SavedMatch[],
  folderId?: string,
  customLabel?: string
): Promise<DriveBackupFile> => {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Not authenticated with Google Drive. Please sign in first.');
  }

  let targetFolderId = folderId;
  if (!targetFolderId) {
    const folderInfo = await findOrCreateTournamentFolder(config.googleDriveFolderName || 'PUBG Tournament Backups');
    targetFolderId = folderInfo.id;
  }

  const matchNum = matches.length;
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = customLabel
    ? `PUBG_${customLabel}_${timestampStr}.json`
    : `PUBG_Match_${matchNum}_Backup_${timestampStr}.json`;

  const backupData = {
    app: 'PUBG Spectator Tournament System',
    tournamentName: config.name,
    backupTimestamp: Date.now(),
    dateStr: new Date().toLocaleString(),
    matchCount: matches.length,
    config,
    matches,
  };

  const fileContent = JSON.stringify(backupData, null, 2);
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [targetFolderId],
    description: `Match backup for ${config.name} with ${matches.length} recorded matches.`,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload to Google Drive: ${errText}`);
  }

  const uploadedFile = await res.json();
  return {
    id: uploadedFile.id,
    name: uploadedFile.name,
    createdTime: uploadedFile.createdTime || new Date().toISOString(),
    size: uploadedFile.size,
    webViewLink: uploadedFile.webViewLink,
  };
};

/**
 * List backups saved in the designated Google Drive folder.
 */
export const listDriveTournamentBackups = async (folderId: string): Promise<DriveBackupFile[]> => {
  const token = cachedAccessToken;
  if (!token) return [];

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=25&fields=files(id,name,createdTime,size,webViewLink)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('[Google Drive] Failed to list backups:', err);
    return [];
  }
};
