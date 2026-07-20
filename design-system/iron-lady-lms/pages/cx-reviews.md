# Page Override: CX Reviews (`/cx/reviews`)

## Layout
1. PageHeader — Reviews title + refresh
2. Pending queue — learner, task, batch, age, status pill
3. Batch filter when multiple batches exist
4. EmptyState when queue is clear

## Navigation
- Left sidebar on desktop (same CX rail as Home / Batch / Dashboards / Profile)
- Bottom bar on mobile
- Detail route `/cx/review/:userId/:taskId` keeps Review tab active

## Queue rules
- Show every `submitted` / `under_review` submission for program learners
- Join against the full task catalog (not active-phase-only dashboard filter)
- If a task definition is missing, still show the row with a fallback title
- Empty copy distinguishes load errors vs truly empty queue vs device-only learner saves

## Tone
Ops queue — scannable list, one tap into a submission.
