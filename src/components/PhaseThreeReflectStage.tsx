import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  BlindSpotCategory,
  BlindSpotItemProgress,
  DecisionSession,
  ReflectionSynthesis,
} from '../types/decision';
import {
  buildInitialBlindSpotProgress,
  ReflectionSynthesisRequestItem,
} from '../services/sessionStorage';
import { ReflectionCard } from './ReflectionCard';
import { EmptyState } from './EmptyState';

export interface PhaseThreeReflectStageProps {
  session: DecisionSession;
  onUpdateBlindSpotProgress: (
    updatedProgress: Record<string, BlindSpotItemProgress>
  ) => void;
  onSynthesizeReflections: (
    items: ReflectionSynthesisRequestItem[]
  ) => Promise<void>;
  onBackToMirror: () => void;
  onContinueToStressTest: () => void;
  isSynthesizing?: boolean;
}

interface FlattenedBlindSpot {
  id: string;
  queueNumber: number;
  category: BlindSpotCategory;
  categoryLabel: string;
  title: string;
  description: string;
  question: string;
}

function buildLocalBeforeReasons(reasoning: string): string[] {
  const clauses = reasoning
    .split(/(?:[.;?!]|\b(?:because|since|and|however|though|while)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  if (clauses.length === 0) {
    return [reasoning.trim()];
  }
  return clauses.slice(0, 4);
}

function buildLocalAfterSummary(
  items: FlattenedBlindSpot[],
  progressMap: Record<string, BlindSpotItemProgress>
): {
  afterText: string;
  openNeeds: string[];
} {
  const writtenNotes: string[] = [];
  const needInfoTitles: string[] = [];
  const lowConfidenceTitles: string[] = [];

  for (const item of items) {
    const prog = progressMap[item.id];
    if (!prog) continue;
    if (prog.response.trim().length > 0) {
      writtenNotes.push(prog.response.trim());
    }
    if (prog.needsMoreInfo || prog.state === 'NEEDS_INFO') {
      needInfoTitles.push(`${item.title} (${item.question})`);
    } else if (prog.confidence != null && prog.confidence <= 2) {
      lowConfidenceTitles.push(item.title.toLowerCase());
    }
  }

  let afterText = '';
  if (writtenNotes.length > 0) {
    const combinedNotes = writtenNotes.slice(0, 2).join(' ');
    afterText = combinedNotes;
    if (needInfoTitles.length > 0) {
      afterText += ` I also recognized that I need more concrete information on ${
        needInfoTitles.length
      } key factor${
        needInfoTitles.length > 1 ? 's' : ''
      } before treating my initial assumptions as settled.`;
    }
  } else if (needInfoTitles.length > 0 || lowConfidenceTitles.length > 0) {
    const focusTopics = [
      ...needInfoTitles.map((t) => t.split(' (')[0].toLowerCase()),
      ...lowConfidenceTitles,
    ].slice(0, 3);
    afterText = `I realized I haven't yet verified several premises in my original reasoning—specifically around ${focusTopics.join(
      ', '
    )}—and need more evidence before assuming they will hold true.`;
  } else {
    afterText =
      'Having stepped through these blind spots, I can now separate the parts of my reasoning backed by direct evidence from the assumptions I still need to test.';
  }

  return {
    afterText,
    openNeeds: needInfoTitles.slice(0, 4),
  };
}

export const PhaseThreeReflectStage: React.FC<PhaseThreeReflectStageProps> = ({
  session,
  onUpdateBlindSpotProgress,
  onSynthesizeReflections,
  onBackToMirror,
  onContinueToStressTest,
  isSynthesizing = false,
}) => {
  const mirror = session.mirrorAnalysis;

  const flattenedItems = useMemo<FlattenedBlindSpot[]>(() => {
    if (!mirror) return [];
    const list: FlattenedBlindSpot[] = [];
    let counter = 1;

    mirror.assumptions.forEach((a, idx) => {
      list.push({
        id: `assumptions-${idx}`,
        queueNumber: counter++,
        category: 'assumptions',
        categoryLabel: 'ASSUMPTION',
        title: a.title,
        description: a.description,
        question: a.question,
      });
    });

    mirror.missingFactors.forEach((m, idx) => {
      list.push({
        id: `missingFactors-${idx}`,
        queueNumber: counter++,
        category: 'missingFactors',
        categoryLabel: 'MISSING FACTOR',
        title: m.title,
        description: m.description,
        question: m.question,
      });
    });

    mirror.perspectives.forEach((p, idx) => {
      list.push({
        id: `perspectives-${idx}`,
        queueNumber: counter++,
        category: 'perspectives',
        categoryLabel: 'PERSPECTIVE',
        title: p.perspective,
        description: p.description,
        question: p.question,
      });
    });

    mirror.evidenceGaps.forEach((e, idx) => {
      list.push({
        id: `evidenceGaps-${idx}`,
        queueNumber: counter++,
        category: 'evidenceGaps',
        categoryLabel: 'EVIDENCE',
        title: e.claim,
        description:
          'Claim treated as established in your initial reasoning without supporting verification.',
        question: e.question,
      });
    });

    return list;
  }, [mirror]);

  const progressMap: Record<string, BlindSpotItemProgress> = useMemo(() => {
    if (!mirror) return {};
    return session.blindSpotProgress ?? buildInitialBlindSpotProgress(mirror);
  }, [mirror, session.blindSpotProgress]);

  const [activeIndex, setActiveIndex] = useState<number>(0);

  if (!mirror || flattenedItems.length === 0) {
    return (
      <div className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10">
        <EmptyState
          icon={Compass}
          title="Complete Phase 02 Mirror first"
          description="Generate your Blind Spot Map in Phase 02 before entering the guided Reflection exercise."
          actionLabel="← Go to 02 Mirror"
          onAction={onBackToMirror}
        />
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(0, activeIndex), flattenedItems.length - 1);
  const currentItem = flattenedItems[safeIndex];

  // Compute exact state counts for secondary reflection progress
  const totalCount = flattenedItems.length;
  let addressedCount = 0;
  let uncertainCount = 0;
  let remainingCount = 0;
  let exploredTotalCount = 0;

  for (const item of flattenedItems) {
    const p = progressMap[item.id];
    const isAddr = p?.state === 'ADDRESSED';
    const isNeed = Boolean(p?.needsMoreInfo) || p?.state === 'NEEDS_INFO';
    const isSkip = Boolean(p?.skipped) || p?.state === 'SKIPPED';
    const isLowConf = p?.confidence != null && p.confidence <= 2;
    const hasActivity =
      isAddr ||
      isNeed ||
      isSkip ||
      Boolean(p?.explored) ||
      (p?.response?.trim().length ?? 0) > 0 ||
      p?.confidence != null;

    if (hasActivity) {
      exploredTotalCount += 1;
    }

    if (isAddr) {
      addressedCount += 1;
    } else if (isNeed || isLowConf || hasActivity) {
      uncertainCount += 1;
    } else {
      remainingCount += 1;
    }
  }

  const exploredPct =
    totalCount > 0 ? Math.round((exploredTotalCount / totalCount) * 100) : 0;

  const handleUpdateItem = (
    id: string,
    updates: Partial<BlindSpotItemProgress>,
    advanceToNext = false
  ) => {
    const existing = progressMap[id];
    if (!existing) return;

    const nextMap: Record<string, BlindSpotItemProgress> = {
      ...progressMap,
      [id]: {
        ...existing,
        ...updates,
      },
    };

    onUpdateBlindSpotProgress(nextMap);

    if (advanceToNext && safeIndex < flattenedItems.length - 1) {
      setActiveIndex(safeIndex + 1);
    }
  };

  // Unlock Reflection Summary after exploring 2+ items
  const hasExploredEnough =
    exploredTotalCount >= 2 || Boolean(session.reflectionSynthesis);

  const localBeforeReasons = useMemo(
    () => buildLocalBeforeReasons(session.reasoning),
    [session.reasoning]
  );

  const localAfterPreview = useMemo(
    () => buildLocalAfterSummary(flattenedItems, progressMap),
    [flattenedItems, progressMap]
  );

  const activeSynthesis: ReflectionSynthesis | null =
    session.reflectionSynthesis ?? null;

  const handleTriggerSynthesis = async () => {
    const requestItems: ReflectionSynthesisRequestItem[] = flattenedItems.map(
      (item) => {
        const p = progressMap[item.id];
        return {
          id: item.id,
          category: item.categoryLabel,
          title: item.title,
          description: item.description,
          question: item.question,
          state: p?.state ?? 'OPEN',
          response: p?.response ?? '',
          confidence: p?.confidence ?? null,
          needsMoreInfo: Boolean(p?.needsMoreInfo),
        };
      }
    );

    await onSynthesizeReflections(requestItems);
  };

  const currentProgress: BlindSpotItemProgress = progressMap[currentItem.id] ?? {
    id: currentItem.id,
    category: currentItem.category,
    index: 0,
    explored: false,
    thinkingOpen: false,
    state: 'OPEN',
    response: '',
    confidence: null,
    needsMoreInfo: false,
    skipped: false,
  };

  return (
    <div className="animate-stage-enter mx-auto max-w-4xl space-y-8">
      {/* Intimate Phase 03 Header + Compact Secondary Progress */}
      <section className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase">
                03 REFLECT
              </span>
              <span className="text-[#D9DDD8]" aria-hidden="true">
                ·
              </span>
              <span className="font-medium tracking-[0.01em] text-[#687572]">
                Challenge your thinking
              </span>
            </div>
            <h1
              className="mt-2 font-editorial text-3xl sm:text-4xl text-[#172A2A] leading-[1.15]"
              style={{ textWrap: 'balance' }}
            >
              Don&apos;t try to find the right answer. Try to find what you haven&apos;t
              examined yet.
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToMirror}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xs border border-[#D9DDD8] bg-white px-3 py-1.5 text-xs font-medium text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>The Mirror</span>
            </button>

            <button
              type="button"
              onClick={onContinueToStressTest}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xs border border-[#172A2A] bg-[#172A2A] px-3.5 py-1.5 text-xs font-semibold tracking-[0.01em] text-white hover:bg-[#243B3B] transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Stress Test</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Secondary Compact Visual Progress Indicator */}
        <div className="mt-6 pt-5 border-t border-[#D9DDD8] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
            <span className="font-semibold text-[#172A2A]">
              {exploredTotalCount} / {totalCount} explored
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[#687572]">
              <span>{addressedCount} addressed</span>
              <span aria-hidden="true">·</span>
              <span>{uncertainCount} uncertain</span>
              <span aria-hidden="true">·</span>
              <span>{remainingCount} remaining</span>
            </div>
          </div>

          {/* Thin Progress Line */}
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[#E3ECE8]"
            role="progressbar"
            aria-valuenow={exploredTotalCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label="Reflection progress"
          >
            <div
              style={{ width: `${exploredPct}%` }}
              className="h-full bg-[#6F8F86] transition-all duration-300"
            />
          </div>

          {/* Subtle Step Selector Strip */}
          <div
            role="tablist"
            aria-label="Select blind spot item"
            className="pt-2 flex flex-wrap items-center gap-1.5"
          >
            {flattenedItems.map((item, idx) => {
              const p = progressMap[item.id];
              const isCurrent = idx === safeIndex;
              const isAddr = p?.state === 'ADDRESSED';
              const isNeed =
                Boolean(p?.needsMoreInfo) || p?.state === 'NEEDS_INFO';
              const isEngaged =
                isAddr ||
                isNeed ||
                Boolean(p?.skipped) ||
                (p?.response?.trim().length ?? 0) > 0 ||
                p?.confidence != null;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  aria-label={`Blind spot ${item.queueNumber}: ${item.title}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative inline-flex h-7 min-w-[32px] items-center justify-center rounded-2xs px-2 font-mono-tabular text-[11px] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                    isCurrent
                      ? 'bg-[#172A2A] text-white font-semibold'
                      : isAddr
                      ? 'border border-[#6F8F86]/40 bg-[#E3ECE8] text-[#172A2A] font-medium hover:border-[#6F8F86]'
                      : isNeed
                      ? 'border border-[#6F8F86] bg-white text-[#172A2A] font-semibold'
                      : isEngaged
                      ? 'border border-[#6F8F86]/60 bg-[#E3ECE8]/45 text-[#172A2A] font-medium'
                      : 'border border-[#D9DDD8] bg-[#F7F5F0] text-[#687572] hover:border-[#6F8F86] hover:text-[#172A2A]'
                  }`}
                >
                  <span>{String(item.queueNumber).padStart(2, '0')}</span>
                  {isNeed && !isCurrent && (
                    <span
                      aria-hidden="true"
                      className="ml-1 h-1.5 w-1.5 rounded-full bg-[#C58B68]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Focused Single-Item Reflection Stage */}
      <ReflectionCard
        key={currentItem.id}
        id={currentItem.id}
        queueNumber={currentItem.queueNumber}
        totalInQueue={flattenedItems.length}
        categoryLabel={currentItem.categoryLabel}
        blindSpotTitle={currentItem.title}
        blindSpotDescription={currentItem.description}
        question={currentItem.question}
        progress={currentProgress}
        isExpanded={true}
        onToggleExpand={() => {}}
        onUpdateItem={handleUpdateItem}
        onPrev={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
        onNext={() =>
          setActiveIndex((prev) => Math.min(flattenedItems.length - 1, prev + 1))
        }
        hasPrev={safeIndex > 0}
        hasNext={safeIndex < flattenedItems.length - 1}
      />

      {/* Reflection Summary: Before vs. After reflection */}
      <section
        aria-labelledby="heading-reflection-summary"
        className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10 shadow-2xs"
      >
        {!hasExploredEnough ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium tracking-[0.02em] text-[#6F8F86]">
                Reflection synthesis
              </span>
              <h2
                id="heading-reflection-summary"
                className="mt-1 font-editorial text-2xl text-[#172A2A]"
              >
                Examine at least 2 blind spots to unlock your Before / After reflection
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#687572]">
                Write a note, rate your confidence, or flag &ldquo;I need more information&rdquo; on at least two items above.
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-semibold text-[#687572] shrink-0">
              {exploredTotalCount} / 2 explored
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#D9DDD8] pb-6">
              <div>
                <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
                  Reflection summary
                </span>
                <h2
                  id="heading-reflection-summary"
                  className="mt-1.5 font-editorial text-3xl sm:text-4xl text-[#172A2A]"
                >
                  Your reasoning has changed.
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#687572]">
                  Synthesized directly from the blind spots you examined and the uncertainties you flagged.
                </p>
              </div>

              <button
                type="button"
                disabled={isSynthesizing}
                onClick={handleTriggerSynthesis}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xs border border-[#172A2A] bg-[#172A2A] px-4 py-2 text-xs font-semibold tracking-[0.01em] text-white hover:bg-[#243B3B] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {activeSynthesis
                        ? 'Refresh synthesis'
                        : 'Synthesize reflection'}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Before */}
              <div className="rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-6">
                <span className="text-xs font-semibold tracking-[0.02em] text-[#687572]">
                  Before
                </span>
                <p className="mt-1.5 text-xs font-medium text-[#687572]">
                  The main premises you started with:
                </p>
                <ul className="mt-3 space-y-2 text-sm text-[#172A2A]">
                  {(activeSynthesis?.beforeReasons ?? localBeforeReasons).map(
                    (reason, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="text-[#6F8F86] select-none">•</span>
                        <span>{reason}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              {/* After reflection */}
              <div className="rounded-xs border border-[#6F8F86] bg-[#E3ECE8]/35 p-6">
                <span className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
                  After reflection
                </span>
                <p className="mt-3 font-editorial text-xl sm:text-2xl text-[#172A2A] leading-relaxed">
                  &ldquo;
                  {activeSynthesis?.afterSynthesis ?? localAfterPreview.afterText}
                  &rdquo;
                </p>

                {activeSynthesis && activeSynthesis.keyShifts.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#D9DDD8] space-y-2">
                    <span className="block text-xs font-semibold tracking-[0.01em] text-[#687572]">
                      Key shifts
                    </span>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-[#172A2A]">
                      {activeSynthesis.keyShifts.map((shift, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check
                            className="h-3.5 w-3.5 text-[#6F8F86] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{shift}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#D9DDD8] pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-[#687572]">
                Continue to Phase 04 to stress-test your evolved reasoning and record your own conclusion.
              </p>
              <button
                type="button"
                onClick={onContinueToStressTest}
                className="group inline-flex min-h-[46px] items-center justify-center gap-3 rounded-xs border border-[#172A2A] bg-[#172A2A] px-6 py-3 text-sm font-semibold tracking-[0.01em] text-white hover:bg-[#243B3B] transition-all duration-150 whitespace-nowrap cursor-pointer"
              >
                <span>Proceed to Stress Test</span>
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
