import GridTemplateReadOnly from './GridTemplateReadOnly';
import FormTemplateReadOnly from './FormTemplateReadOnly';
import { getFormTemplate } from '../../data/formTemplates/registry';
import DeltaReadOnlyTable from './DeltaReadOnlyTable';
import ErrcReadOnlyTable from './ErrcReadOnlyTable';
import { TEMPLATE_IDS } from '../../data/formTemplates/registry';

export default function TemplateReadOnly({ templateData, task }) {
  if (!templateData) return null;

  const templateId = templateData.templateId || task?.templateId;
  const def = getFormTemplate(templateId);

  if (templateData.fields && def?.type === 'fields') {
    return <FormTemplateReadOnly templateId={templateId} fields={templateData.fields} />;
  }

  if (templateData.rows?.length) {
    if (templateId === TEMPLATE_IDS.DELTA) {
      return <DeltaReadOnlyTable rows={templateData.rows} />;
    }
    if (templateId === TEMPLATE_IDS.ERRC) {
      return <ErrcReadOnlyTable rows={templateData.rows} />;
    }
    if (def?.type === 'grid') {
      return <GridTemplateReadOnly templateId={templateId} rows={templateData.rows} />;
    }
  }

  return null;
}
