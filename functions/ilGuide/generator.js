const { SYSTEM_PROMPT, jobInstruction } = require('./prompts');
const { generateFallback, resolveJob, resolveEndpointJob, pickQuote } = require('./fallback');
const { getLastMessageId, setLastMessageId } = require('./rotation');

function messageId(job, ctx) {
  if (ctx.nextTask?.id) return `${job}-${ctx.surface}-${ctx.nextTask.id}`;
  if (ctx.upcomingEvent?.id && job === 'event') return `event-${ctx.upcomingEvent.id}`;
  return `${job}-${ctx.surface}-${Date.now()}`;
}

function trimSentences(text, max = 3) {
  const parts = String(text)
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return parts.length > max ? parts.slice(0, max).join(' ') : parts.join(' ');
}

async function callOpenAI(apiKey, model, ctx, job) {
  if (!apiKey) return null;

  let quote = null;
  if (job === 'nudge' || job === 'recommend') {
    quote = pickQuote(null);
  }

  const payload = {
    ...ctx,
    assignedJob: job,
    jobInstruction: jobInstruction(job),
    ...(quote ? { vettedQuote: quote } : {}),
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 180,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Generate one IL Guide whisper for job "${job}". Context JSON:\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);
    const message = String(parsed?.message || '').trim();
    if (message.length >= 10 && message.length <= 500) {
      return message;
    }
  } catch {
    return null;
  }
  return null;
}

async function generateWhisper(db, apiKey, model, ctx) {
  const endpointJob = resolveEndpointJob(ctx);
  const job = resolveJob(ctx, endpointJob);
  const uid = ctx.participantId;
  const surface = ctx.surface;
  const lastId = await getLastMessageId(db, uid, surface);

  let result;
  const llmMessage = await callOpenAI(apiKey, model, ctx, job);

  if (llmMessage) {
    const id = messageId(job, ctx);
    result =
      id === lastId
        ? generateFallback(ctx, job, lastId)
        : { id, message: llmMessage, job, source: 'llm' };
  } else {
    result = generateFallback(ctx, job, lastId);
  }

  if (result.id === lastId && result.id !== 'fallback') {
    result = generateFallback({ ...ctx, firstLogin: false }, job, lastId);
  }

  result.message = trimSentences(result.message);
  await setLastMessageId(db, uid, surface, result.id);
  return result;
}

module.exports = { generateWhisper };
