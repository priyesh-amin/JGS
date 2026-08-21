import { useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { api } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const result = await api.post('/api/auth/forgot-password', { email });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message || 'The reset request could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <section className="mx-auto max-w-lg rounded-2xl border border-border-light bg-white p-6 shadow-lg sm:p-9">
        <span className="text-xs font-black uppercase tracking-[0.22em] text-trophy-gold">Account security</span>
        <h1 className="mt-2 text-3xl font-serif font-black text-midnight-navy">Forgot password</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Enter the email address on the member list. A one-time link will be valid for 60 minutes.
        </p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="reset-email" className="mb-2 block text-sm font-bold text-midnight-navy">Email address</label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 w-full rounded-lg border border-gray-300 px-4 focus:border-jaguar-green focus:outline-none focus:ring-2 focus:ring-jaguar-green/30"
            />
          </div>
          {message && <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-jaguar-green" role="status">{message}</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-lg bg-jaguar-green px-5 py-3 font-black uppercase tracking-wider text-white shadow disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm"><Link to="/login" className="font-bold text-jaguar-green underline">Back to sign in</Link></p>
      </section>
    </MainLayout>
  );
}
