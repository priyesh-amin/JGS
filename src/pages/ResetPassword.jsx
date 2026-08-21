import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { api } from '../lib/api';

function resetTokenFromLocation() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
}

export default function ResetPassword() {
  const [token] = useState(resetTokenFromLocation);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState({}, '', '/reset-password');
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      setComplete(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (resetError) {
      setError(resetError.message || 'Your password could not be reset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <section className="mx-auto max-w-lg rounded-2xl border border-border-light bg-white p-6 shadow-lg sm:p-9">
        <span className="text-xs font-black uppercase tracking-[0.22em] text-trophy-gold">Account security</span>
        <h1 className="mt-2 text-3xl font-serif font-black text-midnight-navy">Reset password</h1>
        {complete ? (
          <div className="mt-6 space-y-5">
            <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-jaguar-green" role="status">
              Your password has been reset. You can now sign in.
            </p>
            <Link to="/login" className="block min-h-12 rounded-lg bg-jaguar-green px-5 py-3 text-center font-black uppercase tracking-wider text-white shadow">Continue to sign in</Link>
          </div>
        ) : token ? (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <p className="text-sm leading-6 text-gray-600">Choose a password of at least 11 characters.</p>
            <PasswordField id="reset-new-password" label="New password" value={newPassword} onChange={setNewPassword} />
            <PasswordField id="reset-confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
            <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-lg bg-jaguar-green px-5 py-3 font-black uppercase tracking-wider text-white shadow disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-5">
            <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">This reset link is invalid or incomplete.</p>
            <Link to="/forgot-password" className="font-bold text-jaguar-green underline">Request a new link</Link>
          </div>
        )}
      </section>
    </MainLayout>
  );
}

function PasswordField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-midnight-navy">{label}</label>
      <input id={id} type="password" required minLength={11} maxLength={200} autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full rounded-lg border border-gray-300 px-4 focus:border-jaguar-green focus:outline-none focus:ring-2 focus:ring-jaguar-green/30" />
    </div>
  );
}
