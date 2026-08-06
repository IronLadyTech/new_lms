import { TEMPLATE_IDS, getFormTemplate } from '../../../data/formTemplates/registry';
import DeltaTableEditor from './DeltaTableEditor';
import ErrcTableEditor from './ErrcTableEditor';
import GridTemplateEditor from './GridTemplateEditor';
import FormTemplateEditor from './FormTemplateEditor';

export default function EditableTemplate({ task, submission, canSubmit, onSave }) {
  const templateId = task.templateId || submission?.templateData?.templateId || TEMPLATE_IDS.ERRC;
  const definition = getFormTemplate(templateId);

  if (templateId === TEMPLATE_IDS.DELTA) {
    return (
      <DeltaTableEditor task={task} submission={submission} canSubmit={canSubmit} onSave={onSave} />
    );
  }

  if (templateId === TEMPLATE_IDS.ERRC) {
    return (
      <ErrcTableEditor task={task} submission={submission} canSubmit={canSubmit} onSave={onSave} />
    );
  }

  if (definition?.type === 'grid') {
    return (
      <GridTemplateEditor
        templateId={templateId}
        task={task}
        submission={submission}
        canSubmit={canSubmit}
        onSave={onSave}
      />
    );
  }

  if (definition?.type === 'fields') {
    return (
      <FormTemplateEditor
        templateId={templateId}
        task={task}
        submission={submission}
        canSubmit={canSubmit}
        onSave={onSave}
      />
    );
  }

  return (
    <ErrcTableEditor task={task} submission={submission} canSubmit={canSubmit} onSave={onSave} />
  );
}
