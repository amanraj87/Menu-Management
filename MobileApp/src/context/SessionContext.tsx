import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_STORAGE_KEY } from '../config';
import { setAuthUserId } from '../api/client';
import {
  scheduleWeeklyPlanReminder,
  cancelWeeklyPlanReminder,
} from '../services/notifications';
import { registerPushToken, unregisterPushToken } from '../services/push';
import type { UserSession } from '../types';

interface SessionContextValue {
  session: UserSession | null;
  hydrated: boolean;
  signIn: (session: UserSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as UserSession;
          if (parsed?.userId) {
            setAuthUserId(parsed.userId);
            setSession(parsed);
          }
        }
      } catch {
        // ignore corrupt session
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Notification lifecycle. Runs after hydration so we don't churn on launch.
  const role = session?.role;
  const userId = session?.userId;
  useEffect(() => {
    if (!hydrated) return;

    // Remote push (FCM): register this device's token for the signed-in user
    // (any role), unregister on sign-out.
    if (userId) {
      registerPushToken().catch(() => {});
    } else {
      unregisterPushToken().catch(() => {});
    }

    // P1 local reminder: only while a person is signed in.
    if (role === 'person') {
      scheduleWeeklyPlanReminder().catch(() => {});
    } else {
      cancelWeeklyPlanReminder().catch(() => {});
    }
  }, [hydrated, role, userId]);

  const signIn = useCallback(async (next: UserSession) => {
    setAuthUserId(next.userId);
    setSession(next);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(async () => {
    setAuthUserId(null);
    setSession(null);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ session, hydrated, signIn, signOut }),
    [session, hydrated, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
