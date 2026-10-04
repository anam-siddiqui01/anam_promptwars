import React, { useId } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  FastForward,
  HelpCircle,
  PenLine,
} from 'lucide-react';
import {
  BlindSpotItemProgress,
  ConfidenceLevel,
} from '../types/decision';

export interface ReflectionCardProps {
  id: string;
  queueNumber: number;
  totalInQueue?: number;
  categoryLabel: string;
  blindSpotTitle: string;
  blindSpotDescription: string;
  question: string;
  progress: BlindSpotItemProgress;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onUpdateItem: (
    id: string,
    updates: Partial<BlindSpotItemProgress>,
    advanceToNext?: boolean
  ) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const CONFIDENCE_OPTIONS: Array<{
  value: ConfidenceLevel;
  label: string;
  hint: string;
}> = [
  { value: 1, label: '1', hint: 'Not at all confident' },
  { value: 2, label: '2', hint: 'Slightly confident' },
  { value: 3, label: '3', hint: 'Moderately confident' },
  { value: 4, label: '4', hint: 'Confident' },
  { value: 5, label: '5', hint: 'Very confident' },
];

export const ReflectionCard: React.FC<ReflectionCardProps> = ({
  id,
  queueNumber,
  totalInQueue = 8,
  categoryLabel,
  blindSpotTitle,
  blindSpotDescription,
  question,
  progress,
  onUpdateItem,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  const textareaId = useId();
  const confidenceGroupId = useId();

  const isAddressed = progress.state === 'ADDRESSED';
  const isNeedsInfo =
    Boolean(progress.needsMoreInfo) || progress.state === 'NEEDS_INFO';
  const isSkipped = Boolean(progress.skipped) || progress.state === 'SKIPPED';
  const isThinking =
    !isAddressed &&
    !isNeedsInfo &&
    !isSkipped &&
    (progress.response.trim().length > 0 || progress.confidence != null);

  const statusMeta = (() => {
    if (isAddressed) {
      return {
        label: 'Addressed',
        className: 'text-[#687572] font-medium',
        icon: (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#6F8F86]/40 bg-[#E3ECE8] text-[#172A2A]">
            <Check className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (isNeedsInfo) {
      return {
        label: 'Needs more information',
        className: 'text-[#172A2A] font-semibold',
        icon: (
          <span
            className="h-2 w-2 rounded-full bg-[#C58B68]"
            aria-hidden="true"
          />
        ),
      };
    }
    if (isThinking) {
      return {
        label: 'In reflection',
        className: 'text-[#172A2A] font-semibold',
        icon: <PenLine className="h-3.5 w-3.5 text-[#6F8F86]" aria-hidden="true" />,
      };
    }
    if (isSkipped) {
      return {
        label: 'Skipped',
        className: 'text-[#687572] font-medium',
        icon: <FastForward className="h-3.5 w-3.5 text-[#687572]" aria-hidden="true" />,
      };
    }
    return {
      label: 'Unexplored',
      className: 'text-[#687572] font-medium',
      icon: <Circle className="h-3 w-3 text-[#D9DDD8]" aria-hidden="true" />,
    };
  })();

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    let nextState = progress.state;
    if (nextState !== 'ADDRESSED') {
      if (progress.needsMoreInfo) {
        nextState = 'NEEDS_INFO';
      } else if (val.trim().length > 0 || progress.confidence != null) {
        nextState = 'THINKING';
      } else {
        nextState = 'OPEN';
      }
    }

    onUpdateItem(id, {
      explored: true,
      skipped: false,
      response: val,
      state: nextState,
    });
  };

  const handleSelectConfidence = (level: ConfidenceLevel) => {
    const nextConfidence = progress.confidence === level ? null : level;
    let nextState = progress.state;
    if (nextState !== 'ADDRESSED') {
      if (progress.needsMoreInfo) {
        nextState = 'NEEDS_INFO';
      } else if (nextConfidence != null || progress.response.trim().length > 0) {
        nextState = 'THINKING';
      } else {
        nextState = 'OPEN';
      }
    }

    onUpdateItem(id, {
      explored: true,
      skipped: false,
      confidence: nextConfidence,
      state: nextState,
    });
  };

  const handleToggleNeedsMoreInfo = () => {
    const nextNeedsInfo = !progress.needsMoreInfo;
    let nextState = progress.state;
    if (nextNeedsInfo) {
      if (nextState !== 'ADDRESSED') {
        nextState = 'NEEDS_INFO';
      }
    } else if (nextState === 'NEEDS_INFO') {
      nextState =
        progress.response.trim().length > 0 || progress.confidence != null
          ? 'THINKING'
          : 'OPEN';
    }

    onUpdateItem(id, {
      explored: true,
      skipped: false,
      needsMoreInfo: nextNeedsInfo,
      state: nextState,
    });
  };

  const handleMarkAddressed = () => {
    const nextAddressed = progress.state !== 'ADDRESSED';
    const fallbackState = progress.needsMoreInfo
      ? 'NEEDS_INFO'
      : progress.response.trim().length > 0 || progress.confidence != null
      ? 'THINKING'
      : 'OPEN';

    onUpdateItem(
      id,
      {
        explored: true,
        skipped: false,
        state: nextAddressed ? 'ADDRESSED' : fallbackState,
      },
      nextAddressed
    );
  };

  const handleSkip = () => {
    onUpdateItem(
      id,
      {
        explored: true,
        skipped: true,
        state: 'SKIPPED',
      },
      true
    );
  };

  const paddedNum = String(queueNumber).padStart(2, '0');
  const paddedTotal = String(totalInQueue).padStart(2, '0');

  return (
    <article
      id={`reflect-card-${id}`}
      className="animate-stage-enter rounded-xs border border-[#D9DDD8] bg-white p-6 sm:p-10 lg:p-12 shadow-2xs"
    >
      {/* Top Meta Bar: Blind spot 03 · Small Uppercase Category Tag + Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9DDD8] pb-5">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono-tabular font-semibold tracking-[0.01em] text-[#172A2A]">
            Blind spot {paddedNum}
          </span>
          <span className="text-[#D9DDD8]" aria-hidden="true">
            ·
          </span>
          <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.12em] text-[#687572] uppercase">
            {categoryLabel}
          </span>
          <span className="text-[#D9DDD8]" aria-hidden="true">
            ·
          </span>
          <span className="font-mono-tabular text-[#687572]">
            {paddedNum} / {paddedTotal}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 text-xs">
          {statusMeta.icon}
          <span className={statusMeta.className}>{statusMeta.label}</span>
        </div>
      </div>

      {/* Blind Spot Premise & Prominent Editorial Question */}
      <div className="mt-8 space-y-6">
        <div className="rounded-xs bg-[#F7F5F0] border border-[#D9DDD8] p-5">
          <span className="block text-xs font-medium tracking-[0.01em] text-[#687572]">
            Surfaced premise
          </span>
          <h3 className="mt-1 font-editorial text-2xl text-[#172A2A] leading-snug">
            {blindSpotTitle}
          </h3>
          {blindSpotDescription && (
            <p className="mt-1.5 text-xs sm:text-sm text-[#687572] leading-relaxed">
              {blindSpotDescription}
            </p>
          )}
        </div>

        <div className="pt-2">
          <span className="block text-xs font-semibold tracking-[0.01em] text-[#6F8F86]">
            Question
          </span>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl text-[#172A2A] leading-snug">
            &ldquo;{question}&rdquo;
          </p>
        </div>

        {/* Focused Reflection Textarea */}
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="block text-sm font-medium tracking-[0.01em] text-[#172A2A]"
            >
              Your reflection
            </label>
            <span className="font-mono-tabular text-xs text-[#687572]">
              {progress.response.length} chars
            </span>
          </div>
          <textarea
            id={textareaId}
            rows={4}
            value={progress.response}
            onChange={handleTextChange}
            placeholder="Write what you actually know here, what you might be taking on faith, or what you still need to check..."
            className="mt-2.5 w-full rounded-xs border border-[#D9DDD8] bg-white px-4 py-3.5 text-base text-[#172A2A] placeholder:text-[#687572]/65 focus:border-[#6F8F86] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6F8F86] leading-relaxed transition-all duration-150"
          />
        </div>

        {/* Confidence Scale (1 2 3 4 5) & [ I need more information ] */}
        <div className="pt-4 border-t border-[#D9DDD8] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-baseline gap-3">
              <span
                id={confidenceGroupId}
                className="text-xs font-semibold text-[#172A2A]"
              >
                How confident are you?
              </span>
              <span className="text-[11px] text-[#687572]">
                1 = Not at all · 5 = Very confident
              </span>
            </div>

            <div
              role="group"
              aria-labelledby={confidenceGroupId}
              className="mt-2.5 inline-flex items-center gap-2"
            >
              {CONFIDENCE_OPTIONS.map((opt) => {
                const selected = progress.confidence === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectConfidence(opt.value)}
                    aria-pressed={selected}
                    title={opt.hint}
                    className={`h-10 w-11 rounded-xs border font-mono-tabular text-xs font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                      selected
                        ? 'border-[#6F8F86] bg-[#E3ECE8] text-[#172A2A] shadow-2xs'
                        : 'border-[#D9DDD8] bg-white text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleNeedsMoreInfo}
              aria-pressed={Boolean(progress.needsMoreInfo)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xs border px-4 py-2 text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                progress.needsMoreInfo
                  ? 'border-[#6F8F86] bg-[#E3ECE8] text-[#172A2A]'
                  : 'border-[#D9DDD8] bg-white text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0]'
              }`}
            >
              {progress.needsMoreInfo ? (
                <span
                  className="h-2 w-2 rounded-full bg-[#C58B68]"
                  aria-hidden="true"
                />
              ) : (
                <HelpCircle
                  className="h-3.5 w-3.5 text-[#687572]"
                  aria-hidden="true"
                />
              )}
              <span>I need more information</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAddressed}
              aria-pressed={isAddressed}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xs border px-4 py-2 text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                isAddressed
                  ? 'border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]'
                  : 'border-[#172A2A] bg-[#172A2A] text-white hover:bg-[#243B3B]'
              }`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isAddressed ? 'Addressed' : 'Mark addressed'}</span>
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xs border border-transparent px-3 py-2 text-xs font-medium text-[#687572] hover:text-[#172A2A] hover:bg-[#F7F5F0] transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Skip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Guided Exercise Navigation: ← Previous | Next → */}
      <div className="mt-8 pt-6 border-t border-[#D9DDD8] flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={onPrev}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-xs border px-4 py-2 text-xs font-semibold tracking-[0.01em] transition-all duration-150 ${
            hasPrev
              ? 'border-[#D9DDD8] bg-white text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] cursor-pointer'
              : 'border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]/50 cursor-not-allowed'
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Previous</span>
        </button>

        <span className="hidden sm:inline-block font-mono-tabular text-xs text-[#687572]">
          Blind spot {paddedNum} of {paddedTotal}
        </span>

        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-xs border px-5 py-2 text-xs font-semibold tracking-[0.01em] transition-all duration-150 ${
            hasNext
              ? 'border-[#172A2A] bg-[#172A2A] text-white hover:bg-[#243B3B] cursor-pointer'
              : 'border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]/50 cursor-not-allowed'
          }`}
        >
          <span>Next</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
