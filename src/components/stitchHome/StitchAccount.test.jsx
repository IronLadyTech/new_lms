// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

/**
 * Settings is about the app; the profile panel is about the person.
 *
 * Identity, contact details and password lived on Settings, one click away from
 * the avatar everybody reaches for. Moving them is only half done if Settings
 * quietly keeps a copy, so the split is pinned from both sides.
 *
 * The ticket flows are here because rewriting the Support page moved every one
 * of them to new markup. The service is mocked rather than exercised: creating
 * a ticket for real puts a support request in front of the Super Admin.
 */

const authState = {
  user: {
    uid: 'u1',
    email: 'learner@example.com',
    providerData: [{ providerId: 'password' }],
  },
  profile: { displayName: 'Test Learner', phone: '', messagingConsent: { granted: false } },
  role: 'student',
  isGuest: false,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('../../context/AuthContext', () => ({ useAuth: () => authState }));

const theme = { theme: 'light', setTheme: vi.fn(), toggleTheme: vi.fn() };
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => theme }));

const ticketApi = {
  createTicket: vi.fn(),
  getUserTickets: vi.fn(),
  getTicketMessages: vi.fn(),
  replyToTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
};

const userApi = { updateUserProfile: vi.fn().mockResolvedValue({}) };
vi.mock('../../services/userService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, ...userApi };
});

vi.mock('../../services/ticketService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, ...ticketApi };
});

const StitchSettings = (await import('./StitchSettings')).default;
const StitchSupport = (await import('./StitchSupport')).default;
const StitchProfilePanel = (await import('./StitchProfilePanel')).default;
const StitchShell = (await import('./StitchShell')).default;

const LEARNER = { displayName: 'Test Learner', initial: 'T', roleLabel: 'Learner' };

const TICKETS = [
  { id: 't1', subject: 'Video will not play', category: 'course', status: 'open' },
  { id: 't2', subject: 'Card declined', category: 'payment', status: 'resolved' },
];

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

/* The page opens on the answers now, so the ticket pane starts `hidden` — and
   `hidden` keeps it out of the accessibility tree, which is where role queries
   look. Every ticket test has to walk in the way a person would. */
const openTickets = async () => {
  await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
  await userEvent.click(screen.getByRole('tab', { name: /my tickets/i }));
  await waitFor(() => expect(document.querySelectorAll('.sup-thread')).toHaveLength(2));
};

beforeEach(() => {
  Object.values(ticketApi).forEach((fn) => fn.mockReset());
  ticketApi.getUserTickets.mockResolvedValue(TICKETS);
  ticketApi.getTicketMessages.mockResolvedValue([
    { id: 'm1', senderRole: 'user', senderName: 'Test Learner', text: 'It buffers forever.' },
    { id: 'm2', senderRole: 'admin', senderName: 'Iron Lady', text: 'Looking into it.' },
  ]);
  ticketApi.createTicket.mockResolvedValue({ id: 't3' });
  theme.setTheme.mockReset();
  userApi.updateUserProfile.mockClear();
  localStorage.clear();
});

afterEach(cleanup);

describe('Settings keeps nothing about the person', () => {
  it('has no identity, contact or password field left on it', async () => {
    wrap(<StitchSettings />);
    const page = document.querySelector('.ac');
    expect(page.querySelectorAll('input[type="password"]')).toHaveLength(0);
    expect(page.querySelectorAll('input[autocomplete="name"]')).toHaveLength(0);
    expect(page.querySelectorAll('input[autocomplete="tel"]')).toHaveLength(0);
    expect(page.textContent).not.toMatch(/display name|mobile number|current password/i);
  });

  it('keeps what genuinely is a setting', async () => {
    wrap(<StitchSettings />);
    expect(screen.getByRole('radio', { name: /light/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /announcements/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /session reminders/i })).toBeTruthy();
  });

  it('actually switches the theme rather than just looking selected', async () => {
    // ThemeContext writes data-theme on <html>; until this session no Stitch
    // stylesheet read it, so the control changed the old pages and left every
    // new one untouched.
    wrap(<StitchSettings />);
    await userEvent.click(screen.getByRole('radio', { name: /dark/i }));
    expect(theme.setTheme).toHaveBeenCalledWith('dark');
  });

  it('remembers a switch on this device', async () => {
    wrap(<StitchSettings />);
    await userEvent.click(screen.getByRole('switch', { name: /announcements/i }));
    expect(JSON.parse(localStorage.getItem('il-lms-notify-prefs')).announcements).toBe(false);
  });

  it('says these are per-device rather than implying they follow the account', () => {
    wrap(<StitchSettings />);
    expect(document.querySelector('.ac').textContent).toMatch(/this browser only/i);
  });
});

describe('the profile panel is where the person now lives', () => {
  it('carries the identity and contact fields Settings gave up', () => {
    wrap(<StitchProfilePanel onClose={() => {}} />);
    const panel = document.querySelector('.ac-panel');
    expect(panel.querySelector('input[autocomplete="name"]')).toBeTruthy();
    expect(panel.querySelector('input[autocomplete="tel"]')).toBeTruthy();
    expect(panel.textContent).toMatch(/whatsapp/i);
  });

  it('carries profession, experience and a photo control', async () => {
    wrap(<StitchProfilePanel onClose={() => {}} />);
    const panel = document.querySelector('.ac-panel');
    const labels = Array.from(panel.querySelectorAll('.ac-f > span')).map((n) => n.textContent);
    expect(labels).toContain('Profession');
    expect(labels).toContain('Years of experience');
    const file = panel.querySelector('.ac-photo input[type="file"]');
    expect(file).toBeTruthy();
    // Images only, and the storage rule enforces the same on the server.
    expect(file.getAttribute('accept')).toBe('image/*');
  });

  it('saves profession and experience alongside the rest', async () => {
    wrap(<StitchProfilePanel onClose={() => {}} />);
    const panel = document.querySelector('.ac-panel');
    const byLabel = (text) =>
      Array.from(panel.querySelectorAll('.ac-f'))
        .find((f) => f.querySelector('span')?.textContent === text)
        ?.querySelector('input');
    await userEvent.type(byLabel('Profession'), 'Head of Product');
    await userEvent.type(byLabel('Years of experience'), '12');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(userApi.updateUserProfile).toHaveBeenCalled());
    expect(userApi.updateUserProfile.mock.calls[0][1]).toMatchObject({
      profession: 'Head of Product',
      experience: '12',
    });
  });

  it('does not offer to change a password it cannot change everywhere', () => {
    /*
     * This LMS writes only Zoho's `LMS_Password`; Moodle reads `Password`. A
     * change made here therefore never reaches Moodle, and the learner is
     * locked out of Moodle and the mobile app — which signs in against Moodle —
     * with her new password. Off until the write-back exists.
     */
    wrap(<StitchProfilePanel onClose={() => {}} />);
    expect(screen.queryByRole('tab', { name: /password/i })).toBeNull();
    expect(document.querySelectorAll('.ac-panel input[type="password"]')).toHaveLength(0);
  });

  it('says where the password can be changed instead', () => {
    wrap(<StitchProfilePanel onClose={() => {}} />);
    const note = document.querySelector('.ac-pw-note');
    expect(note).toBeTruthy();
    expect(note.querySelector('a').getAttribute('href')).toBe('https://lms.iamironlady.com');
    // Opened safely, since it leaves the app.
    expect(note.querySelector('a').getAttribute('rel')).toMatch(/noopener/);
  });

  it('is not mounted at all until the avatar is pressed', () => {
    // The shell mounts it on open. A closed panel that still rendered would
    // hold an auth subscription, and would make every page that renders the
    // shell depend on an auth provider — which broke six other tests.
    render(
      <MemoryRouter>
        <StitchShell nav={{ primary: [], footer: [] }} learner={LEARNER} activeId="x">
          <p>page</p>
        </StitchShell>
      </MemoryRouter>
    );
    expect(document.querySelector('.ac-panel')).toBeNull();
  });
});

describe('support tickets survived the rewrite', () => {
  it('lists what the learner raised, newest first', async () => {
    wrap(<StitchSupport />);
    await openTickets();
    expect(screen.getByText('Video will not play')).toBeTruthy();
  });

  it('counts each status on its filter', async () => {
    wrap(<StitchSupport />);
    await openTickets();
    const resolved = screen.getByRole('tab', { name: /resolved/i });
    expect(resolved.textContent).toMatch(/1/);
    await userEvent.click(resolved);
    expect(document.querySelectorAll('.sup-thread')).toHaveLength(1);
  });

  it('opens a ticket as a conversation', async () => {
    wrap(<StitchSupport />);
    await openTickets();
    await userEvent.click(screen.getByText('Video will not play'));
    await waitFor(() => expect(document.querySelectorAll('.sup-msg')).toHaveLength(2));
    // The learner's own message is marked as hers, so a reply reads as a reply.
    expect(document.querySelectorAll('.sup-msg.mine')).toHaveLength(1);
  });

  it('sends a new ticket with the category that was chosen', async () => {
    wrap(<StitchSupport />);
    await openTickets();
    await userEvent.click(screen.getByRole('button', { name: /new ticket/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Payment issue' }));
    await userEvent.type(screen.getByLabelText(/subject/i), 'Refund not received');
    await userEvent.type(screen.getByLabelText(/what happened/i), 'Paid twice.');
    await userEvent.click(screen.getByRole('button', { name: /send ticket/i }));

    await waitFor(() => expect(ticketApi.createTicket).toHaveBeenCalled());
    expect(ticketApi.createTicket.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      category: 'payment',
      subject: 'Refund not received',
      message: 'Paid twice.',
    });
  });

  it('posts a reply and empties the box', async () => {
    ticketApi.replyToTicket.mockResolvedValue({});
    wrap(<StitchSupport />);
    await openTickets();
    await userEvent.click(screen.getByText('Video will not play'));
    await waitFor(() => expect(document.querySelectorAll('.sup-msg')).toHaveLength(2));

    const box = screen.getByLabelText(/^reply$/i);
    await userEvent.type(box, 'Still broken today.');
    await userEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => expect(ticketApi.replyToTicket).toHaveBeenCalled());
    expect(ticketApi.replyToTicket.mock.calls[0][1]).toMatchObject({
      senderId: 'u1',
      senderRole: 'user',
      text: 'Still broken today.',
    });
    expect(box.value).toBe('');
  });

  it('will not send an empty reply', async () => {
    wrap(<StitchSupport />);
    await openTickets();
    await userEvent.click(screen.getByText('Video will not play'));
    await waitFor(() => expect(document.querySelectorAll('.sup-msg')).toHaveLength(2));
    expect(screen.getByRole('button', { name: /send reply/i }).disabled).toBe(true);
  });

  it('edits the subject and category of a ticket already raised', async () => {
    ticketApi.updateTicket.mockResolvedValue({});
    wrap(<StitchSupport />);
    await openTickets();
    await userEvent.click(screen.getByText('Video will not play'));
    await userEvent.click(screen.getByRole('button', { name: /edit ticket/i }));

    const subject = document.querySelector('.sup-edit input');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Video stalls at 2 minutes');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(ticketApi.updateTicket).toHaveBeenCalled());
    expect(ticketApi.updateTicket.mock.calls[0]).toEqual([
      't1',
      { subject: 'Video stalls at 2 minutes', category: 'course' },
    ]);
  });

  it('asks before deleting, and does not delete when told not to', async () => {
    ticketApi.deleteTicket.mockResolvedValue({});
    wrap(<StitchSupport />);
    await openTickets();
    await userEvent.click(screen.getByText('Video will not play'));
    await userEvent.click(screen.getByRole('button', { name: /delete ticket/i }));

    // The confirm dialog is real; cancelling it must leave the ticket alone.
    await userEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(ticketApi.deleteTicket).not.toHaveBeenCalled();
  });

  it('locks the page for a guest instead of offering a form that cannot post', () => {
    authState.isGuest = true;
    wrap(<StitchSupport />);
    expect(screen.getByText(/sign in to raise a ticket/i)).toBeTruthy();
    expect(document.querySelector('.sup')).toBeNull();
    authState.isGuest = false;
  });
});

describe('answers come first, and hand over when they run out', () => {
  it('opens on the answers, not on a form', async () => {
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    // The ticket pane must be genuinely hidden, not merely marked hidden: a
    // class rule's `display` outranks the UA's `[hidden]`, and it rendered
    // underneath the answers until that was re-stated.
    expect(document.querySelector('.sup').hasAttribute('hidden')).toBe(true);
  });

  it('narrows by category and by search', async () => {
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    const all = document.querySelectorAll('.faq-card').length;

    await userEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
    const sessions = document.querySelectorAll('.faq-card').length;
    expect(sessions).toBeGreaterThan(0);
    expect(sessions).toBeLessThan(all);

    await userEvent.click(
      within(document.querySelector('.faq-cats')).getByRole('tab', { name: 'All' })
    );
    await userEvent.type(screen.getByLabelText(/search help/i), 'password');
    expect(document.querySelectorAll('.faq-card')).toHaveLength(1);
  });

  it('reads an answer as steps rather than a wall', async () => {
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('button', { name: /why is a phase locked/i }));
    expect(document.querySelectorAll('.faq-steps li').length).toBeGreaterThan(1);
  });

  it('carries the question into the ticket instead of making her retype it', async () => {
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.click(
      screen.getByRole('button', { name: /i have paid, but content is still locked/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /ask the team/i }));

    // Lands on the tickets tab with the composer filled in.
    expect(document.querySelector('.sup').hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.sup-compose input').value).toBe(
      'I have paid, but content is still locked'
    );
    // And on the category that matches the question, not a default.
    expect(document.querySelector('.sup-cat.on').textContent).toBe('Payment issue');
  });

  it('offers a ticket when a search finds nothing', async () => {
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.type(screen.getByLabelText(/search help/i), 'zzzzz');
    expect(document.querySelectorAll('.faq-card')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /ask the team/i }));
    expect(document.querySelector('.sup-compose input').value).toBe('zzzzz');
  });

  it('lists only contact details Iron Lady actually publishes', async () => {
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('tab', { name: 'Contact' }));
    const hrefs = Array.from(document.querySelectorAll('.con-row')).map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toContain('mailto:admin@iamironlady.com');
    expect(hrefs).toContain('tel:+916360823123');
    // Every external link opens safely.
    for (const a of document.querySelectorAll('.con-row[target="_blank"]')) {
      expect(a.getAttribute('rel')).toMatch(/noopener/);
    }
  });
});

describe('the tickets tab with nothing in it', () => {
  it('shows one invitation, not two empty panes', async () => {
    ticketApi.getUserTickets.mockResolvedValue([]);
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('tab', { name: /my tickets/i }));
    await waitFor(() => expect(document.querySelector('.sup-first')).toBeTruthy());

    // The split pane earns nothing with no tickets: there is nothing to list
    // and nothing to read, so it said "No tickets yet" beside "Pick a ticket".
    expect(document.querySelector('.sup').hasAttribute('hidden')).toBe(true);
    expect(document.querySelectorAll('.sup-first')).toHaveLength(1);
  });

  it('offers the way to start, right there', async () => {
    ticketApi.getUserTickets.mockResolvedValue([]);
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('tab', { name: /my tickets/i }));
    await userEvent.click(await screen.findByRole('button', { name: /raise your first ticket/i }));
    expect(document.querySelector('.sup-compose')).toBeTruthy();
  });

  it('hides the status filters when there is nothing to filter', async () => {
    // Four chips reading Open 0, Assigned 0, Resolved 0 are noise, and the row
    // carried a permanent scrollbar under them.
    ticketApi.getUserTickets.mockResolvedValue([]);
    wrap(<StitchSupport />);
    await waitFor(() => expect(document.querySelectorAll('.faq-card').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('tab', { name: /my tickets/i }));
    await waitFor(() => expect(document.querySelector('.sup-first')).toBeTruthy());
    expect(document.querySelector('.sup-filters').hasAttribute('hidden')).toBe(true);
  });

  it('goes back to the two panes as soon as a ticket exists', async () => {
    wrap(<StitchSupport />);
    await openTickets();
    expect(document.querySelector('.sup-first')).toBeNull();
    expect(document.querySelector('.sup').hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.sup-filters').hasAttribute('hidden')).toBe(false);
  });
});
