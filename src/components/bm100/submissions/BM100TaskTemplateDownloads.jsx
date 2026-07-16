import { Download, ExternalLink } from 'lucide-react';
import { getBm100TaskTemplates } from '../../../data/bm100TaskTemplates';

export default function BM100TaskTemplateDownloads({ taskId, task }) {
  const templates = getBm100TaskTemplates(taskId, task);
  if (!templates.length) return null;

  return (
    <div className="mbw-submission__templates">
      <p className="mbw-submission__templates-label">
        <strong>Templates &amp; references</strong> — download, complete offline, then submit on this task:
      </p>
      <div className="mbw-submission__templates-list">
        {templates.map((t) =>
          t.type === 'image' ? (
            <figure key={t.file} className="mbw-submission__template-figure">
              <img src={t.file} alt={t.label} className="mbw-submission__template-image" />
              <figcaption>{t.label}</figcaption>
            </figure>
          ) : (
            <a
              key={t.file}
              href={t.file}
              download={t.external ? undefined : ''}
              target={t.external ? '_blank' : undefined}
              rel={t.external ? 'noreferrer' : undefined}
              className="btn btn-outline btn-sm"
            >
              {t.external ? (
                <ExternalLink size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              ) : (
                <Download size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              )}
              {t.label}
            </a>
          )
        )}
      </div>
      {templates.some((t) => t.hint) && (
        <ul className="mbw-submission__templates-hints muted">
          {templates.filter((t) => t.hint).map((t) => (
            <li key={`hint-${t.file}`}>{t.hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
