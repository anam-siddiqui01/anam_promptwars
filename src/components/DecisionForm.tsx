import React, { useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, CornerDownLeft, Plus, RotateCcw } from 'lucide-react';
import { DecisionDraft, PRESET_CONTEXT_OPTIONS } from '../types/decision';
import { ContextChip } from './ContextChip';
import { PrimaryButton } from './PrimaryButton';

export interface DecisionFormProps {
  initialDraft: DecisionDraft;
  onDraftChange: (draft: DecisionDraft) => void;
  onSubmit: (draft: DecisionDraft) => void;
  onResetDraft: () => void;
  isSubmitting?: boolean;
}

const MIN_DECISION_LENGTH = 8;
const MAX_DECISION_LENGTH = 240;
const MIN_REASONING_LENGTH = 20;
const MAX_REASONING_LENGTH = 3000;

/**
 * Local "Thinking Signal" extractor — strictly local, zero API calls.
 * Surfaces 2–5 key themes/factors emphasized in the user's reasoning text.
 */
const SIGNAL_LEXICON: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Stipend & pay',
    pattern:
      /\b(stipend|salary|pay|money|income|compensation|wage|revenue|burn|cost|financial|budget)\b/i,
  },
  {
    label: 'Location',
    pattern:
      /\b(location|close|home|commute|city|relocate|moving|move|remote|hybrid|distance|travel)\b/i,
  },
  {
    label: 'Experience',
    pattern:
      /\b(experience|hands-on|industry|practical|skill|skills|portfolio|work|project)\b/i,
  },
  {
    label: 'Mentorship',
    pattern:
      /\b(mentor|mentorship|learning|learn|guidance|coaching|senior|team)\b/i,
  },
  {
    label: 'Timeline',
    pattern:
      /\b(semester|graduation|graduate|delay|delaying|months|year|schedule|time|timing|urgent|now)\b/i,
  },
  {
    label: 'Career growth',
    pattern:
      /\b(career|promotion|director|lead|scope|milestone|title|prestigious|prestige|brand|future)\b/i,
  },
  {
    label: 'Family & partner',
    pattern:
      /\b(partner|family|parents|spouse|kids|community|friends|relationship|dinners)\b/i,
  },
  {
    label: 'Autonomy',
    pattern:
      /\b(control|autonomy|independent|bootstrapped|bootstrap|freedom|ownership|pressure)\b/i,
  },
  {
    label: 'Competition',
    pattern: /\b(competitor|competition|market|hired|shipping|customers|speed)\b/i,
  },
  {
    label: 'Academics',
    pattern:
      /\b(academic|academics|school|university|college|degree|classes|coursework|gpa|gate|iit|research)\b/i,
  },
  {
    label: 'Wellbeing',
    pattern: /\b(health|burnout|stress|balance|sleep|calm|calmly|energy|pace)\b/i,
  },
  {
    label: 'Security',
    pattern: /\b(return offer|stable|stability|risk|safe|certainty|guarantee)\b/i,
  },
];

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'almost', 'alone', 'along', 'already',
  'also', 'although', 'always', 'among', 'another', 'around', 'because', 'become',
  'before', 'behind', 'being', 'below', 'between', 'both', 'bring', 'build',
  'cannot', 'choice', 'choose', 'company', 'consider', 'considering', 'could',
  'decide', 'decision', 'doing', 'during', 'either', 'enough', 'every', 'feel',
  'feeling', 'first', 'going', 'great', 'having', 'however', 'important', 'instead',
  'leaning', 'little', 'making', 'matter', 'matters', 'maybe', 'means', 'might',
  'month', 'months', 'mostly', 'never', 'nothing', 'offer', 'often', 'option',
  'other', 'others', 'overall', 'people', 'person', 'place', 'point', 'pretty',
  'quite', 'rather', 'really', 'reason', 'reasoning', 'right', 'second', 'seems',
  'several', 'should', 'since', 'small', 'something', 'still', 'taking', 'their',
  'there', 'these', 'things', 'think', 'thinking', 'though', 'three', 'through',
  'today', 'toward', 'towards', 'trying', 'under', 'until', 'using', 'wants',
  'whether', 'which', 'while', 'without', 'working', 'worry', 'would', 'years',
]);

function extractLocalThinkingSignals(
  reasoning: string,
  context: string[]
): string[] {
  const clean = reasoning.trim();
  if (clean.length < 15) return [];

  const matched: string[] = [];

  for (const item of SIGNAL_LEXICON) {
    if (item.pattern.test(clean)) {
      matched.push(item.label);
      if (matched.length >= 4) break;
    }
  }

  if (matched.length < 3) {
    const words = clean
      .replace(/[^a-zA-Z\s-]/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 5 && !STOP_WORDS.has(w));

    for (const w of words) {
      const formatted = w.charAt(0).toUpperCase() + w.slice(1);
      const alreadyCovered = matched.some(
        (m) =>
          m.toLowerCase().includes(w) || w.includes(m.toLowerCase())
      );
      if (!alreadyCovered) {
        matched.push(formatted);
      }
      if (matched.length >= 4) break;
    }
  }

  if (matched.length < 2 && context.length > 0) {
    for (const ctx of context) {
      if (!matched.includes(ctx)) {
        matched.push(ctx);
      }
      if (matched.length >= 3) break;
    }
  }

  return matched.slice(0, 4);
}

export const DecisionForm: React.FC<DecisionFormProps> = ({
  initialDraft,
  onDraftChange,
  onSubmit,
  onResetDraft,
  isSubmitting = false,
}) => {
  const decisionId = useId();
  const decisionErrorId = useId();
  const reasoningId = useId();
  const reasoningErrorId = useId();
  const customContextInputId = useId();
  const customContextErrorId = useId();

  const [decisionTouched, setDecisionTouched] = useState(false);
  const [reasoningTouched, setReasoningTouched] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customContextValue, setCustomContextValue] = useState('');
  const [customContextError, setCustomContextError] = useState<string | null>(
    null
  );

  const customInputRef = useRef<HTMLInputElement>(null);

  const trimmedDecision = initialDraft.decision.trim();
  const trimmedReasoning = initialDraft.reasoning.trim();

  const isDecisionValid =
    trimmedDecision.length >= MIN_DECISION_LENGTH &&
    initialDraft.decision.length <= MAX_DECISION_LENGTH;
  const isReasoningValid =
    trimmedReasoning.length >= MIN_REASONING_LENGTH &&
    initialDraft.reasoning.length <= MAX_REASONING_LENGTH;

  const isFormComplete = isDecisionValid && isReasoningValid;

  const thinkingSignals = useMemo(
    () =>
      extractLocalThinkingSignals(
        initialDraft.reasoning,
        initialDraft.context
      ),
    [initialDraft.reasoning, initialDraft.context]
  );

  const decisionErrorMessage = (() => {
    if (!decisionTouched) return null;
    if (trimmedDecision.length === 0) {
      return 'Please state the decision you are considering.';
    }
    if (trimmedDecision.length < MIN_DECISION_LENGTH) {
      return `Add a bit more specificity (at least ${MIN_DECISION_LENGTH} characters).`;
    }
    if (initialDraft.decision.length > MAX_DECISION_LENGTH) {
      return `Keep the decision question concise (under ${MAX_DECISION_LENGTH} characters).`;
    }
    return null;
  })();

  const reasoningErrorMessage = (() => {
    if (!reasoningTouched) return null;
    if (trimmedReasoning.length === 0) {
      return 'Share the reasoning or considerations behind your current leaning.';
    }
    if (trimmedReasoning.length < MIN_REASONING_LENGTH) {
      return `Write at least a sentence or two (${MIN_REASONING_LENGTH}+ characters) so the mirror has reasoning to examine.`;
    }
    if (initialDraft.reasoning.length > MAX_REASONING_LENGTH) {
      return `Reasoning exceeds the ${MAX_REASONING_LENGTH} character limit.`;
    }
    return null;
  })();

  const handleDecisionChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onDraftChange({
      ...initialDraft,
      decision: e.target.value,
    });
  };

  const handleReasoningChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onDraftChange({
      ...initialDraft,
      reasoning: e.target.value,
    });
  };

  const handleToggleContext = (label: string) => {
    const exists = initialDraft.context.includes(label);
    const updated = exists
      ? initialDraft.context.filter((item) => item !== label)
      : [...initialDraft.context, label];

    onDraftChange({
      ...initialDraft,
      context: updated,
    });

    if (label === 'Other' && !exists) {
      setShowCustomInput(true);
      setTimeout(() => customInputRef.current?.focus(), 20);
    }
  };

  const handleRemoveCustomContext = (label: string) => {
    onDraftChange({
      ...initialDraft,
      context: initialDraft.context.filter((item) => item !== label),
    });
  };

  const handleAddCustomContext = () => {
    const cleaned = customContextValue.trim();
    if (!cleaned) {
      setCustomContextError('Enter a short context label before adding.');
      return;
    }
    if (cleaned.length > 32) {
      setCustomContextError('Custom context should be 32 characters or fewer.');
      return;
    }
    const alreadyExists = initialDraft.context.some(
      (c) => c.toLowerCase() === cleaned.toLowerCase()
    );
    if (alreadyExists) {
      setCustomContextError(`"${cleaned}" is already selected.`);
      return;
    }

    onDraftChange({
      ...initialDraft,
      context: [...initialDraft.context, cleaned],
    });
    setCustomContextValue('');
    setCustomContextError(null);
    customInputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDecisionTouched(true);
    setReasoningTouched(true);

    if (!isFormComplete || isSubmitting) {
      return;
    }
    onSubmit(initialDraft);
  };

  const handleKeyDownForm = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      setDecisionTouched(true);
      setReasoningTouched(true);
      if (isFormComplete && !isSubmitting) {
        onSubmit(initialDraft);
      }
    }
  };

  const customContexts = initialDraft.context.filter(
    (c) => !PRESET_CONTEXT_OPTIONS.includes(c)
  );

  const hasAnyContent =
    initialDraft.decision.length > 0 ||
    initialDraft.reasoning.length > 0 ||
    initialDraft.context.length > 0;

  return (
    <form
      onSubmit={handleFormSubmit}
      onKeyDown={handleKeyDownForm}
      noValidate
      aria-label="Phase 1: Frame your decision"
      className="animate-stage-enter border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10 lg:p-12 shadow-2xs"
    >
      {/* Hero / Main Heading Hierarchy: small eyebrow ↓ large serif heading ↓ short supporting text */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#D9DDD8] pb-8">
        <div>
          <span className="block font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase">
            01 FRAME
          </span>
          <h1
            className="mt-2 font-editorial text-4xl sm:text-5xl text-[#172A2A] leading-[1.12]"
            style={{ textWrap: 'balance' }}
          >
            What&apos;s on your mind?
          </h1>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-[#687572] leading-relaxed">
            Give us the decision you&apos;re considering and the reasoning behind it.
            Don&apos;t try to make it perfect.
          </p>
        </div>

        {hasAnyContent && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setDecisionTouched(false);
              setReasoningTouched(false);
              setCustomContextError(null);
              onResetDraft();
            }}
            className="self-start inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#687572] hover:text-[#172A2A] border border-transparent hover:border-[#D9DDD8] rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear canvas</span>
          </button>
        )}
      </div>

      {/* Guided Narrative Steps: 01 The decision -> 02 Your reasoning -> 03 Context */}
      <div className="mt-10 space-y-12">
        {/* STEP 01: The decision */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
          <div className="md:col-span-3 pt-1">
            <span className="block font-mono-tabular text-xs font-semibold tracking-[0.08em] text-[#6F8F86]">
              01
            </span>
            <span className="mt-0.5 block text-sm font-semibold tracking-[0.01em] text-[#172A2A]">
              The decision
            </span>
            <p className="mt-1.5 hidden md:block text-xs text-[#687572] leading-relaxed">
              State the choice or question as plainly as you would to yourself.
            </p>
          </div>

          <div className="md:col-span-9">
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor={decisionId}
                className="text-sm font-medium tracking-[0.01em] text-[#172A2A]"
              >
                What&apos;s the decision?
              </label>
              <span
                aria-live="off"
                className={`font-mono-tabular text-xs ${
                  initialDraft.decision.length > MAX_DECISION_LENGTH
                    ? 'text-[#C58B68] font-semibold'
                    : 'text-[#687572]'
                }`}
              >
                {initialDraft.decision.length} / {MAX_DECISION_LENGTH}
              </span>
            </div>

            <div className="mt-3">
              <input
                id={decisionId}
                type="text"
                required
                disabled={isSubmitting}
                value={initialDraft.decision}
                onChange={handleDecisionChange}
                onBlur={() => setDecisionTouched(true)}
                placeholder="Should I accept this 6-month internship?"
                aria-invalid={Boolean(decisionErrorMessage)}
                aria-describedby={decisionErrorMessage ? decisionErrorId : undefined}
                className={`w-full rounded-xs border bg-white px-4 py-4 font-editorial text-2xl sm:text-3xl lg:text-[34px] leading-snug text-[#172A2A] placeholder:text-[#687572]/60 transition-all duration-200 focus:bg-white focus:outline-none focus:ring-1 ${
                  decisionErrorMessage
                    ? 'border-[#C58B68] focus:border-[#C58B68] focus:ring-[#C58B68]'
                    : 'border-[#D9DDD8] hover:border-[#6F8F86]/70 focus:border-[#6F8F86] focus:ring-[#6F8F86]'
                }`}
              />
            </div>

            {decisionErrorMessage && (
              <div
                id={decisionErrorId}
                role="alert"
                className="mt-2.5 flex items-center gap-2 text-xs font-medium text-[#172A2A]"
              >
                <AlertCircle
                  className="h-3.5 w-3.5 shrink-0 text-[#C58B68]"
                  aria-hidden="true"
                />
                <span>{decisionErrorMessage}</span>
              </div>
            )}
          </div>
        </section>

        <div className="border-t border-[#D9DDD8]" />

        {/* STEP 02: Your reasoning */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
          <div className="md:col-span-3 pt-1">
            <span className="block font-mono-tabular text-xs font-semibold tracking-[0.08em] text-[#6F8F86]">
              02
            </span>
            <span className="mt-0.5 block text-sm font-semibold tracking-[0.01em] text-[#172A2A]">
              Your reasoning
            </span>
            <p className="mt-1.5 hidden md:block text-xs text-[#687572] leading-relaxed">
              Include your expectations, tradeoffs, or what feels most important right now.
            </p>
          </div>

          <div className="md:col-span-9">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor={reasoningId}
                className="text-sm font-medium tracking-[0.01em] text-[#172A2A]"
              >
                Why are you leaning that way?
              </label>

              <div className="flex items-center gap-2 font-mono-tabular text-xs">
                <span
                  className={
                    trimmedReasoning.length > 0 &&
                    trimmedReasoning.length < MIN_REASONING_LENGTH
                      ? 'text-[#C58B68] font-medium'
                      : 'text-[#687572]'
                  }
                >
                  {trimmedReasoning.length === 0
                    ? `Min ${MIN_REASONING_LENGTH} chars`
                    : trimmedReasoning.length < MIN_REASONING_LENGTH
                    ? `${MIN_REASONING_LENGTH - trimmedReasoning.length} more needed`
                    : 'Ready for reflection'}
                </span>
                <span className="text-[#D9DDD8]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={
                    initialDraft.reasoning.length > MAX_REASONING_LENGTH
                      ? 'text-[#C58B68] font-semibold'
                      : 'text-[#687572]'
                  }
                >
                  {initialDraft.reasoning.length} chars
                </span>
              </div>
            </div>

            <div className="mt-3">
              <textarea
                id={reasoningId}
                rows={7}
                required
                disabled={isSubmitting}
                value={initialDraft.reasoning}
                onChange={handleReasoningChange}
                onBlur={() => setReasoningTouched(true)}
                placeholder={
                  'Write freely about why this choice appeals to you, what tradeoffs you are weighing, or what you are assuming will happen...'
                }
                aria-invalid={Boolean(reasoningErrorMessage)}
                aria-describedby={reasoningErrorMessage ? reasoningErrorId : undefined}
                className={`w-full resize-y rounded-xs border bg-white px-5 py-4 text-base leading-[1.7] text-[#172A2A] placeholder:text-[#687572]/65 transition-all duration-200 focus:bg-white focus:outline-none focus:ring-1 ${
                  reasoningErrorMessage
                    ? 'border-[#C58B68] focus:border-[#C58B68] focus:ring-[#C58B68]'
                    : 'border-[#D9DDD8] hover:border-[#6F8F86]/70 focus:border-[#6F8F86] focus:ring-[#6F8F86]'
                }`}
              />
            </div>

            {reasoningErrorMessage && (
              <div
                id={reasoningErrorId}
                role="alert"
                className="mt-2.5 flex items-center gap-2 text-xs font-medium text-[#172A2A]"
              >
                <AlertCircle
                  className="h-3.5 w-3.5 shrink-0 text-[#C58B68]"
                  aria-hidden="true"
                />
                <span>{reasoningErrorMessage}</span>
              </div>
            )}

            {/* Subtle "Thinking Signal" (Local extraction — zero Gemini calls) */}
            {thinkingSignals.length > 0 && (
              <div
                aria-live="polite"
                className="mt-4 rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] px-4 py-3 transition-all duration-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#687572]">
                      Your reasoning currently emphasizes:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {thinkingSignals.map((sig) => (
                        <span
                          key={sig}
                          className="inline-block rounded-2xs border border-[#6F8F86]/40 bg-[#E3ECE8] px-2.5 py-0.5 text-xs font-medium tracking-[0.01em] text-[#172A2A]"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-[#687572]">
                    You&apos;re telling us what currently matters most to you.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="border-t border-[#D9DDD8]" />

        {/* STEP 03: Context */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
          <div className="md:col-span-3 pt-1">
            <span className="block font-mono-tabular text-xs font-semibold tracking-[0.08em] text-[#6F8F86]">
              03
            </span>
            <span className="mt-0.5 block text-sm font-semibold tracking-[0.01em] text-[#172A2A]">
              Context
            </span>
            <p className="mt-1.5 hidden md:block text-xs text-[#687572] leading-relaxed">
              Optional dimensions that surround this decision.
            </p>
          </div>

          <div className="md:col-span-9">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium tracking-[0.01em] text-[#172A2A]">
                Select relevant dimensions
              </span>
              <span className="font-mono-tabular text-xs text-[#687572]">
                {initialDraft.context.length} selected
              </span>
            </div>

            <div
              role="group"
              aria-label="Context categories"
              className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
            >
              {PRESET_CONTEXT_OPTIONS.map((option) => (
                <ContextChip
                  key={option}
                  label={option}
                  selected={initialDraft.context.includes(option)}
                  onToggle={handleToggleContext}
                  disabled={isSubmitting}
                />
              ))}

              {customContexts.map((customLabel) => (
                <ContextChip
                  key={customLabel}
                  label={customLabel}
                  selected={true}
                  isCustom={true}
                  onToggle={handleToggleContext}
                  onRemoveCustom={handleRemoveCustomContext}
                  disabled={isSubmitting}
                />
              ))}

              {!showCustomInput && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setShowCustomInput(true);
                    setTimeout(() => customInputRef.current?.focus(), 20);
                  }}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xs border border-dashed border-[#D9DDD8] bg-[#F7F5F0] px-3 py-2 text-xs sm:text-sm font-medium text-[#687572] hover:border-[#6F8F86] hover:bg-[#E3ECE8]/50 hover:text-[#172A2A] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Custom</span>
                </button>
              )}
            </div>

            {/* Custom Context Inline Input */}
            {showCustomInput && (
              <div className="mt-3.5 rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-4">
                <label
                  htmlFor={customContextInputId}
                  className="block text-xs font-medium text-[#172A2A]"
                >
                  Add a custom context dimension
                </label>
                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    ref={customInputRef}
                    id={customContextInputId}
                    type="text"
                    value={customContextValue}
                    onChange={(e) => {
                      setCustomContextValue(e.target.value);
                      if (customContextError) setCustomContextError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomContext();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowCustomInput(false);
                        setCustomContextError(null);
                      }
                    }}
                    placeholder="e.g., Visa status, Co-founder alignment, Burnout risk"
                    aria-invalid={Boolean(customContextError)}
                    aria-describedby={customContextError ? customContextErrorId : undefined}
                    className="flex-1 rounded-xs border border-[#D9DDD8] bg-white px-3 py-2 text-xs sm:text-sm text-[#172A2A] placeholder:text-[#687572]/60 focus:border-[#6F8F86] focus:outline-none focus:ring-1 focus:ring-[#6F8F86]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCustomContext}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xs bg-[#172A2A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#243B3B] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
                    >
                      <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomContextError(null);
                        setCustomContextValue('');
                      }}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-xs border border-[#D9DDD8] bg-white px-3 py-2 text-xs font-medium text-[#687572] hover:border-[#6F8F86] hover:text-[#172A2A] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
                {customContextError && (
                  <p
                    id={customContextErrorId}
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#172A2A]"
                  >
                    <AlertCircle
                      className="h-3.5 w-3.5 shrink-0 text-[#C58B68]"
                      aria-hidden="true"
                    />
                    <span>{customContextError}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom CTA Area */}
      <div className="mt-12 border-t border-[#D9DDD8] pt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1 max-w-md">
          <p className="text-xs font-medium text-[#172A2A]">
            Non-prescriptive reflection
          </p>
          <p className="text-xs sm:text-sm text-[#687572] leading-relaxed">
            We will not advise you or score your choice. We will surface what your
            reasoning may be assuming or leaving out.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <PrimaryButton
            type="submit"
            disabled={!isFormComplete}
            isLoading={isSubmitting}
            loadingText="Holding up the mirror..."
            showArrow
          >
            Reflect this decision
          </PrimaryButton>
          <span className="text-xs text-[#687572] font-medium">
            Your decision stays yours.
          </span>
        </div>
      </div>
    </form>
  );
};
