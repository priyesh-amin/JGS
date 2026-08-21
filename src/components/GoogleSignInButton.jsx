import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ onCredential, onError, disabled = false }) {
  const button = useRef(null);
  const callback = useRef(onCredential);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/api/auth/google/config'), loadGoogleIdentity()])
      .then(([config]) => {
        if (!active || !config.enabled || !button.current) return;
        window.google.accounts.id.initialize({
          client_id: config.clientId,
          nonce: config.nonce,
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
          callback: (response) => callback.current(response.credential),
        });
        button.current.replaceChildren();
        window.google.accounts.id.renderButton(button.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(button.current.clientWidth || 352, 352),
        });
        setAvailable(true);
      })
      .catch(() => {
        if (active) onError?.('Google Sign-In could not be loaded. Use your password instead.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [onError]);

  if (!loading && !available) return null;
  return (
    <div
      className={disabled ? 'pointer-events-none opacity-60' : ''}
      aria-busy={loading}
    >
      {loading && <p className="text-center text-sm text-gray-500">Loading Google Sign-In…</p>}
      <div ref={button} className="flex min-h-11 w-full justify-center" />
    </div>
  );
}
