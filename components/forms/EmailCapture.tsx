'use client';

import { FormEvent, useState } from 'react';
import { insertProspect } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!email || !/.+@.+\..+/.test(email)) {
      setError('Please enter a valid email address.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setError(null);
    let utm: Record<string, string | null> = {};
    try {
      const params = new URLSearchParams(window.location.search);
      utm = {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term'),
      };
    } catch {
      /* noop */
    }
    const result = await insertProspect({
      email,
      source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
      ...utm,
    });
    if (result.ok) {
      setStatus('success');
      track('email_subscribed');
    } else {
      setStatus('error');
      setError(result.error ?? 'Something went wrong.');
    }
  }

  if (status === 'success') {
    return (
      <p className="rounded-md bg-clean-white/10 px-4 py-3 text-clean-white text-small">
        Thanks. The next monthly live report will arrive at <strong>{email}</strong>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <label htmlFor="email" className="sr-only">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="flex-1 rounded-md border border-clean-white/30 bg-clean-white/10 px-4 py-2.5 text-clean-white placeholder:text-clean-white/50 focus:outline-none focus:border-warm-gold"
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="btn-ghost-light disabled:opacity-60"
      >
        {status === 'submitting' ? 'Submitting…' : 'Subscribe'}
      </button>
      {status === 'error' && error ? (
        <p role="alert" className="text-small text-signal-red sm:basis-full">{error}</p>
      ) : null}
    </form>
  );
}
