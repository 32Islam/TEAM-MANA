import { useState, useEffect, useRef, useCallback } from 'react';

export interface AdminSessionInfo {
  deviceId: string;
  deviceName: string;
  acquiredAt: number;
  lastHeartbeat: number;
}

const STORAGE_KEYS = {
  DEVICE_ID: 'pubg_admin_device_id_v1',
  DEVICE_NAME: 'pubg_admin_device_name_v1',
  LOCAL_LOCK: 'pubg_admin_local_lock_v1',
};

const CHANNEL_NAME = 'pubg_admin_session_lock_channel';
const HEARTBEAT_INTERVAL_MS = 2500;
const LOCK_EXPIRATION_MS = 9000;

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_render';
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    const randomHex = Math.random().toString(36).substring(2, 9);
    const ts = Date.now().toString(36);
    deviceId = `dev_${randomHex}_${ts}`;
    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    } catch {
      // Fallback
    }
  }
  return deviceId;
}

export function getFriendlyDeviceName(): string {
  if (typeof window === 'undefined') return 'Admin Device';
  const custom = localStorage.getItem(STORAGE_KEYS.DEVICE_NAME);
  if (custom && custom.trim()) return custom.trim();

  const ua = navigator.userAgent;
  let os = 'Device';
  if (ua.includes('Windows')) os = 'Windows PC';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'MacBook / Mac';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android Mobile';
  else if (ua.includes('Linux')) os = 'Linux Workstation';

  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  return `${os} (${browser})`;
}

export function saveCustomDeviceName(name: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, name.trim());
  } catch {}
}

export function useAdminSessionLock(isEnabled: boolean) {
  const deviceId = useRef(getOrCreateDeviceId()).current;
  const [deviceName, setDeviceNameState] = useState(getFriendlyDeviceName());
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [activeSession, setActiveSession] = useState<AdminSessionInfo | null>(null);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const updateDeviceName = useCallback((newName: string) => {
    saveCustomDeviceName(newName);
    setDeviceNameState(newName);
  }, []);

  // Broadcast lock state to other tabs on same browser
  const broadcastState = useCallback((session: AdminSessionInfo | null, action: string) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'ADMIN_LOCK_EVENT',
          action,
          session,
          senderDeviceId: deviceId,
          timestamp: Date.now(),
        });
      } catch {}
    }
  }, [deviceId]);

  // Acquire or refresh lock via server + local storage
  const claimLock = useCallback(async (force = false) => {
    if (!isEnabled) {
      setIsLockedOut(false);
      return;
    }

    const currentName = getFriendlyDeviceName();
    setIsAcquiring(true);

    try {
      // 1. Try Server Lock first
      const res = await fetch('/api/admin/lock/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: currentName,
          force,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsLockedOut(false);
          setActiveSession(data.activeSession);
          // Sync local storage
          localStorage.setItem(STORAGE_KEYS.LOCAL_LOCK, JSON.stringify(data.activeSession));
          broadcastState(data.activeSession, force ? 'FORCE_CLAIM' : 'CLAIM');
        } else if (data.lockedByOther && data.activeSession) {
          setIsLockedOut(true);
          setActiveSession(data.activeSession);
        }
      } else {
        // Fallback to localStorage if offline/custom
        handleLocalStorageLock(force, currentName);
      }
    } catch {
      // Offline fallback to localStorage lock
      handleLocalStorageLock(force, currentName);
    } finally {
      setIsAcquiring(false);
    }
  }, [deviceId, isEnabled, broadcastState]);

  const handleLocalStorageLock = (force: boolean, currentName: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_LOCK);
      const now = Date.now();
      if (raw) {
        const parsed: AdminSessionInfo = JSON.parse(raw);
        if (
          parsed.deviceId &&
          parsed.deviceId !== deviceId &&
          now - parsed.lastHeartbeat < LOCK_EXPIRATION_MS &&
          !force
        ) {
          setIsLockedOut(true);
          setActiveSession(parsed);
          return;
        }
      }

      const mySession: AdminSessionInfo = {
        deviceId,
        deviceName: currentName,
        acquiredAt: now,
        lastHeartbeat: now,
      };
      localStorage.setItem(STORAGE_KEYS.LOCAL_LOCK, JSON.stringify(mySession));
      setIsLockedOut(false);
      setActiveSession(mySession);
      broadcastState(mySession, force ? 'FORCE_CLAIM' : 'CLAIM');
    } catch {}
  };

  // Heartbeat loop
  const sendHeartbeat = useCallback(async () => {
    if (!isEnabled || isLockedOut) return;
    const currentName = getFriendlyDeviceName();

    try {
      const res = await fetch('/api/admin/lock/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, deviceName: currentName }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.isOwner) {
          setActiveSession(data.activeSession);
          localStorage.setItem(STORAGE_KEYS.LOCAL_LOCK, JSON.stringify(data.activeSession));
        } else if (!data.isOwner && data.activeSession) {
          setIsLockedOut(true);
          setActiveSession(data.activeSession);
        }
      }
    } catch {
      // Refresh local lock
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_LOCK);
        if (raw) {
          const parsed: AdminSessionInfo = JSON.parse(raw);
          if (parsed.deviceId === deviceId) {
            parsed.lastHeartbeat = Date.now();
            localStorage.setItem(STORAGE_KEYS.LOCAL_LOCK, JSON.stringify(parsed));
          }
        }
      } catch {}
    }
  }, [deviceId, isEnabled, isLockedOut]);

  // Release lock
  const releaseLock = useCallback(async () => {
    try {
      await fetch('/api/admin/lock/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
    } catch {}

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_LOCK);
      if (raw) {
        const parsed: AdminSessionInfo = JSON.parse(raw);
        if (parsed.deviceId === deviceId) {
          localStorage.removeItem(STORAGE_KEYS.LOCAL_LOCK);
        }
      }
      broadcastState(null, 'RELEASE');
    } catch {}
  }, [deviceId, broadcastState]);

  // Force takeover
  const forceTakeover = useCallback(() => {
    claimLock(true);
  }, [claimLock]);

  // Setup BroadcastChannel and storage listener
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannelRef.current = bc;

      bc.onmessage = (e) => {
        const data = e.data;
        if (!data || !isEnabled) return;

        if (data.action === 'FORCE_CLAIM' && data.senderDeviceId !== deviceId) {
          setIsLockedOut(true);
          setActiveSession(data.session);
        } else if (data.action === 'RELEASE' && data.senderDeviceId !== deviceId) {
          // Previous lock released, attempt to claim
          claimLock(false);
        }
      };
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.LOCAL_LOCK && isEnabled) {
        if (!e.newValue) {
          claimLock(false);
        } else {
          try {
            const session: AdminSessionInfo = JSON.parse(e.newValue);
            if (session.deviceId !== deviceId && Date.now() - session.lastHeartbeat < LOCK_EXPIRATION_MS) {
              setIsLockedOut(true);
              setActiveSession(session);
            }
          } catch {}
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [deviceId, isEnabled, claimLock]);

  // Initial claim & periodic heartbeat
  useEffect(() => {
    if (!isEnabled) {
      setIsLockedOut(false);
      return;
    }

    claimLock(false);

    const interval = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    const handleBeforeUnload = () => {
      // Best effort release
      navigator.sendBeacon?.(
        '/api/admin/lock/release',
        new Blob([JSON.stringify({ deviceId })], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEnabled, claimLock, sendHeartbeat, deviceId]);

  return {
    isLockedOut,
    activeSession,
    isAcquiring,
    deviceId,
    deviceName,
    updateDeviceName,
    forceTakeover,
    releaseLock,
    isCurrentDeviceHolder: !isLockedOut,
  };
}
