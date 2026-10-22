import { TEMPLATE_IDS, getFormTemplate } from '../../../data/formTemplates/registry';
import LearnerSubmissionPreview from '../../submissions/LearnerSubmissionPreview';
import DeltaTableEditor from './DeltaTableEditor';
import ErrcTableEditor from './ErrcTableEditor';
import GridTemplateEditor from './GridTemplateEditor';
import FormTemplateEditor from './FormTemplateEditor';

/*
 * An answer sent before this task became a template.
 *
 * Several LEP worksheets were a text box or a file upload first, and say so with
 * `previousType`. What learners sent then lives in `textValue` or a file, never
 * in `templateData`, so the table on its own would show an empty grid over work
 * already done.
 *
 * Only a task carrying `previousType` takes this path. Every other template,
 * MBW's included, renders exactly as it did.
 */
export function hasEarlierAnswer(task, submission) {
  if (!task?.previousType || !submission || submission.templateData) return false;
  return Boolean(
    submission.textValue?.trim() ||
    submission.fileUrl ||
    submission.fileName ||
    submission.linkValue ||
    submission.checkedItems?.length
  );
}

function TemplateEditor({
  task,
  submission,
  canSubmit,
  onSave,
  guidance = false,
  submitLabel = '',
  compareTo = null,
  draftKey = '',
  locked = false,
  onDraftChange,
  onDiscard,
}) {
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
        guidance={guidance}
        submitLabel={submitLabel}
        compareTo={compareTo}
        draftKey={draftKey}
        locked={locked}
        onDraftChange={onDraftChange}
        onDiscard={onDiscard}
      />
    );
  }

  return (
    <ErrcTableEditor task={task} submission={submission} canSubmit={canSubmit} onSave={onSave} />
  );
}

export default function EditableTemplate(props) {
  const { task, submission, canSubmit } = props;
  const earlier = hasEarlierAnswer(task, submission);

  // Sent and not returned: show what was sent, and no empty table beside it.
  if (earlier && !canSubmit) {
    return <LearnerSubmissionPreview submission={submission} task={task} />;
  }

  return (
    <>
      {earlier && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Your earlier answer</h3>
          <LearnerSubmissionPreview submission={submission} task={task} />
        </div>
      )}
      <TemplateEditor {...props} />
    </>
  );
}
