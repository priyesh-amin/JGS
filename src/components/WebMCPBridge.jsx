import { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/auth-context';
import { api } from '../lib/api';
import { createTools } from '../lib/webmcp-tools';
import { detectWebMCP, registerWebMCP } from '../lib/webmcp-registration';

export default function WebMCPBridge({ onChanged }) {
  const { user, loading } = useContext(AuthContext);
  const [status, setStatus] = useState({ state: 'unavailable' });
  const [connectionKey, setConnectionKey] = useState(0);
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  const dialog = useRef(null);

  useEffect(() => {
    if (!request) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [request]);

  useEffect(() => {
    if (loading || !user || user.mustChangePassword) return;
    const context = detectWebMCP(document, navigator);
    if (!context) return;
    let active = true;
    const settle = value => pending.current?.(value);
    const confirm = details => new Promise(resolve => {
      if (!active || pending.current) { resolve(false); return; }
      const timer = setTimeout(() => settle(false), 120000);
      pending.current = value => {
        clearTimeout(timer);
        pending.current = null;
        setRequest(null);
        resolve(value && active);
      };
      setRequest(details);
    });
    const revoke = () => { active = false; settle(false); registration.stop(); setStatus({ state: 'unavailable' }); };
    const restore = event => { if (event.persisted) setConnectionKey(value => value + 1); };
    const tools = createTools({ user, api, confirm, onChanged, isActive: () => active });
    const registration = registerWebMCP(context, tools, next => { if (active) setStatus(next); });
    window.addEventListener('jgs:unauthenticated', revoke);
    window.addEventListener('pagehide', revoke);
    window.addEventListener('pageshow', restore);
    return () => {
      revoke();
      window.removeEventListener('jgs:unauthenticated', revoke);
      window.removeEventListener('pagehide', revoke);
      window.removeEventListener('pageshow', restore);
    };
  }, [user, loading, onChanged, connectionKey]);

  if (!user || loading) return null;
  const statusText = user.mustChangePassword ? 'Complete password change to use browser assistant' : status.state === 'ready' ? `Browser assistant ready · ${status.count} tools`
    : status.state === 'error' ? 'Browser assistant unavailable · use website controls'
      : 'Browser assistant setup';
  return <>
    <aside className="no-print fixed bottom-3 left-3 z-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow">
      <Link to={user.mustChangePassword ? "/account/security" : "/browser-assistant"} className="underline">{statusText}</Link>
    </aside>
    <dialog ref={dialog} aria-labelledby="webmcp-confirm-title" onCancel={event => { event.preventDefault(); pending.current?.(false); }} className="max-h-[85vh] w-[min(92vw,40rem)] overflow-y-auto rounded-xl p-6 shadow-2xl backdrop:bg-black/50">
      <h2 id="webmcp-confirm-title" className="text-xl font-bold">{request?.title || 'Review website change'}</h2>
      <p className="my-3">Your browser assistant has proposed this change. Check the details before saving.</p>
      <pre className="whitespace-pre-wrap break-words rounded bg-gray-100 p-4 font-sans text-sm">{typeof request?.details === 'string' ? request.details : JSON.stringify(request?.details, null, 2)}</pre>
      <p className="my-3 text-sm">A booking can create an event charge. Cancellation does not guarantee a refund. This request expires after two minutes.</p>
      <div className="flex gap-3"><button type="button" autoFocus onClick={() => pending.current?.(false)} className="min-h-11 rounded border px-4">Keep unchanged</button><button type="button" onClick={() => pending.current?.(true)} className="min-h-11 rounded bg-charity-crimson px-4 text-white">Confirm and save</button></div>
    </dialog>
  </>;
}
