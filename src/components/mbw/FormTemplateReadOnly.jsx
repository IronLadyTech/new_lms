import { getFormTemplate } from '../../data/formTemplates/registry';

function groupFields(fields = []) {
  const groups = [];
  const seen = new Set();
  fields.forEach((field) => {
    const section = field.section || 'Details';
    if (!seen.has(section)) {
      seen.add(section);
      groups.push({ section, fields: fields.filter((item) => (item.section || 'Details') === section) });
    }
  });
  return groups;
}

export default function FormTemplateReadOnly({ templateId, fields = {} }) {
  const definition = getFormTemplate(templateId);
  if (!definition?.fields?.length) return <p className="muted">No form data.</p>;

  const groups = groupFields(definition.fields);

  return (
    <div className="mbw-form-template mbw-form-template--readonly">
      {groups.map((group) => (
        <section key={group.section} className="mbw-form-template__section">
          <h3 className="mbw-form-template__section-title">{group.section}</h3>
          <dl className="mbw-form-template__dl">
            {group.fields.map((field) => {
              const value = fields[field.key]?.trim();
              if (!value && field.required === false) return null;
              return (
                <div key={field.key} className="mbw-form-template__dl-row">
                  <dt>{field.label}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
