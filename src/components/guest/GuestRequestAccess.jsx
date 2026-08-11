import { useState } from 'react';
import { Send, ExternalLink } from 'lucide-react';
import { IRON_LADY_CONTACT_EMAIL } from '../../utils/constants';
import { PROGRAM_OPTIONS } from '../../data/programTypes';
import { createAccessRequest } from '../../services/accessRequestService';

const SITE_URL = 'https://iamironlady.com';

function buildMailto(form) {
  const programLabel =
    PROGRAM_OPTIONS.find((p) => p.value === form.program)?.label || form.program;
  const body = [
    'Program access request (Iron Lady LMS guest)',
    '',
    `Name: ${form.name.trim()}`,
    `Email: ${form.email.trim()}`,
    `Program interest: ${programLabel}`,
    '',
    form.message.trim() || 'I would like to learn more about enrolling.',
  ].join('\n');

  return `mailto:${IRON_LADY_CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Program access request — ${programLabel}`
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Guest conversion path.
 *
 * The request is persisted to Firestore first, so the lead is captured even when the
 * visitor has no mail client (where `mailto:` silently no-ops) or abandons the draft.
 * Email is offered afterwards as an optional extra, never as the delivery mechanism.
 */
export default function GuestRequestAccess({ compact = false }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    program: PROGRAM_OPTIONS[0]?.value || 'mbw',
    message: '',
  });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createAccessRequest(form);
      setSent(true);
    } catch (err) {
      console.error(err);
      setError(
        'We could not send your request just now. Please try again, or email us directly at ' +
          `${IRON_LADY_CONTACT_EMAIL}.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="guest-request guest-request--sent" role="status">
        <p>
          <strong>Request received.</strong> The Iron Lady team will contact you at{' '}
          {form.email.trim()} about your programme options.
        </p>
        <div className="guest-request__actions">
          <a href={buildMailto(form)} className="btn btn-outline btn-sm">
            <Send size={14} aria-hidden="true" />
            Also email us a copy
          </a>
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
            <ExternalLink size={14} aria-hidden="true" />
            Explore on iamironlady.com
          </a>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSent(false);
            setForm((f) => ({ ...f, message: '' }));
          }}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <section className={`guest-request${compact ? ' guest-request--compact' : ''}`}>
      {!compact && (
        <>
          <h3 className="guest-request__title">Request program access</h3>
          <p className="muted guest-request__lead">
            Tell us which track you want. We&apos;ll route your request to the Iron Lady team — no account
            required to enquire.
          </p>
        </>
      )}
      <form className="guest-request__form" onSubmit={handleSubmit}>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="guest-access-name">Your name</label>
          <input
            id="guest-access-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="guest-access-email">Email</label>
          <input
            id="guest-access-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="guest-access-program">Program</label>
          <select
            id="guest-access-program"
            value={form.program}
            onChange={(e) => setForm({ ...form, program: e.target.value })}
          >
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="guest-access-message">Message (optional)</label>
          <textarea
            id="guest-access-message"
            rows={compact ? 2 : 3}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Tell us about your business stage or cohort timing…"
          />
        </div>
        <div className="guest-request__actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            <Send size={14} aria-hidden="true" />
            {submitting ? 'Sending…' : 'Request access'}
          </button>
          <a
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Explore on iamironlady.com
          </a>
        </div>
      </form>
    </section>
  );
}
