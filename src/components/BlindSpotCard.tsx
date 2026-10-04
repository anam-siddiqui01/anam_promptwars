import React, { useId } from 'react';
import {
  ArrowRight,
  Check,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { BlindSpotItemProgress } from '../types/decision';

export interface BlindSpotCardProps {
  id: string;
  categoryLabel: string;
  examineLabel?: string;
  title: string;
  description: string;
  question: string;
  progress: BlindSpotItemProgress;
  isPrimary?: boolean;
  isHighlighted?: boolean;
  onExploreToggle: (id: string, expand: boolean) => void;
  onSelectThinkAboutIt: (id: string) => void;
  onChangeResponse: (id: string, responseText: string) => void;
  onMarkAddressed: (id: string, addressed: boolean) => void;
}

function getDefaultExamineLabel(categoryLabel: string): string {
  const normalized = categoryLabel.toLowerCase();
  if (normalized.includes('assumption')) return 'Examine assumption';
  if (normalized.includes('factor')) return 'Examine factor';
  if (normalized.includes('evidence')) return 'Examine evidence';
  if (normalized.includes('perspective')) return 'Examine perspective';
  return 'Examine blind spot';
}

export const BlindSpotCard: React.FC<BlindSpotCardProps> = ({
  id,
  categoryLabel,
  examineLabel,
  title,
  description,
  question,
  progress,
  isPrimary = false,
  isHighlighted = false,
  onExploreToggle,
  onSelectThinkAboutIt,
  onChangeResponse,
  onMarkAddressed,
}) => {
  const responseFieldId = useId();
  const isExpanded = progress.explored;
  const isAddressed = progress.state === 'ADDRESSED';
  const isNeedsInfo =
    Boolean(progress.needsMoreInfo) || progress.state === 'NEEDS_INFO';
  const isThinking =
    progress.state === 'THINKING' || progress.response.trim().length > 0;
  const contextualExamineText =
    examineLabel ?? getDefaultExamineLabel(categoryLabel);

  const containerStyle = isAddressed
    ? 'border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]'
    : isExpanded
    ? 'border-[#6F8F86] bg-white shadow-2xs'
    : isPrimary
    ? 'border-[#6F8F86]/75 bg-white hover:border-[#6F8F86] shadow-2xs'
    : 'border-[#D9DDD8] bg-white hover:border-[#6F8F86]';

  return (
    <article
      id={`card-${id}`}
      className={`group rounded-xs border transition-all duration-200 flex flex-col justify-between ${
        isPrimary ? 'p-6 sm:p-8' : 'p-5 sm:p-6'
      } ${containerStyle} ${
        isHighlighted
          ? 'ring-2 ring-[#6F8F86] ring-offset-2 bg-[#E3ECE8]/20'
          : ''
      }`}
    >
      <div>
        {/* Top Row: Category + Quiet Status Indicator aligned with category */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.12em] text-[#687572] uppercase">
              {categoryLabel}
            </span>

            {isPrimary && (
              <>
                <span className="text-[#D9DDD8]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[11px] font-semibold tracking-[0.02em] text-[#6F8F86]">
                  Primary blind spot
                </span>
              </>
            )}

            <span className="text-[#D9DDD8]" aria-hidden="true">
              ·
            </span>

            {/* Quiet Status Indicator aligned with the category */}
            {isAddressed ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#687572]">
                <span>Addressed</span>
                <span aria-hidden="true">✓</span>
              </span>
            ) : isNeedsInfo ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#172A2A]">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#C58B68]"
                  aria-hidden="true"
                />
                <span>Needs more information</span>
              </span>
            ) : isExpanded ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#172A2A]">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#6F8F86]"
                  aria-hidden="true"
                />
                <span>Examining</span>
              </span>
            ) : isThinking ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#172A2A]">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#C58B68]"
                  aria-hidden="true"
                />
                <span>Note saved</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-[#687572] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                <span>Open</span>
                <span aria-hidden="true">→</span>
              </span>
            )}
          </div>

          {isExpanded && (
            <button
              type="button"
              onClick={() => onExploreToggle(id, false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#687572] hover:text-[#172A2A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-2xs"
            >
              <span>Close</span>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Title in DM Serif Display */}
        <h3
          className={`mt-3 font-editorial leading-snug ${
            isPrimary ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
          } ${isAddressed ? 'text-[#687572]' : 'text-[#172A2A]'}`}
        >
          {title}
        </h3>

        {/* Compact preview description when collapsed */}
        {!isExpanded && description && (
          <p
            className={`mt-2 leading-relaxed text-[#687572] ${
              isPrimary
                ? 'text-sm sm:text-base max-w-2xl'
                : 'text-xs sm:text-sm line-clamp-2'
            }`}
          >
            {description}
          </p>
        )}
      </div>

      {/* Contextual Discoverable Trigger when collapsed */}
      {!isExpanded && (
        <div className="mt-5 pt-3.5 border-t border-[#D9DDD8] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onExploreToggle(id, true)}
            aria-expanded={isExpanded}
            className="inline-flex min-h-[34px] items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-[0.01em] text-[#172A2A] group-hover:text-[#6F8F86] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-2xs"
          >
            <span>{contextualExamineText}</span>
            <ArrowRight
              className="h-3.5 w-3.5 text-[#687572] group-hover:translate-x-1 group-hover:text-[#6F8F86] transition-transform duration-200"
              aria-hidden="true"
            />
          </button>

          {progress.response.trim().length > 0 && (
            <span className="font-mono-tabular text-[11px] text-[#687572]">
              Reflection saved
            </span>
          )}
        </div>
      )}

      {/* Smooth Vertical In-Place Expansion: Insight -> Question -> Reflection */}
      <div
        aria-hidden={!isExpanded}
        className={`overflow-hidden transition-all duration-250 ease-out ${
          isExpanded
            ? 'max-h-[720px] opacity-100 translate-y-0 mt-5 pt-5 border-t border-[#D9DDD8]'
            : 'max-h-0 opacity-0 -translate-y-1 mt-0 pt-0 border-t-0 pointer-events-none'
        }`}
      >
        <div className="space-y-5">
          {/* 1. WHY THIS MAY BE A BLIND SPOT */}
          {description && (
            <div>
              <span className="block font-mono-tabular text-[11px] font-semibold tracking-[0.12em] text-[#687572] uppercase">
                WHY THIS MAY BE A BLIND SPOT
              </span>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#172A2A]/90">
                {description}
              </p>
            </div>
          )}

          {/* 2. QUESTION TO CONSIDER */}
          <div className="rounded-xs border-l-2 border-[#6F8F86] bg-[#E3ECE8]/45 pl-4 pr-4 py-3.5">
            <span className="block font-mono-tabular text-[11px] font-semibold tracking-[0.12em] text-[#172A2A] uppercase">
              QUESTION TO CONSIDER
            </span>
            <p className="mt-1.5 font-editorial text-xl sm:text-2xl text-[#172A2A] leading-snug">
              &ldquo;{question}&rdquo;
            </p>
          </div>

          {/* 3. Your reflection (immediately visible inside expanded state) */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={responseFieldId}
                className="block text-xs font-semibold tracking-[0.01em] text-[#172A2A]"
              >
                Your reflection
              </label>
              <span className="font-mono-tabular text-[11px] text-[#687572]">
                {progress.response.length} chars
              </span>
            </div>
            <textarea
              id={responseFieldId}
              rows={3}
              tabIndex={isExpanded ? 0 : -1}
              value={progress.response}
              onFocus={() => {
                if (!progress.thinkingOpen) {
                  onSelectThinkAboutIt(id);
                }
              }}
              onChange={(e) => onChangeResponse(id, e.target.value)}
              placeholder="Write what you know, what remains unverified, or how this affects your thinking..."
              className="mt-2 w-full rounded-xs border border-[#D9DDD8] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#172A2A] placeholder:text-[#687572]/65 focus:border-[#6F8F86] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6F8F86] leading-relaxed transition-colors"
            />
          </div>

          {/* Quiet Status Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {!isAddressed ? (
                <button
                  type="button"
                  tabIndex={isExpanded ? 0 : -1}
                  onClick={() => onMarkAddressed(id, true)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xs border border-[#172A2A] bg-[#172A2A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#243B3B] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mark addressed</span>
                </button>
              ) : (
                <button
                  type="button"
                  tabIndex={isExpanded ? 0 : -1}
                  onClick={() => onMarkAddressed(id, false)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xs border border-[#D9DDD8] bg-white px-3.5 py-1.5 text-xs font-medium text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reopen</span>
                </button>
              )}
            </div>

            <button
              type="button"
              tabIndex={isExpanded ? 0 : -1}
              onClick={() => onExploreToggle(id, false)}
              className="text-xs font-medium text-[#687572] hover:text-[#172A2A] transition-colors cursor-pointer"
            >
              Collapse card
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
