import React, { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Compass,
  HelpCircle,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  BlindSpotItemProgress,
  DecisionSession,
  DecisionStance,
  StressTestRecord,
} from '../types/decision';
import { buildInitialBlindSpotProgress } from '../services/sessionStorage';
import {
  computeReflectionMetrics,
  ensureInquiryQuestionFormat,
} from '../utils/mirrorLogic';
import { EmptyState } from './EmptyState';
import { PrimaryButton } from './PrimaryButton';

export interface PhaseFourStressTestStageProps {
  session: DecisionSession;
  onUpdateStressTest: (stressTest: StressTestRecord) => void;
  onBackToReflect: () => void;
  onStartNewDecision: () => void;
}

const STANCE_OPTIONS: Array<{
  value: DecisionStance;
  label: string;
}> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'less_certain', label: "I'm less certain" },
  { value: 'need_more_info', label: 'I need more information' },
];

export const PhaseFourStressTestStage: React.FC<
  PhaseFourStressTestStageProps
> = ({
  session,
  onUpdateStressTest,
  onBackToReflect,
  onStartNewDecision,
}) => {
  const decisionTextareaId = useId();
  const stanceGroupId = useId();
  const errorId = useId();

  const mirror = session.mirrorAnalysis;

  const currentStressTest: StressTestRecord = session.stressTest ?? {
    stance: null,
    finalConclusion: '',
    completedAt: null,
  };

  const [isViewingCompletionScreen, setIsViewingCompletionScreen] = useState(
    Boolean(currentStressTest.completedAt)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const progressMap: Record<string, BlindSpotItemProgress> = useMemo(() => {
    if (!mirror) return {};
    return session.blindSpotProgress ?? buildInitialBlindSpotProgress(mirror);
  }, [mirror, session.blindSpotProgress]);

  const allBlindSpotDescriptors = useMemo(() => {
    if (!mirror) return [];
    const list: Array<{
      id: string;
      categoryLabel: string;
      title: string;
      description: string;
      question: string;
    }> = [];

    mirror.assumptions.forEach((a, idx) => {
      list.push({
        id: `assumptions-${idx}`,
        categoryLabel: 'ASSUMPTION',
        title: a.title,
        description: a.description,
        question: a.question,
      });
    });
    mirror.missingFactors.forEach((m, idx) => {
      list.push({
        id: `missingFactors-${idx}`,
        categoryLabel: 'MISSING FACTOR',
        title: m.title,
        description: m.description,
        question: m.question,
      });
    });
    mirror.perspectives.forEach((p, idx) => {
      list.push({
        id: `perspectives-${idx}`,
        categoryLabel: 'PERSPECTIVE',
        title: p.perspective,
        description: p.description,
        question: p.question,
      });
    });
    mirror.evidenceGaps.forEach((e, idx) => {
      list.push({
        id: `evidenceGaps-${idx}`,
        categoryLabel: 'EVIDENCE',
        title: e.claim,
        description: 'Unverified premise in initial reasoning',
        question: e.question,
      });
    });
    return list;
  }, [mirror]);

  const metrics = useMemo(
    () =>
      computeReflectionMetrics(
        mirror,
        progressMap,
        session.reflectionSynthesis,
        currentStressTest.finalConclusion
      ),
    [
      mirror,
      progressMap,
      session.reflectionSynthesis,
      currentStressTest.finalConclusion,
    ]
  );

  // 1. "What you originally focused on" & Before summary
  const originalFocusItems = useMemo(() => {
    if (
      session.reflectionSynthesis?.beforeReasons &&
      session.reflectionSynthesis.beforeReasons.length > 0
    ) {
      return session.reflectionSynthesis.beforeReasons;
    }
    const clauses = session.reasoning
      .split(/(?:[.;?!]|\b(?:because|since|and|however|though|while)\b)/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);
    return clauses.length > 0 ? clauses.slice(0, 4) : [session.reasoning.trim()];
  }, [session.reasoning, session.reflectionSynthesis]);

  const beforeCompactLine = useMemo(() => {
    const combined = `${session.decision} ${session.reasoning}`.toLowerCase();
    if (combined.includes('gate') && combined.includes('placement')) {
      return 'GATE could lead to better opportunities, while placements provide immediate experience and financial independence.';
    }
    if (
      session.reflectionSynthesis?.beforeReasons &&
      session.reflectionSynthesis.beforeReasons.length > 0
    ) {
      return session.reflectionSynthesis.beforeReasons.slice(0, 2).join('; ');
    }
    const firstSentence = session.reasoning.split(/(?<=[.?!])\s+/)[0]?.trim();
    return firstSentence && firstSentence.length > 15
      ? firstSentence
      : originalFocusItems.slice(0, 2).join(' · ');
  }, [
    session.decision,
    session.reasoning,
    session.reflectionSynthesis,
    originalFocusItems,
  ]);

  // 2. "What you explored" & Reflection findings
  const exploredFindings = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      categoryLabel: string;
      userResponse: string;
      statusLabel: string;
    }> = [];

    for (const desc of allBlindSpotDescriptors) {
      const p = progressMap[desc.id];
      if (!p) continue;
      const isEngaged =
        p.explored ||
        p.state !== 'OPEN' ||
        p.response.trim().length > 0 ||
        p.confidence != null ||
        p.needsMoreInfo;

      if (isEngaged) {
        let statusLabel = 'Explored';
        if (p.state === 'ADDRESSED') statusLabel = 'Addressed';
        else if (p.needsMoreInfo || p.state === 'NEEDS_INFO')
          statusLabel = 'Needs more information';
        else if (p.confidence != null && p.confidence <= 2)
          statusLabel = `Low confidence (${p.confidence}/5)`;
        else if (p.state === 'SKIPPED' || p.skipped) statusLabel = 'Skipped';

        items.push({
          id: desc.id,
          title: desc.title,
          categoryLabel: desc.categoryLabel,
          userResponse: p.response.trim(),
          statusLabel,
        });
      }
    }
    return items;
  }, [allBlindSpotDescriptors, progressMap]);

  const reflectionComparisonStatements = useMemo(() => {
    if (session.reflectionSynthesis?.afterSynthesis) {
      return [session.reflectionSynthesis.afterSynthesis];
    }
    const lines: string[] = [];
    for (const desc of allBlindSpotDescriptors) {
      const p = progressMap[desc.id];
      if (!p) continue;
      if (p.response.trim().length > 0) {
        lines.push(p.response.trim());
      } else if (p.needsMoreInfo || p.state === 'NEEDS_INFO') {
        lines.push(`${desc.title} hasn't been verified yet.`);
      } else if (p.confidence != null && p.confidence <= 2) {
        lines.push(`Low confidence around: ${desc.title.toLowerCase()}.`);
      } else if (p.state === 'ADDRESSED') {
        lines.push(`Examined and accounted for: ${desc.title.toLowerCase()}.`);
      }
    }

    if (lines.length === 0) {
      return allBlindSpotDescriptors
        .slice(0, 2)
        .map((d) => `${d.title} was surfaced as an unexamined factor.`);
    }
    return lines.slice(0, 2);
  }, [
    allBlindSpotDescriptors,
    progressMap,
    session.reflectionSynthesis,
  ]);

  // 3. "What remains uncertain"
  const uncertainItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      reason: string;
    }> = [];

    for (const desc of allBlindSpotDescriptors) {
      const p = progressMap[desc.id];
      if (!p) continue;
      if (p.needsMoreInfo || p.state === 'NEEDS_INFO') {
        list.push({
          id: desc.id,
          title: desc.title,
          reason: 'Flagged as needing more information',
        });
      } else if (p.confidence != null && p.confidence <= 2) {
        list.push({
          id: desc.id,
          title: desc.title,
          reason: `Rated ${p.confidence}/5 confidence`,
        });
      } else if (p.state !== 'ADDRESSED') {
        list.push({
          id: desc.id,
          title: desc.title,
          reason: p.explored ? 'Explored but not yet resolved' : 'Not yet examined',
        });
      }
    }
    return list;
  }, [allBlindSpotDescriptors, progressMap]);

  // 4. "Questions worth investigating" (Strictly questions, never recommendations)
  const questionsWorthInvestigating = useMemo(() => {
    const questions: string[] = [];

    for (const desc of allBlindSpotDescriptors) {
      const p = progressMap[desc.id];
      if (
        p?.needsMoreInfo ||
        p?.state === 'NEEDS_INFO' ||
        (p?.confidence != null && p.confidence <= 2) ||
        p?.state !== 'ADDRESSED'
      ) {
        const formatted = ensureInquiryQuestionFormat(desc.question);
        if (formatted && !questions.includes(formatted)) {
          questions.push(formatted);
        }
      }
    }

    if (mirror?.probes) {
      for (const probe of mirror.probes) {
        const formatted = ensureInquiryQuestionFormat(probe);
        if (formatted && !questions.includes(formatted)) {
          questions.push(formatted);
        }
      }
    }

    return questions.slice(0, 5);
  }, [allBlindSpotDescriptors, progressMap, mirror]);

  // Now summary in Before -> Reflection -> Now (never a recommendation; distinct from the bottom Your decision box)
  const nowComparisonStatement = useMemo(() => {
    const combined = `${session.decision} ${session.reasoning}`.toLowerCase();
    const isGateOrPlacement =
      combined.includes('gate') && combined.includes('placement');

    const needInfoTopics = uncertainItems
      .slice(0, 2)
      .map((u) => u.title.toLowerCase());

    if (currentStressTest.stance === 'less_certain') {
      if (isGateOrPlacement) {
        return "I still haven't decided whether GATE or placements should be my main priority, but I now know which assumptions and unanswered questions I need to investigate before making that decision.";
      }
      return needInfoTopics.length > 0
        ? `I am less certain than when I started because key factors like ${needInfoTopics.join(
            ' and '
          )} still need to be investigated before making this decision.`
        : 'I am less certain than when I started after separating my initial assumptions from what I still need to verify.';
    }
    if (currentStressTest.stance === 'need_more_info') {
      return needInfoTopics.length > 0
        ? `Before deciding, I need more concrete information regarding ${needInfoTopics.join(
            ' and '
          )}.`
        : 'I need to gather additional evidence on the open questions before committing to this choice.';
    }
    if (currentStressTest.stance === 'yes') {
      return needInfoTopics.length > 0
        ? `I still lean toward the same decision, while recognizing I need clearer evidence around ${needInfoTopics.join(
            ' and '
          )}.`
        : 'I still lean toward the same decision, now backed by a more complete examination of my assumptions.';
    }
    if (currentStressTest.stance === 'no') {
      return 'Examining the unstated assumptions and missing factors shifted my perspective away from my original leaning.';
    }

    if (currentStressTest.finalConclusion.trim().length > 0) {
      return currentStressTest.finalConclusion.trim();
    }

    return needInfoTopics.length > 0
      ? `My reasoning now accounts for ${exploredFindings.length} examined blind spots and highlights open questions around ${needInfoTopics.join(
          ' and '
        )}.`
      : 'Select your current stance above or write your own decision conclusion below to crystallize where your thinking stands now.';
  }, [
    session.decision,
    session.reasoning,
    currentStressTest.finalConclusion,
    currentStressTest.stance,
    uncertainItems,
    exploredFindings.length,
  ]);

  if (!mirror) {
    return (
      <div className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10">
        <EmptyState
          icon={Compass}
          title="Complete Phases 02 and 03 first"
          description="Examine your blind spots in Phase 02: Mirror and Phase 03: Reflect before running the Phase 04 Reasoning Stress Test."
          actionLabel="← Go to 03 Reflect"
          onAction={onBackToReflect}
        />
      </div>
    );
  }

  const handleSelectStance = (stance: DecisionStance) => {
    if (validationError) setValidationError(null);
    onUpdateStressTest({
      ...currentStressTest,
      stance,
    });
  };

  const handleChangeConclusion = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (validationError) setValidationError(null);
    onUpdateStressTest({
      ...currentStressTest,
      finalConclusion: e.target.value,
    });
  };

  const handleCompleteReflection = () => {
    if (!currentStressTest.stance) {
      setValidationError(
        'Please select a response to "Would you still make the same decision?" before completing your reflection.'
      );
      return;
    }
    if (currentStressTest.finalConclusion.trim().length < 5) {
      setValidationError(
        'Please write your own conclusion in the "Your decision" field before completing.'
      );
      return;
    }

    setValidationError(null);
    const updated: StressTestRecord = {
      ...currentStressTest,
      completedAt: new Date().toISOString(),
    };
    onUpdateStressTest(updated);
    setIsViewingCompletionScreen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const padMetric = (n: number) => String(n).padStart(2, '0');

  // Rewarding, non-gamified final completion screen
  if (isViewingCompletionScreen && currentStressTest.completedAt) {
    return (
      <section
        aria-label="Reflection complete summary"
        className="animate-stage-enter mx-auto max-w-4xl border border-[#D9DDD8] bg-white rounded-xs p-8 sm:p-14 shadow-2xs"
      >
        <div className="border-b border-[#D9DDD8] pb-8">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase">
              04 STRESS TEST
            </span>
            <span className="text-[#D9DDD8]" aria-hidden="true">
              ·
            </span>
            <span className="font-medium text-[#687572]">Recorded</span>
          </div>

          <h1 className="mt-3 font-editorial text-4xl sm:text-6xl text-[#172A2A]">
            Reflection complete.
          </h1>
          <p className="mt-2.5 text-base sm:text-lg text-[#687572] leading-relaxed">
            You&apos;ve examined the reasoning behind your decision.
          </p>
        </div>

        {/* Four Large Editorial Metrics */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-[#D9DDD8] pb-10">
          <div>
            <span className="block font-editorial text-5xl sm:text-6xl text-[#172A2A] leading-none">
              {padMetric(metrics.exploredCount)}
            </span>
            <span className="mt-2 block text-xs font-medium tracking-[0.01em] text-[#687572]">
              Blind spots explored
            </span>
          </div>

          <div className="border-l border-[#D9DDD8] pl-6">
            <span className="block font-editorial text-5xl sm:text-6xl text-[#172A2A] leading-none">
              {padMetric(metrics.addressedCount)}
            </span>
            <span className="mt-2 block text-xs font-medium tracking-[0.01em] text-[#687572]">
              Addressed
            </span>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-[#D9DDD8] pt-4 lg:pt-0 lg:pl-6">
            <span className="block font-editorial text-5xl sm:text-6xl text-[#C58B68] leading-none">
              {padMetric(metrics.stillUncertainCount)}
            </span>
            <span className="mt-2 block text-xs font-medium tracking-[0.01em] text-[#687572]">
              Still uncertain
            </span>
          </div>

          <div className="border-t lg:border-t-0 border-l border-[#D9DDD8] pt-4 lg:pt-0 pl-6">
            <span className="block font-editorial text-5xl sm:text-6xl text-[#6F8F86] leading-none">
              {padMetric(metrics.newConsiderationsCount)}
            </span>
            <span className="mt-2 block text-xs font-medium tracking-[0.01em] text-[#687572]">
              New considerations
            </span>
          </div>
        </div>

        {/* "What you know now" with the user's own reasoning summary */}
        <div className="mt-10 space-y-6">
          <div>
            <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
              What you know now
            </span>
            <h2 className="mt-1 font-editorial text-3xl text-[#172A2A]">
              {session.decision}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-6">
              <span className="text-xs font-semibold tracking-[0.01em] text-[#687572]">
                Where you started (Before)
              </span>
              <p className="mt-2.5 text-sm text-[#172A2A] leading-relaxed">
                &ldquo;{session.reasoning}&rdquo;
              </p>
            </div>

            <div className="rounded-xs border border-[#6F8F86] bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-[0.01em] text-[#172A2A]">
                  Your conclusion (Now)
                </span>
                {currentStressTest.stance && (
                  <span className="text-xs text-[#687572]">
                    Stance:{' '}
                    {
                      STANCE_OPTIONS.find(
                        (o) => o.value === currentStressTest.stance
                      )?.label
                    }
                  </span>
                )}
              </div>
              <p className="mt-3 font-editorial text-2xl text-[#172A2A] leading-snug whitespace-pre-wrap">
                &ldquo;{currentStressTest.finalConclusion}&rdquo;
              </p>
            </div>
          </div>

          {questionsWorthInvestigating.length > 0 && (
            <div className="rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-6">
              <span className="text-xs font-semibold tracking-[0.01em] text-[#172A2A]">
                Open questions to carry forward
              </span>
              <ul className="mt-3 space-y-2 text-xs sm:text-sm text-[#172A2A]">
                {questionsWorthInvestigating.slice(0, 3).map((q, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono-tabular text-xs font-semibold text-[#6F8F86]">
                      Q{idx + 1}
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions: [ Review reflection ] & [ Start another decision ] */}
        <div className="mt-10 border-t border-[#D9DDD8] pt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsViewingCompletionScreen(false)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xs border border-[#D9DDD8] bg-white px-5 py-2.5 text-sm font-semibold tracking-[0.01em] text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Review reflection</span>
          </button>

          <button
            type="button"
            onClick={onStartNewDecision}
            className="inline-flex min-h-[46px] items-center justify-center gap-2.5 rounded-xs border border-[#172A2A] bg-[#172A2A] px-6 py-2.5 text-sm font-semibold tracking-[0.01em] text-white hover:bg-[#243B3B] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Start another decision</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="animate-stage-enter space-y-10">
      {/* Phase 04 Header + Stance Question */}
      <section className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#D9DDD8] pb-6">
          <div>
            <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase">
              04 STRESS TEST
            </span>
            <h1
              className="mt-2 font-editorial text-3xl sm:text-5xl text-[#172A2A] leading-[1.12]"
              style={{ textWrap: 'balance' }}
            >
              Has your reasoning changed?
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-[#687572] leading-relaxed">
              Compare the premises you began with against what you uncovered—then record
              where your thinking stands now.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToReflect}
            className="self-start inline-flex min-h-[38px] items-center gap-1.5 rounded-xs border border-[#D9DDD8] bg-white px-3.5 py-2 text-xs font-medium text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to 03 Reflect</span>
          </button>
        </div>

        {/* User's Original Reasoning */}
        <div className="mt-6 rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-[0.01em] text-[#687572]">
              Your initial reasoning (Phase 01)
            </span>
            <span className="text-xs font-semibold text-[#172A2A]">
              {session.decision}
            </span>
          </div>
          <p className="mt-2.5 text-sm sm:text-base text-[#172A2A] leading-relaxed whitespace-pre-wrap">
            &ldquo;{session.reasoning}&rdquo;
          </p>
        </div>

        {/* Question: "Would you still make the same decision?" (Non-judgmental — never red/green) */}
        <div className="mt-8 pt-6 border-t border-[#D9DDD8]">
          <span
            id={stanceGroupId}
            className="block font-editorial text-2xl sm:text-3xl text-[#172A2A]"
          >
            Would you still make the same decision?
          </span>
          <p className="mt-1 text-xs text-[#687572]">
            No option is labeled right or wrong—this captures your current level of certainty.
          </p>

          <div
            role="radiogroup"
            aria-labelledby={stanceGroupId}
            className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {STANCE_OPTIONS.map((option) => {
              const isSelected = currentStressTest.stance === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectStance(option.value)}
                  className={`flex min-h-[48px] items-center gap-3 rounded-xs border px-4 py-3 text-left text-xs sm:text-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                    isSelected
                      ? 'border-[1.5px] border-[#6F8F86] bg-[#E3ECE8] text-[#172A2A] font-semibold shadow-2xs'
                      : 'border-[#D9DDD8] bg-white text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] font-medium'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? 'border-[#6F8F86] bg-white'
                        : 'border-[#D9DDD8] bg-transparent'
                    }`}
                  >
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-[#172A2A]" />
                    )}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Central Visual: Before → Reflection → Now Transformation */}
      <section
        aria-labelledby="heading-reasoning-comparison"
        className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10 shadow-2xs"
      >
        <div className="border-b border-[#D9DDD8] pb-5">
          <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
            Reasoning transformation
          </span>
          <h2
            id="heading-reasoning-comparison"
            className="mt-1 font-editorial text-2xl sm:text-4xl text-[#172A2A]"
          >
            From initial belief to examined judgment
          </h2>
        </div>

        {/* 3-Stage Connected Transformation Flow */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
          {/* Column 1: Before */}
          <div className="lg:col-span-3 rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
                  Before
                </span>
                <span className="font-mono-tabular text-[11px] text-[#687572]">
                  01
                </span>
              </div>
              <p className="mt-1 text-xs text-[#687572]">
                What you originally believed.
              </p>

              <p className="mt-4 font-editorial text-xl sm:text-2xl text-[#172A2A] leading-snug">
                &ldquo;{beforeCompactLine}&rdquo;
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#D9DDD8] text-xs text-[#687572]">
              Initial visible factors
            </div>
          </div>

          {/* Connector 1 -> 2 */}
          <div
            aria-hidden="true"
            className="lg:col-span-1 flex items-center justify-center py-1 lg:py-0"
          >
            <div className="hidden lg:flex items-center w-full">
              <div className="h-[1.5px] flex-1 bg-[#D9DDD8]" />
              <ArrowRight className="h-4 w-4 text-[#6F8F86] -ml-1 shrink-0" />
            </div>
            <ArrowDown className="lg:hidden h-5 w-5 text-[#6F8F86]" />
          </div>

          {/* Column 2: Reflection */}
          <div className="lg:col-span-3 rounded-xs border border-[#6F8F86] bg-[#E3ECE8]/45 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
                  Reflection
                </span>
                <span className="font-mono-tabular text-[11px] text-[#687572]">
                  02–03
                </span>
              </div>
              <p className="mt-1 text-xs text-[#687572]">
                What you discovered.
              </p>

              <div className="mt-4 space-y-2.5">
                {reflectionComparisonStatements.map((stmt, idx) => (
                  <p
                    key={idx}
                    className="text-xs sm:text-sm text-[#172A2A] leading-relaxed border-l-2 border-[#6F8F86] pl-3"
                  >
                    &ldquo;{stmt}&rdquo;
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[#6F8F86]/30 text-xs font-mono-tabular text-[#172A2A]">
              {metrics.exploredCount} blind spots examined
            </div>
          </div>

          {/* Connector 2 -> 3 */}
          <div
            aria-hidden="true"
            className="lg:col-span-1 flex items-center justify-center py-1 lg:py-0"
          >
            <div className="hidden lg:flex items-center w-full">
              <div className="h-[1.5px] flex-1 bg-[#6F8F86]" />
              <ArrowRight className="h-4 w-4 text-[#172A2A] -ml-1 shrink-0" />
            </div>
            <ArrowDown className="lg:hidden h-5 w-5 text-[#172A2A]" />
          </div>

          {/* Column 3: Now */}
          <div className="lg:col-span-3 rounded-xs border-[1.5px] border-[#172A2A] bg-white p-6 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
                  Now
                </span>
                <span className="font-mono-tabular text-[11px] text-[#687572]">
                  04
                </span>
              </div>
              <p className="mt-1 text-xs text-[#687572]">
                What you think after examining it.
              </p>

              <p className="mt-4 font-editorial text-xl sm:text-2xl text-[#172A2A] leading-snug">
                &ldquo;{nowComparisonStatement}&rdquo;
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#D9DDD8] text-xs text-[#172A2A] font-semibold">
              {currentStressTest.finalConclusion.trim().length > 0
                ? 'Your authored conclusion'
                : 'Evolved reasoning state'}
            </div>
          </div>
        </div>
      </section>

      {/* Final Blind Spot Report */}
      <section
        aria-labelledby="heading-final-report"
        className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-10 space-y-8 shadow-2xs"
      >
        <div className="border-b border-[#D9DDD8] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
              Final blind spot report
            </span>
            <h2
              id="heading-final-report"
              className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]"
            >
              Completeness of your reasoning
            </h2>
          </div>

          {/* Compact 4-Metric Bar */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular text-[#687572]">
            <span>
              <strong className="text-[#172A2A]">{metrics.totalIdentified}</strong>{' '}
              identified
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-[#172A2A]">{metrics.addressedCount}</strong>{' '}
              addressed
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#C58B68]"
                aria-hidden="true"
              />
              <strong className="text-[#172A2A]">{metrics.stillUncertainCount}</strong>{' '}
              uncertain
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-[#6F8F86]">
                {metrics.newConsiderationsCount}
              </strong>{' '}
              new considerations
            </span>
          </div>
        </div>

        {/* 4 Structured Report Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. What you originally focused on */}
          <div className="rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-5 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
              01 · What you originally focused on
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-[#172A2A]">
              {originalFocusItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono-tabular text-xs text-[#6F8F86] mt-0.5">
                    0{idx + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. What you explored */}
          <div className="rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-5 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
              02 · What you explored
            </h3>
            {exploredFindings.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#687572]">
                No individual blind spot cards were marked explored yet.
              </p>
            ) : (
              <ul className="space-y-2.5 text-xs sm:text-sm text-[#172A2A]">
                {exploredFindings.slice(0, 5).map((item) => (
                  <li key={item.id} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#172A2A]">
                        {item.title}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-[#687572] shrink-0">
                        {item.statusLabel}
                      </span>
                    </div>
                    {item.userResponse && (
                      <p className="text-xs text-[#687572] italic line-clamp-2">
                        &ldquo;{item.userResponse}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3. What remains uncertain */}
          <div className="rounded-xs border border-[#D9DDD8] bg-[#F7F5F0] p-5 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
              03 · What remains uncertain
            </h3>
            {uncertainItems.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#687572]">
                All surfaced blind spots have been marked addressed.
              </p>
            ) : (
              <ul className="space-y-2 text-xs sm:text-sm text-[#172A2A]">
                {uncertainItems.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="text-[#172A2A]">{item.title}</span>
                    <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#687572] shrink-0">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[#C58B68]"
                        aria-hidden="true"
                      />
                      <span>{item.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 4. Questions worth investigating (Strictly questions, never recommendations) */}
          <div className="rounded-xs border border-[#6F8F86]/50 bg-[#E3ECE8]/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-[0.02em] text-[#172A2A]">
                04 · Questions worth investigating
              </h3>
              <HelpCircle
                className="h-4 w-4 text-[#6F8F86] shrink-0"
                aria-hidden="true"
              />
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#172A2A]">
              {questionsWorthInvestigating.map((q, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono-tabular text-xs font-semibold text-[#6F8F86] mt-0.5">
                    Q{idx + 1}
                  </span>
                  <span className="leading-relaxed">{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Final Decision Area ("Your decision" — Calm, spacious, user-owned, never AI-filled) */}
      <section
        aria-labelledby="heading-final-decision"
        className="border-[1.5px] border-[#6F8F86] bg-white rounded-xs p-8 sm:p-12 shadow-2xs"
      >
        <div className="max-w-3xl">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
              Your decision
            </span>
            <span className="font-mono-tabular text-xs text-[#687572]">
              {currentStressTest.finalConclusion.length} chars
            </span>
          </div>

          <label
            htmlFor={decisionTextareaId}
            id="heading-final-decision"
            className="mt-2 block font-editorial text-3xl sm:text-4xl text-[#172A2A]"
          >
            After reflecting, what do YOU think?
          </label>
        </div>

        <div className="mt-6">
          <textarea
            id={decisionTextareaId}
            rows={5}
            value={currentStressTest.finalConclusion}
            onChange={handleChangeConclusion}
            placeholder="Write your own conclusion in your own words..."
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? errorId : undefined}
            className="w-full rounded-xs border border-[#D9DDD8] bg-white px-5 py-4 text-base sm:text-lg text-[#172A2A] placeholder:text-[#687572]/65 focus:border-[#6F8F86] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6F8F86] leading-relaxed transition-all duration-150"
          />
        </div>

        {validationError && (
          <div
            id={errorId}
            role="alert"
            className="mt-3 flex items-center gap-2 text-xs font-medium text-[#172A2A]"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 text-[#C58B68]"
              aria-hidden="true"
            />
            <span>{validationError}</span>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-[#D9DDD8] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-[#172A2A]">
              Blind Spot Mirror doesn&apos;t decide for you.
            </p>
            <p className="text-xs sm:text-sm text-[#687572]">
              It helps you see what your reasoning may have missed.
            </p>
          </div>

          <PrimaryButton
            type="button"
            onClick={handleCompleteReflection}
            showArrow
            fullWidthOnMobile
          >
            Complete reflection
          </PrimaryButton>
        </div>
      </section>
    </div>
  );
};
