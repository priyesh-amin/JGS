import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { useAuth } from '../contexts/useAuth';
import { safeInternalPath } from '../lib/navigation';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function AccountSecurity() {
  const { changePassword, linkGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleMessage, setGoogleMessage] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const needsCurrentPassword = user.signedInWith !== 'google';
  const hasPassword = user.authenticationMethods?.password !== false;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate(safeInternalPath(location.state?.from?.pathname), { replace: true });
    } catch (changeError) {
      setError(changeError.message || 'Your password could not be changed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setGoogleError('');
    setGoogleMessage('');
    setLinkingGoogle(true);
    try {
      await linkGoogle(credential);
      setGoogleMessage('Your Google Account is now linked.');
    } catch (linkError) {
      setGoogleError(linkError.message || 'Your Google Account could not be linked.');
    } finally {
      setLinkingGoogle(false);
    }
  };

  return (
    <MainLayout>
      <section className="mx-auto max-w-lg rounded-2xl border border-border-light bg-white p-6 shadow-lg sm:p-9">
        <span className="text-xs font-black uppercase tracking-[0.22em] text-trophy-gold">
          Account security
        </span>
        <h1 className="mt-2 text-3xl font-serif font-black text-midnight-navy">
          {user.mustChangePassword
            ? 'Choose your own password'
            : hasPassword ? 'Change password' : 'Create a fallback password'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Use at least 11 characters. Your other signed-in sessions will be closed.
        </p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {needsCurrentPassword && (
            <PasswordField
              id="current-password"
              label="Current or temporary password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          )}
          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-lg bg-jaguar-green px-5 py-3 font-black uppercase tracking-wider text-white shadow disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jaguar-green"
          >
            {submitting ? 'Saving…' : 'Save secure password'}
          </button>
        </form>

        <div className="my-8 h-px bg-gray-200" />
        <h2 className="text-xl font-serif font-black text-midnight-navy">Google Sign-In</h2>
        {user.authenticationMethods?.google ? (
          <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-semibold text-jaguar-green" role="status">
            A Google Account is linked to this member account.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-6 text-gray-600">
              Link the Google Account that uses {user.email}. You can then sign in without a website password.
            </p>
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              onError={setGoogleError}
              disabled={linkingGoogle}
            />
          </div>
        )}
        {googleMessage && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-semibold text-jaguar-green" role="status">{googleMessage}</p>}
        {googleError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{googleError}</p>}
      </section>
    </MainLayout>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-midnight-navy">{label}</label>
      <input
        id={id}
        type="password"
        required
        minLength={11}
        maxLength={200}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-lg border border-gray-300 px-4 focus:border-jaguar-green focus:outline-none focus:ring-2 focus:ring-jaguar-green/30"
      />
    </div>
  );
}
