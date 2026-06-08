import { useState } from 'react';
import { currentWeekLabel } from '../../../services/mbwService';

export default function RecurringPost({ task, submission, canSubmit, onAddPost }) {
  const [link, setLink] = useState('');
  const weekLabel = currentWeekLabel();
  const entries = submission?.weekEntries || [];
  const thisWeek = entries.find((e) => e.weekLabel === weekLabel);
  const links = thisWeek?.links || (thisWeek?.linkValue ? [thisWeek.linkValue] : []);
  const needed = task.postsPerWeek || 1;

  return (
    <div className="mbw-submission mbw-recurring">
      <p className="muted">{task.description}</p>
      <p className="mbw-recurring__week">
        This week: <strong>{weekLabel}</strong> — {links.length} / {needed} post{needed !== 1 ? 's' : ''}
      </p>

      {entries.length > 0 && (
        <ul className="mbw-recurring__history">
          {entries
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={i}>
                <span className="muted">{e.weekLabel}</span>{' '}
                {(e.links || [e.linkValue]).filter(Boolean).map((l, j) => (
                  <a key={j} href={l} target="_blank" rel="noreferrer">
                    Post {j + 1}
                  </a>
                ))}
              </li>
            ))}
        </ul>
      )}

      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Paste LinkedIn post URL"
        disabled={!canSubmit}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canSubmit || !link.trim()}
        onClick={async () => {
          await onAddPost(link.trim());
          setLink('');
        }}
      >
        Submit post link
      </button>
    </div>
  );
}
