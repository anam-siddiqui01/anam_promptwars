/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Clock,
  Code2,
  Compass,
  FolderOpen,
  Trash2,
  X,
} from 'lucide-react';
import {
  BlindSpotItemProgress,
  DecisionDraft,
  DecisionSession,
  EXAMPLE_DECISIONS,
  ExampleDecisionPrompt,
  PHASES,
  PhaseNumber,
  StressTestRecord,
} from './types/decision';
import {
  analyzeDecisionReasoning,
  canAccessPhase,
  getActiveSessionId,
  ReflectionSynthesisRequestItem,
  sessionRepository,
  setActiveSessionId,
  synthesizePhaseThreeReflections,
} from './services/sessionStorage';
import { ActiveNavTab, PageContainer } from './components/PageContainer';
import { DecisionForm } from './components/DecisionForm';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { PhaseTwoMirrorStage } from './components/PhaseTwoMirrorStage';
import { PhaseThreeReflectStage } from './components/PhaseThreeReflectStage';
import { PhaseFourStressTestStage } from './components/PhaseFourStressTestStage';
import { PrimaryButton } from './components/PrimaryButton';

const EMPTY_DRAFT: DecisionDraft = {
  decision: '',
  reasoning: '',
  context: [],
};

export default function App() {
  const [activeNav, setActiveNav] = useState<ActiveNavTab>('workspace');
  const [currentPhase, setCurrentPhase] = useState<PhaseNumber>(1);
  const [draft, setDraft] = useState<DecisionDraft>(EMPTY_DRAFT);
  const [sessions, setSessions] = useState<DecisionSession[]>([]);
  const [activeSession, setActiveSession] = useState<DecisionSession | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load saved sessions on mount
  useEffect(() => {
    let mounted = true;
    sessionRepository.listSessions().then((loaded) => {
      if (!mounted) return;
      setSessions(loaded);
      const savedActiveId = getActiveSessionId();
      if (savedActiveId) {
        const match = loaded.find((s) => s.id === savedActiveId);
        if (match) {
          setActiveSession(match);
          setDraft({
            decision: match.decision,
            reasoning: match.reasoning,
            context: match.context,
          });
          if (match.mirrorAnalysis) {
            if (match.currentPhase >= 4) {
              setCurrentPhase(4);
            } else if (match.currentPhase >= 3) {
              setCurrentPhase(3);
            } else {
              setCurrentPhase(2);
            }
          }
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const maxUnlockedPhase: PhaseNumber = canAccessPhase(4, activeSession)
    ? 4
    : activeSession && activeSession.mirrorAnalysis
    ? 3
    : 1;

  const handleSubmitDecisionFrame = async (submittedDraft: DecisionDraft) => {
    setApiError(null);
    setIsTransitioning(true);
    setLoadingStepIndex(0);

    const stepTimer1 = window.setTimeout(() => setLoadingStepIndex(1), 650);
    const stepTimer2 = window.setTimeout(() => setLoadingStepIndex(2), 1400);

    try {
      const mirrorResult = await analyzeDecisionReasoning(submittedDraft);

      let savedSession: DecisionSession;
      if (activeSession) {
        savedSession = await sessionRepository.updateSessionWithMirror(
          activeSession.id,
          submittedDraft,
          mirrorResult
        );
      } else {
        savedSession = await sessionRepository.createSessionWithMirror(
          submittedDraft,
          mirrorResult
        );
      }

      const refreshedList = await sessionRepository.listSessions();
      setSessions(refreshedList);
      setActiveSession(savedSession);
      setCurrentPhase(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to complete Mirror analysis. Please check your connection and try again.';
      setApiError(message);
    } finally {
      window.clearTimeout(stepTimer1);
      window.clearTimeout(stepTimer2);
      setIsTransitioning(false);
    }
  };

  const handleUpdateBlindSpotProgress = async (
    updatedProgress: Record<string, BlindSpotItemProgress>
  ) => {
    if (!activeSession) return;

    const optimistic: DecisionSession = {
      ...activeSession,
      blindSpotProgress: updatedProgress,
    };
    setActiveSession(optimistic);

    try {
      const persisted = await sessionRepository.updateSession(activeSession.id, {
        blindSpotProgress: updatedProgress,
      });
      setActiveSession(persisted);
      const refreshedList = await sessionRepository.listSessions();
      setSessions(refreshedList);
    } catch {
      // Keep optimistic state if storage write fails
    }
  };

  const handleTransitionToReflect = async () => {
    setApiError(null);
    setCurrentPhase(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (activeSession && activeSession.currentPhase < 3) {
      try {
        const persisted = await sessionRepository.updateSession(activeSession.id, {
          currentPhase: 3,
        });
        setActiveSession(persisted);
        const refreshedList = await sessionRepository.listSessions();
        setSessions(refreshedList);
      } catch {
        // Ignore storage error
      }
    }
  };

  const handleSynthesizeReflections = async (
    items: ReflectionSynthesisRequestItem[]
  ) => {
    if (!activeSession) return;
    setApiError(null);
    setIsSynthesizing(true);

    try {
      const synthesis = await synthesizePhaseThreeReflections({
        decision: activeSession.decision,
        reasoning: activeSession.reasoning,
        context: activeSession.context,
        reflections: items,
      });

      const persisted = await sessionRepository.updateSession(activeSession.id, {
        currentPhase: 3,
        reflectionSynthesis: synthesis,
      });
      setActiveSession(persisted);
      const refreshedList = await sessionRepository.listSessions();
      setSessions(refreshedList);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to synthesize reflections right now. Please try again.';
      setApiError(message);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleTransitionToStressTest = async () => {
    setApiError(null);
    setCurrentPhase(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (activeSession && activeSession.currentPhase < 4) {
      try {
        const persisted = await sessionRepository.updateSession(activeSession.id, {
          currentPhase: 4,
        });
        setActiveSession(persisted);
        const refreshedList = await sessionRepository.listSessions();
        setSessions(refreshedList);
      } catch {
        // Ignore storage error
      }
    }
  };

  const handleUpdateStressTest = async (stressTest: StressTestRecord) => {
    if (!activeSession) return;

    const optimistic: DecisionSession = {
      ...activeSession,
      currentPhase: 4,
      stressTest,
    };
    setActiveSession(optimistic);

    try {
      const persisted = await sessionRepository.updateSession(activeSession.id, {
        currentPhase: 4,
        stressTest,
      });
      setActiveSession(persisted);
      const refreshedList = await sessionRepository.listSessions();
      setSessions(refreshedList);
    } catch {
      // Keep optimistic state
    }
  };

  const handleStartNewDecision = () => {
    setApiError(null);
    setActiveSession(null);
    setDraft(EMPTY_DRAFT);
    setCurrentPhase(1);
    setActiveNav('workspace');
  };

  const handleLoadExample = (example: ExampleDecisionPrompt) => {
    setApiError(null);
    setDraft({
      decision: example.decision,
      reasoning: example.reasoning,
      context: [...example.context],
    });
    setCurrentPhase(1);
    setActiveNav('workspace');
  };

  const handleOpenSavedSession = (session: DecisionSession) => {
    setApiError(null);
    setActiveSession(session);
    setActiveSessionId(session.id);
    setDraft({
      decision: session.decision,
      reasoning: session.reasoning,
      context: [...session.context],
    });
    if (session.mirrorAnalysis) {
      if (session.currentPhase >= 4) {
        setCurrentPhase(4);
      } else if (session.currentPhase >= 3) {
        setCurrentPhase(3);
      } else {
        setCurrentPhase(2);
      }
    } else {
      setCurrentPhase(1);
    }
    setActiveNav('workspace');
  };

  const handleDeleteSavedSession = async (id: string) => {
    await sessionRepository.deleteSession(id);
    const updated = await sessionRepository.listSessions();
    setSessions(updated);
    if (activeSession?.id === id) {
      setActiveSession(null);
      setDraft(EMPTY_DRAFT);
      setCurrentPhase(1);
    }
  };

  const handleSelectPhase = (targetPhase: PhaseNumber) => {
    if (!canAccessPhase(targetPhase, activeSession)) return;
    setApiError(null);
    setCurrentPhase(targetPhase);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PageContainer
      currentPhase={currentPhase}
      maxUnlockedPhase={maxUnlockedPhase}
      onSelectPhase={handleSelectPhase}
      activeNav={activeNav}
      onSelectNav={setActiveNav}
      savedSessionCount={sessions.length}
      onNewDecision={handleStartNewDecision}
    >
      {/* Visible API / Validation Error Banner */}
      {apiError && (
        <div
          role="alert"
          className="mb-6 flex items-start justify-between gap-4 rounded-xs border border-[#C58B68] bg-white px-5 py-4 text-xs sm:text-sm text-[#172A2A]"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-[#C58B68] mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Reflection service notice</p>
              <p className="mt-0.5 text-[#687572]">{apiError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setApiError(null)}
            aria-label="Dismiss error"
            className="rounded-xs p-1 text-[#687572] hover:text-[#172A2A] hover:bg-[#F7F5F0] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* VIEW 1: REFLECTION WORKSPACE */}
      {activeNav === 'workspace' && (
        <>
          {isTransitioning ? (
            <div className="max-w-3xl mx-auto">
              <LoadingState
                activeStepIndex={loadingStepIndex}
                title="Holding up the mirror to your reasoning"
                subtitle="Examining your stated premises to surface unstated assumptions, missing factors, alternative perspectives, and evidence gaps—without generating advice."
                steps={[
                  'Reading your verbatim decision and reasoning premises',
                  'Surfacing assumptions, missing factors, perspectives, and evidence gaps',
                  'Verifying non-prescriptive alignment rules',
                ]}
              />
            </div>
          ) : currentPhase === 1 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Primary Thinking Canvas (8 cols on 1280px+) */}
              <div className="lg:col-span-8">
                <DecisionForm
                  initialDraft={draft}
                  onDraftChange={setDraft}
                  onSubmit={handleSubmitDecisionFrame}
                  onResetDraft={() => setDraft(EMPTY_DRAFT)}
                  isSubmitting={isTransitioning}
                />
              </div>

              {/* Right Editorial Margin Column (4 cols on 1280px+) */}
              <aside
                aria-label="Example decision scenarios and product philosophy"
                className="lg:col-span-4 space-y-6"
              >
                {/* Product Philosophy Card */}
                <div className="border border-[#172A2A] bg-[#172A2A] text-white rounded-xs p-6 sm:p-7">
                  <span className="text-xs font-medium tracking-[0.02em] text-[#E3ECE8]">
                    The philosophy
                  </span>
                  <h2 className="mt-2 font-editorial text-2xl sm:text-3xl text-white">
                    The AI doesn&apos;t decide. The AI holds up the mirror.
                  </h2>
                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#E3ECE8]/85">
                    When we face a hard decision, we naturally anchor on the factors most
                    visible to us. Blind Spot Mirror questions your assumptions and
                    surfaces what is missing—while leaving final judgment entirely in your
                    hands.
                  </p>
                </div>

                {/* Quick-Load Example Prompts */}
                <div className="border border-[#D9DDD8] bg-white rounded-xs p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-[0.01em] text-[#172A2A]">
                      Example decisions
                    </h2>
                    <span className="text-xs text-[#687572]">Load into canvas</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#687572] leading-relaxed">
                    Explore how the mirror works with a realistic scenario:
                  </p>

                  <div className="mt-4 divide-y divide-[#D9DDD8] border-t border-[#D9DDD8]">
                    {EXAMPLE_DECISIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleLoadExample(item)}
                        className="group w-full py-3.5 px-2 -mx-2 text-left transition-colors hover:bg-[#E3ECE8]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-2xs cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#172A2A] group-hover:text-[#6F8F86] transition-colors">
                            {item.title}
                          </span>
                          <ArrowRight
                            className="h-3.5 w-3.5 text-[#687572] group-hover:translate-x-1 group-hover:text-[#6F8F86] transition-all shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-1 text-xs text-[#687572] line-clamp-1">
                          {item.decision}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          ) : currentPhase === 2 && activeSession ? (
            <PhaseTwoMirrorStage
              session={activeSession}
              onUpdateBlindSpotProgress={handleUpdateBlindSpotProgress}
              onReanalyze={() => handleSubmitDecisionFrame(draft)}
              onEditFrame={() => setCurrentPhase(1)}
              onContinueToReflect={handleTransitionToReflect}
              isReanalyzing={isTransitioning}
            />
          ) : currentPhase === 3 && activeSession ? (
            <PhaseThreeReflectStage
              session={activeSession}
              onUpdateBlindSpotProgress={handleUpdateBlindSpotProgress}
              onSynthesizeReflections={handleSynthesizeReflections}
              onBackToMirror={() => setCurrentPhase(2)}
              onContinueToStressTest={handleTransitionToStressTest}
              isSynthesizing={isSynthesizing}
            />
          ) : currentPhase === 4 && activeSession ? (
            <PhaseFourStressTestStage
              session={activeSession}
              onUpdateStressTest={handleUpdateStressTest}
              onBackToReflect={() => setCurrentPhase(3)}
              onStartNewDecision={handleStartNewDecision}
            />
          ) : (
            <EmptyState
              icon={Compass}
              title="No decision framed yet"
              description="Start in Phase 01: Frame to articulate the decision you are considering and the reasoning behind it."
              actionLabel="Go to 01 Frame"
              onAction={() => setCurrentPhase(1)}
            />
          )}
        </>
      )}

      {/* VIEW 2: SAVED SESSIONS */}
      {activeNav === 'sessions' && (
        <div className="animate-stage-enter space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9DDD8] pb-6">
            <div>
              <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
                Archive
              </span>
              <h1 className="mt-1 font-editorial text-3xl sm:text-4xl text-[#172A2A]">
                Saved Decision Sessions
              </h1>
              <p className="mt-1 text-sm text-[#687572]">
                Revisit or refine your framed decisions, Blind Spot Maps, reflections, and
                Stress Tests.
              </p>
            </div>
            <PrimaryButton onClick={handleStartNewDecision} fullWidthOnMobile={false}>
              New Decision Frame
            </PrimaryButton>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No saved decision sessions yet"
              description="Complete Phase 01: Frame in the workspace to create your first reflection session."
              actionLabel="Go to Reflection Workspace"
              onAction={() => {
                setCurrentPhase(1);
                setActiveNav('workspace');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {sessions.map((item) => {
                const isCurrent = activeSession?.id === item.id;
                const progressValues = item.blindSpotProgress
                  ? Object.values(item.blindSpotProgress)
                  : [];
                const addressedCount = progressValues.filter(
                  (p) => p.state === 'ADDRESSED'
                ).length;
                const needInfoCount = progressValues.filter(
                  (p) => p.needsMoreInfo || p.state === 'NEEDS_INFO'
                ).length;
                const phaseInfo = PHASES[item.currentPhase - 1] ?? PHASES[0];

                return (
                  <div
                    key={item.id}
                    className={`border rounded-xs bg-white p-6 transition-colors ${
                      isCurrent
                        ? 'border-[#6F8F86] shadow-2xs'
                        : 'border-[#D9DDD8] hover:border-[#6F8F86]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-[#687572]">
                          <span className="font-semibold tracking-[0.12em] text-[#172A2A] uppercase">
                            {phaseInfo.code} {phaseInfo.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {progressValues.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {addressedCount}/{progressValues.length} addressed ·{' '}
                                {needInfoCount} need info
                              </span>
                            </>
                          )}
                          {item.stressTest?.completedAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#172A2A] font-semibold">
                                Reflection complete
                              </span>
                            </>
                          )}
                          {isCurrent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#6F8F86] font-semibold">
                                Active session
                              </span>
                            </>
                          )}
                        </div>

                        <h2 className="font-editorial text-2xl sm:text-3xl text-[#172A2A]">
                          {item.decision}
                        </h2>
                        <p className="text-sm text-[#687572] line-clamp-2 leading-relaxed">
                          {item.reasoning}
                        </p>

                        {item.context.length > 0 && (
                          <p className="pt-1 text-xs text-[#687572]">
                            Context:{' '}
                            <span className="text-[#172A2A] font-medium">
                              {item.context.join(' · ')}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenSavedSession(item)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xs bg-[#172A2A] px-4 py-2 text-xs font-semibold tracking-[0.01em] text-white hover:bg-[#243B3B] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <span>Open session</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedSession(item.id)}
                          aria-label={`Delete session ${item.decision}`}
                          className="inline-flex min-h-[38px] items-center justify-center rounded-xs border border-[#D9DDD8] bg-white px-2.5 py-2 text-[#687572] hover:border-[#C58B68] hover:text-[#172A2A] transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: METHODOLOGY */}
      {(activeNav === 'principles' || activeNav === 'schema') && (
        <div className="animate-stage-enter space-y-10">
          <div className="border-b border-[#D9DDD8] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
                Architecture of reflection
              </span>
              <h1 className="mt-2 font-editorial text-3xl sm:text-5xl text-[#172A2A]">
                The Four-Phase Reflection Protocol
              </h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-base text-[#687572] leading-relaxed">
                Blind Spot Mirror structures complex personal and professional decisions
                into four deliberate stages—separating initial framing from critical
                inquiry so your final decision remains yours.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveNav('principles')}
                className={`px-3.5 py-1.5 text-xs font-semibold tracking-[0.01em] rounded-xs cursor-pointer ${
                  activeNav === 'principles'
                    ? 'bg-[#172A2A] text-white'
                    : 'bg-white border border-[#D9DDD8] text-[#687572] hover:border-[#6F8F86] hover:text-[#172A2A]'
                }`}
              >
                Protocol
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('schema')}
                className={`px-3.5 py-1.5 text-xs font-semibold tracking-[0.01em] rounded-xs cursor-pointer inline-flex items-center gap-1.5 ${
                  activeNav === 'schema'
                    ? 'bg-[#172A2A] text-white'
                    : 'bg-white border border-[#D9DDD8] text-[#687572] hover:border-[#6F8F86] hover:text-[#172A2A]'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Schema</span>
              </button>
            </div>
          </div>

          {activeNav === 'principles' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PHASES.map((phase) => (
                <div
                  key={phase.key}
                  className="border border-[#D9DDD8] bg-white rounded-xs p-6 sm:p-8 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-[#6F8F86] uppercase">
                        {phase.code} {phase.label}
                      </span>
                      <BookOpen className="h-4 w-4 text-[#6F8F86]" aria-hidden="true" />
                    </div>
                    <h2 className="mt-2 font-editorial text-2xl sm:text-3xl text-[#172A2A]">
                      {phase.code}. {phase.label}
                    </h2>
                    <p className="mt-2 text-sm text-[#687572] leading-relaxed">
                      {phase.shortDescription}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#D9DDD8] pt-4 text-xs text-[#687572]">
                    {phase.number === 1
                      ? '01 — Construct the decision, reasoning, and context'
                      : phase.number === 2
                      ? '02 — Interactive Blind Spot Map & non-directive inquiry'
                      : phase.number === 3
                      ? '03 — Focused reflection exercise & Before/After synthesis'
                      : '04 — Reasoning transformation & user-authored conclusion'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-[#D9DDD8] bg-white rounded-xs p-6">
                <h2 className="text-xs font-semibold tracking-[0.01em] text-[#172A2A]">
                  Strict Mirror, Synthesis &amp; Stress Test schemas
                </h2>
                <pre className="mt-4 overflow-x-auto rounded-xs bg-[#172A2A] p-4 text-xs leading-relaxed text-[#E3ECE8]">
{`// Phase 02: POST /api/mirror/analyze
{
  "assumptions": [{ "title": "...", "description": "...", "question": "..." }],
  "missingFactors": [{ "title": "...", "description": "...", "question": "..." }],
  "perspectives": [{ "perspective": "...", "description": "...", "question": "..." }],
  "evidenceGaps": [{ "claim": "...", "question": "..." }],
  "probes": ["..."]
}

// Phase 03: POST /api/mirror/synthesize
{
  "beforeReasons": ["high stipend", "close location", "industry experience"],
  "afterSynthesis": "I realized I haven't verified...",
  "keyShifts": ["..."],
  "openInformationNeeds": ["..."]
}

// Phase 04: User-Owned Stress Test Record (Never AI-filled)
{
  "stance": "yes" | "no" | "less_certain" | "need_more_info",
  "finalConclusion": "User's own written decision conclusion...",
  "completedAt": "2026-10-04T06:30:00.000Z"
}`}
                </pre>
              </div>

              <div className="border border-[#D9DDD8] bg-white rounded-xs p-6">
                <h2 className="text-xs font-semibold tracking-[0.01em] text-[#172A2A]">
                  Current live session payload
                </h2>
                <pre className="mt-4 max-h-[420px] overflow-auto rounded-xs bg-[#172A2A] p-4 text-xs leading-relaxed text-[#E3ECE8]">
                  {JSON.stringify(
                    activeSession ?? {
                      id: 'bsm_draft_preview',
                      decision: draft.decision,
                      reasoning: draft.reasoning,
                      context: draft.context,
                      currentPhase,
                      createdAt: new Date().toISOString(),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
