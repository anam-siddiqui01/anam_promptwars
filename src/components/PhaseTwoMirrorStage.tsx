import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  BlindSpotCategory,
  BlindSpotItemProgress,
  DecisionSession,
} from '../types/decision';
import { buildInitialBlindSpotProgress } from '../services/sessionStorage';
import { BlindSpotMap } from './BlindSpotMap';
import { BlindSpotCard } from './BlindSpotCard';
import { EmptyState } from './EmptyState';

export interface PhaseTwoMirrorStageProps {
  session: DecisionSession;
  onUpdateBlindSpotProgress: (
    updatedProgress: Record<string, BlindSpotItemProgress>
  ) => void;
  onReanalyze: () => void;
  onEditFrame: () => void;
  onContinueToReflect: () => void;
  isReanalyzing?: boolean;
}

export const PhaseTwoMirrorStage: React.FC<PhaseTwoMirrorStageProps> = ({
  session,
  onUpdateBlindSpotProgress,
  onReanalyze,
  onEditFrame,
  onContinueToReflect,
  isReanalyzing = false,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<
    BlindSpotCategory | 'ALL'
  >('ALL');
  const [showOriginalReasoning, setShowOriginalReasoning] = useState(false);

  const mirror = session.mirrorAnalysis;

  if (!mirror) {
    return (
      <div className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10">
        <EmptyState
          icon={Compass}
          title="Mirror analysis not yet generated for this session"
          description="Run the Mirror analysis on your framed reasoning to surface unstated assumptions, missing factors, perspectives, and evidence gaps."
          actionLabel="Generate Blind Spot Map →"
          onAction={onReanalyze}
        />
      </div>
    );
  }

  const progressMap: Record<string, BlindSpotItemProgress> =
    session.blindSpotProgress ?? buildInitialBlindSpotProgress(mirror);

  const getItemProgress = (
    category: BlindSpotCategory,
    index: number
  ): BlindSpotItemProgress => {
    const id = `${category}-${index}`;
    return (
      progressMap[id] ?? {
        id,
        category,
        index,
        explored: false,
        thinkingOpen: false,
        state: 'OPEN',
        response: '',
      }
    );
  };

  const handleExploreToggle = (id: string, expand: boolean) => {
    const existing = progressMap[id];
    if (!existing) return;

    const updated: Record<string, BlindSpotItemProgress> = {
      ...progressMap,
      [id]: {
        ...existing,
        explored: expand,
      },
    };
    setSelectedNodeId(expand ? id : null);
    onUpdateBlindSpotProgress(updated);
  };

  const handleSelectThinkAboutIt = (id: string) => {
    const existing = progressMap[id];
    if (!existing) return;

    const updated: Record<string, BlindSpotItemProgress> = {
      ...progressMap,
      [id]: {
        ...existing,
        explored: true,
        thinkingOpen: true,
      },
    };
    setSelectedNodeId(id);
    onUpdateBlindSpotProgress(updated);
  };

  const handleChangeResponse = (id: string, responseText: string) => {
    const existing = progressMap[id];
    if (!existing) return;

    const hasWrittenAnswer = responseText.trim().length > 0;
    let nextState = existing.state;
    if (existing.state !== 'ADDRESSED') {
      nextState = hasWrittenAnswer ? 'THINKING' : 'OPEN';
    }

    const updated: Record<string, BlindSpotItemProgress> = {
      ...progressMap,
      [id]: {
        ...existing,
        explored: true,
        thinkingOpen: true,
        response: responseText,
        state: nextState,
      },
    };
    onUpdateBlindSpotProgress(updated);
  };

  const handleMarkAddressed = (id: string, addressed: boolean) => {
    const existing = progressMap[id];
    if (!existing) return;

    const fallbackState =
      existing.response.trim().length > 0 ? 'THINKING' : 'OPEN';

    const updated: Record<string, BlindSpotItemProgress> = {
      ...progressMap,
      [id]: {
        ...existing,
        explored: true,
        state: addressed ? 'ADDRESSED' : fallbackState,
      },
    };
    setSelectedNodeId(id);
    onUpdateBlindSpotProgress(updated);
  };

  const handleSelectNodeFromMap = (id: string, category: BlindSpotCategory) => {
    const existing = progressMap[id];
    if (existing && !existing.explored) {
      const updated: Record<string, BlindSpotItemProgress> = {
        ...progressMap,
        [id]: {
          ...existing,
          explored: true,
        },
      };
      onUpdateBlindSpotProgress(updated);
    }

    setSelectedNodeId(id);
    if (
      activeCategoryFilter !== 'ALL' &&
      activeCategoryFilter !== category
    ) {
      setActiveCategoryFilter('ALL');
    }

    window.setTimeout(() => {
      const cardEl = document.getElementById(`card-${id}`);
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
  };

  const allProgressItems = Object.values(progressMap);
  const totalBlindSpots = allProgressItems.length;
  const exploredCount = allProgressItems.filter((p) => p.explored).length;
  const thinkingCount = allProgressItems.filter(
    (p) => p.state === 'THINKING'
  ).length;
  const addressedCount = allProgressItems.filter(
    (p) => p.state === 'ADDRESSED'
  ).length;

  const primaryAssumption = mirror.assumptions[0];
  const secondaryAssumptions = mirror.assumptions.slice(1);

  const primaryMissingFactor = mirror.missingFactors[0];
  const secondaryMissingFactors = mirror.missingFactors.slice(1);

  const showCategory = (category: BlindSpotCategory) =>
    activeCategoryFilter === 'ALL' || activeCategoryFilter === category;

  return (
    <div className="animate-stage-enter space-y-10">
      {/* Phase 02 Header + Core Conceptual Anchor */}
      <section className="border border-[#D9DDD8] bg-white rounded-xs overflow-hidden shadow-2xs">
        <div className="bg-[#172A2A] text-white px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#E3ECE8] uppercase">
                  02 MIRROR
                </span>
                <span className="text-[#6F8F86]" aria-hidden="true">
                  —
                </span>
                <span className="font-medium tracking-[0.01em] text-[#E3ECE8]/90">
                  Your reasoning, viewed from four angles.
                </span>
              </div>
              <h1
                className="mt-2.5 font-editorial text-3xl sm:text-5xl text-white leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Here&apos;s what your reasoning may be missing.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-[#E3ECE8]/85 leading-relaxed">
                Nothing below tells you what to choose. Instead, your reasoning is
                examined across four structural lenses so you can discover how your
                argument is constructed.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onEditFrame}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xs border border-[#6F8F86]/45 bg-[#243B3B] px-3.5 py-2 text-xs font-medium text-[#E3ECE8] hover:bg-[#2F4B4B] hover:text-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3ECE8]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Edit frame</span>
              </button>

              <button
                type="button"
                disabled={isReanalyzing}
                onClick={onReanalyze}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xs border border-[#6F8F86]/45 bg-[#243B3B] px-3.5 py-2 text-xs font-medium text-[#E3ECE8] hover:bg-[#2F4B4B] hover:text-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3ECE8] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isReanalyzing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Re-examine</span>
              </button>

              <button
                type="button"
                onClick={onContinueToReflect}
                className="group inline-flex min-h-[38px] items-center gap-2 rounded-xs bg-white px-4 py-2 text-xs font-semibold tracking-[0.01em] text-[#172A2A] hover:bg-[#E3ECE8] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3ECE8]"
              >
                <span>Continue to Reflect</span>
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {/* Compact Conceptual Lens Strip: YOUR REASONING -> Assumptions · Missing Factors · Evidence · Perspectives */}
          <div className="mt-7 pt-6 border-t border-[#6F8F86]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs">
              <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.12em] text-white uppercase">
                YOUR REASONING
              </span>
              <span className="hidden sm:inline text-[#6F8F86]" aria-hidden="true">
                →
              </span>
              <span className="sm:hidden text-[#6F8F86]" aria-hidden="true">
                ↓
              </span>
              <span className="text-[#E3ECE8] font-medium">
                Assumptions · Missing Factors · Evidence · Perspectives
              </span>
            </div>
            <span className="text-xs text-[#E3ECE8]/75">
              Select any angle below to examine it in place
            </span>
          </div>
        </div>

        {/* Framed Decision Context Bar */}
        <div className="px-6 py-4 sm:px-10 bg-[#F7F5F0] border-t border-[#D9DDD8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-xs font-medium tracking-[0.01em] text-[#687572]">
              My reasoning on:
            </span>
            <p className="text-sm sm:text-base font-semibold text-[#172A2A]">
              {session.decision}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowOriginalReasoning((prev) => !prev)}
            aria-expanded={showOriginalReasoning}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#687572] hover:text-[#172A2A] whitespace-nowrap cursor-pointer self-start sm:self-center"
          >
            <span>
              {showOriginalReasoning
                ? 'Hide your stated reasoning'
                : 'Read your stated reasoning'}
            </span>
            {showOriginalReasoning ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {showOriginalReasoning && (
          <div className="px-6 py-4 sm:px-10 border-t border-[#D9DDD8] bg-white">
            <p className="text-xs sm:text-sm leading-relaxed text-[#172A2A] whitespace-pre-wrap">
              &ldquo;{session.reasoning}&rdquo;
            </p>
            {session.context.length > 0 && (
              <p className="mt-2.5 pt-2.5 border-t border-[#D9DDD8] text-xs text-[#687572]">
                Context: {session.context.join(' · ')}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Signature Visual: Your Blind Spot Map */}
      <BlindSpotMap
        mirror={mirror}
        progress={progressMap}
        selectedNodeId={selectedNodeId}
        activeCategoryFilter={activeCategoryFilter}
        onSelectNode={handleSelectNodeFromMap}
        onSelectCategoryFilter={setActiveCategoryFilter}
      />

      {/* Conceptual Journey: 4 Angles of Inquiry */}
      <div className="space-y-12">
        {/* ANGLE 1: ASSUMPTIONS */}
        {showCategory('assumptions') && (
          <section aria-labelledby="heading-assumptions" className="space-y-5">
            <div className="border-b border-[#D9DDD8] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2
                  id="heading-assumptions"
                  className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase"
                >
                  ASSUMPTIONS
                </h2>
                <p className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]">
                  What might you be taking for granted?
                </p>
                <p className="mt-1 text-xs sm:text-sm text-[#687572]">
                  Connections your reasoning makes without explicitly verifying them.
                </p>
              </div>
              <span className="font-mono-tabular text-xs text-[#687572] shrink-0">
                {mirror.assumptions.length} surfaced
              </span>
            </div>

            {/* Asymmetric Hierarchy: Primary Blind Spot (dominant) + Secondary Blind Spots (compact) */}
            {primaryAssumption && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div
                  className={
                    secondaryAssumptions.length > 0
                      ? 'lg:col-span-7'
                      : 'lg:col-span-12'
                  }
                >
                  <BlindSpotCard
                    id="assumptions-0"
                    categoryLabel="ASSUMPTION"
                    examineLabel="Examine assumption"
                    title={primaryAssumption.title}
                    description={primaryAssumption.description}
                    question={primaryAssumption.question}
                    progress={getItemProgress('assumptions', 0)}
                    isPrimary={true}
                    isHighlighted={selectedNodeId === 'assumptions-0'}
                    onExploreToggle={handleExploreToggle}
                    onSelectThinkAboutIt={handleSelectThinkAboutIt}
                    onChangeResponse={handleChangeResponse}
                    onMarkAddressed={handleMarkAddressed}
                  />
                </div>

                {secondaryAssumptions.length > 0 && (
                  <div className="lg:col-span-5 space-y-4">
                    {secondaryAssumptions.map((item, offsetIdx) => {
                      const idx = offsetIdx + 1;
                      const id = `assumptions-${idx}`;
                      return (
                        <BlindSpotCard
                          key={id}
                          id={id}
                          categoryLabel="ASSUMPTION"
                          examineLabel="Examine assumption"
                          title={item.title}
                          description={item.description}
                          question={item.question}
                          progress={getItemProgress('assumptions', idx)}
                          isPrimary={false}
                          isHighlighted={selectedNodeId === id}
                          onExploreToggle={handleExploreToggle}
                          onSelectThinkAboutIt={handleSelectThinkAboutIt}
                          onChangeResponse={handleChangeResponse}
                          onMarkAddressed={handleMarkAddressed}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ANGLE 2: MISSING FACTORS */}
        {showCategory('missingFactors') && (
          <section aria-labelledby="heading-missing-factors" className="space-y-5">
            <div className="border-b border-[#D9DDD8] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2
                  id="heading-missing-factors"
                  className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase"
                >
                  MISSING FACTORS
                </h2>
                <p className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]">
                  What isn&apos;t represented in your reasoning yet?
                </p>
                <p className="mt-1 text-xs sm:text-sm text-[#687572]">
                  Practical variables outside your current frame that could change how this decision plays out.
                </p>
              </div>
              <span className="font-mono-tabular text-xs text-[#687572] shrink-0">
                {mirror.missingFactors.length} surfaced
              </span>
            </div>

            {primaryMissingFactor && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div
                  className={
                    secondaryMissingFactors.length > 0
                      ? 'lg:col-span-7'
                      : 'lg:col-span-12'
                  }
                >
                  <BlindSpotCard
                    id="missingFactors-0"
                    categoryLabel="MISSING FACTOR"
                    examineLabel="Examine factor"
                    title={primaryMissingFactor.title}
                    description={primaryMissingFactor.description}
                    question={primaryMissingFactor.question}
                    progress={getItemProgress('missingFactors', 0)}
                    isPrimary={true}
                    isHighlighted={selectedNodeId === 'missingFactors-0'}
                    onExploreToggle={handleExploreToggle}
                    onSelectThinkAboutIt={handleSelectThinkAboutIt}
                    onChangeResponse={handleChangeResponse}
                    onMarkAddressed={handleMarkAddressed}
                  />
                </div>

                {secondaryMissingFactors.length > 0 && (
                  <div className="lg:col-span-5 space-y-4">
                    {secondaryMissingFactors.map((item, offsetIdx) => {
                      const idx = offsetIdx + 1;
                      const id = `missingFactors-${idx}`;
                      return (
                        <BlindSpotCard
                          key={id}
                          id={id}
                          categoryLabel="MISSING FACTOR"
                          examineLabel="Examine factor"
                          title={item.title}
                          description={item.description}
                          question={item.question}
                          progress={getItemProgress('missingFactors', idx)}
                          isPrimary={false}
                          isHighlighted={selectedNodeId === id}
                          onExploreToggle={handleExploreToggle}
                          onSelectThinkAboutIt={handleSelectThinkAboutIt}
                          onChangeResponse={handleChangeResponse}
                          onMarkAddressed={handleMarkAddressed}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ANGLES 3 & 4: EVIDENCE & PERSPECTIVES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {showCategory('evidenceGaps') && (
            <section aria-labelledby="heading-evidence-gaps" className="space-y-5">
              <div className="border-b border-[#D9DDD8] pb-4 flex items-end justify-between gap-2">
                <div>
                  <h2
                    id="heading-evidence-gaps"
                    className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase"
                  >
                    EVIDENCE
                  </h2>
                  <p className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]">
                    What evidence are you relying on?
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-[#687572]">
                    Claims treated as settled in your reasoning without direct verification.
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[#687572] shrink-0">
                  {mirror.evidenceGaps.length} surfaced
                </span>
              </div>

              <div className="space-y-4">
                {mirror.evidenceGaps.map((item, idx) => {
                  const id = `evidenceGaps-${idx}`;
                  return (
                    <BlindSpotCard
                      key={id}
                      id={id}
                      categoryLabel="EVIDENCE"
                      examineLabel="Examine evidence"
                      title={item.claim}
                      description="This claim is currently treated as settled in your reasoning without supporting verification."
                      question={item.question}
                      progress={getItemProgress('evidenceGaps', idx)}
                      isPrimary={idx === 0}
                      isHighlighted={selectedNodeId === id}
                      onExploreToggle={handleExploreToggle}
                      onSelectThinkAboutIt={handleSelectThinkAboutIt}
                      onChangeResponse={handleChangeResponse}
                      onMarkAddressed={handleMarkAddressed}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {showCategory('perspectives') && (
            <section aria-labelledby="heading-perspectives" className="space-y-5">
              <div className="border-b border-[#D9DDD8] pb-4 flex items-end justify-between gap-2">
                <div>
                  <h2
                    id="heading-perspectives"
                    className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase"
                  >
                    PERSPECTIVES
                  </h2>
                  <p className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]">
                    Whose perspective isn&apos;t represented?
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-[#687572]">
                    Vantage points beyond your immediate frame that weigh the stakes differently.
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[#687572] shrink-0">
                  {mirror.perspectives.length} surfaced
                </span>
              </div>

              <div className="space-y-4">
                {mirror.perspectives.map((item, idx) => {
                  const id = `perspectives-${idx}`;
                  return (
                    <BlindSpotCard
                      key={id}
                      id={id}
                      categoryLabel="PERSPECTIVE"
                      examineLabel="Examine perspective"
                      title={item.perspective}
                      description={item.description}
                      question={item.question}
                      progress={getItemProgress('perspectives', idx)}
                      isPrimary={idx === 0}
                      isHighlighted={selectedNodeId === id}
                      onExploreToggle={handleExploreToggle}
                      onSelectThinkAboutIt={handleSelectThinkAboutIt}
                      onChangeResponse={handleChangeResponse}
                      onMarkAddressed={handleMarkAddressed}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Overarching Probing Questions: "What do I want to examine further?" */}
      {mirror.probes.length > 0 && (
        <div className="space-y-4">
          <div
            className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-[#687572]"
            aria-hidden="true"
          >
            <ArrowDown className="h-4 w-4 text-[#6F8F86]" />
            <span>What do I want to examine further?</span>
          </div>

          <section
            aria-labelledby="heading-probes"
            className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-8"
          >
            <div className="flex items-center justify-between border-b border-[#D9DDD8] pb-4">
              <div>
                <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
                  Further inquiry
                </span>
                <h2
                  id="heading-probes"
                  className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]"
                >
                  Questions to sit with before deciding
                </h2>
              </div>
              <HelpCircle className="h-4 w-4 text-[#6F8F86]" aria-hidden="true" />
            </div>

            <ol className="mt-5 divide-y divide-[#D9DDD8]">
              {mirror.probes.map((probe, idx) => (
                <li
                  key={idx}
                  className="py-4 first:pt-0 last:pb-0 flex items-start gap-4"
                >
                  <span className="font-mono-tabular text-xs font-semibold text-[#6F8F86] mt-1">
                    0{idx + 1}
                  </span>
                  <p className="font-editorial text-xl sm:text-2xl text-[#172A2A] leading-snug">
                    &ldquo;{probe}&rdquo;
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {/* Phase 2 Footer Transition to Phase 03: Reflect */}
      <section className="border border-[#172A2A] bg-[#172A2A] text-white rounded-xs p-6 sm:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-xs text-[#E3ECE8]">
              <span>Mirror summary</span>
              <span aria-hidden="true">·</span>
              <span>
                {exploredCount}/{totalBlindSpots} examined · {thinkingCount} in reflection ·{' '}
                {addressedCount} addressed
              </span>
            </div>
            <h3 className="font-editorial text-2xl sm:text-3xl text-white">
              You didn&apos;t get an answer. You discovered how your reasoning is constructed.
            </h3>
            <p className="text-xs sm:text-sm text-[#E3ECE8]/85 leading-relaxed">
              Next, step into Phase 03: Reflect to challenge the blind spots that matter
              most to your decision.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onContinueToReflect}
              className="group inline-flex min-h-[46px] items-center gap-3 rounded-xs bg-white px-6 py-3 text-sm font-semibold tracking-[0.01em] text-[#172A2A] hover:bg-[#E3ECE8] transition-all duration-150 whitespace-nowrap cursor-pointer"
            >
              <span>Challenge your thinking</span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
