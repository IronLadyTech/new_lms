/**
 * Which of a lesson's links are files to keep, and which are things to go and do.
 *
 * A handout or template belongs with the lesson in the course content list, the
 * way a player keeps its resources; a survey to register for is the task itself
 * and stays in front of the learner. The difference is what the link points at.
 */
const FILE = /\.(pdf|docx?|pptx?|xlsx?|csv|zip)(\?|#|$)/i;

export const isFileResource = (link) => FILE.test(String(link?.url || ''));

/** The lesson's downloadable resources, in the order the lesson lists them. */
export const fileResources = (task) =>
  (task?.resourceLinks || []).filter((link) => link?.url && isFileResource(link));

/** Everything else: links the learner is meant to open and act on. */
export const actionLinks = (task) =>
  (task?.resourceLinks || []).filter((link) => link?.url && !isFileResource(link));
