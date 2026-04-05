import { useEffect, useRef } from 'react';
import {
  clearBackendAuthCookie,
  getSupabaseSession,
  setBackendAuthCookie,
  subscribeToAuthStateChange,
} from '../api/authClient';

interface UseAuthBootstrapParams {
  onSessionReady: () => void | Promise<void>;
  onSignedOut: () => void;
}

export function useAuthBootstrap({ onSessionReady, onSignedOut }: UseAuthBootstrapParams) {
  const onSessionReadyRef = useRef(onSessionReady);
  const onSignedOutRef = useRef(onSignedOut);

  useEffect(() => {
    onSessionReadyRef.current = onSessionReady;
  }, [onSessionReady]);

  useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const session = await getSupabaseSession();
        if (!active) return;

        if (session) {
          setBackendAuthCookie(session.access_token);
        }

        await onSessionReadyRef.current();
      } catch {
        if (!active) return;
        await onSessionReadyRef.current();
      }
    };

    bootstrap();

    const { data: { subscription } } = subscribeToAuthStateChange((_event, session) => {
      if (session) {
        setBackendAuthCookie(session.access_token);
        void onSessionReadyRef.current();
      } else {
        clearBackendAuthCookie();
        onSignedOutRef.current();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
}
