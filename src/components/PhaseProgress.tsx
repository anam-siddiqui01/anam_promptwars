import React from 'react';
import { Check, Lock } from 'lucide-react';
import { PHASES, PhaseNumber } from '../types/decision';

export interface PhaseProgressProps {
  currentPhase: PhaseNumber;
  maxUnlockedPhase: PhaseNumber;
  onSelectPhase?: (phase: PhaseNumber) => void;
}

export const PhaseProgress: React.FC<PhaseProgressProps> = ({
  currentPhase,
  maxUnlockedPhase,
  onSelectPhase,
}) => {
  const activePhaseDef =
    PHASES.find((p) => p.number === currentPhase) ?? PHASES[0];

  return (
    <nav
      aria-label="Decision reflection journey"
      className="w-full border-b border-[#D9DDD8] bg-[#F7F5F0]"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10 py-4 sm:py-5">
        {/* Desktop & Tablet: Visually Connected 4-Phase Journey */}
        <ol className="hidden md:flex items-start justify-between gap-2">
          {PHASES.map((phase, idx) => {
            const isActive = phase.number === currentPhase;
            const isCompleted = phase.number < currentPhase;
            const isUnlocked = phase.number <= maxUnlockedPhase;
            const isInteractive = isUnlocked && Boolean(onSelectPhase);
            const isLast = idx === PHASES.length - 1;

            return (
              <li
                key={phase.key}
                className={`flex items-center ${isLast ? 'shrink-0' : 'flex-1'}`}
              >
                <button
                  type="button"
                  disabled={!isInteractive}
                  onClick={() => isInteractive && onSelectPhase?.(phase.number)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Phase ${phase.code}: ${phase.label} — ${phase.shortDescription}${
                    isActive
                      ? ' (Active phase)'
                      : isCompleted
                      ? ' (Completed phase)'
                      : isUnlocked
                      ? ' (Available)'
                      : ' (Locked)'
                  }`}
                  className={`group relative flex flex-col items-start text-left rounded-xs border px-3.5 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                    isActive
                      ? 'border-[#6F8F86] bg-white text-[#172A2A] shadow-2xs'
                      : isCompleted
                      ? 'border-[#D9DDD8] bg-white/70 text-[#172A2A] hover:border-[#6F8F86] hover:bg-white cursor-pointer'
                      : isUnlocked
                      ? 'border-[#D9DDD8] bg-transparent text-[#687572] hover:border-[#6F8F86] hover:bg-white/60 hover:text-[#172A2A] cursor-pointer'
                      : 'border-[#D9DDD8] bg-transparent text-[#687572] cursor-not-allowed opacity-70'
                  }`}
                >
                  {/* Sage active bottom line for current phase */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-[2.5px] bg-[#6F8F86]"
                    />
                  )}

                  <div className="flex items-center gap-2.5">
                    {/* Number or Subtle Sage Check Indicator */}
                    <span
                      className={`inline-flex h-5 min-w-[24px] items-center justify-center rounded-xs px-1 font-mono-tabular text-[11px] font-semibold tracking-wider transition-colors ${
                        isActive
                          ? 'bg-[#6F8F86] text-white'
                          : isCompleted
                          ? 'border border-[#6F8F86]/45 bg-[#E3ECE8] text-[#172A2A]'
                          : isUnlocked
                          ? 'border border-[#D9DDD8] bg-white text-[#687572] group-hover:border-[#6F8F86] group-hover:text-[#172A2A]'
                          : 'border border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]'
                      }`}
                    >
                      {isCompleted ? (
                        <Check
                          className="h-3 w-3 stroke-[2.5] text-[#172A2A]"
                          aria-hidden="true"
                        />
                      ) : (
                        phase.code
                      )}
                    </span>

                    {/* Phase Title */}
                    <span
                      className={`font-mono-tabular text-xs font-semibold tracking-[0.12em] uppercase whitespace-nowrap ${
                        isActive || isCompleted
                          ? 'text-[#172A2A]'
                          : 'text-[#687572]'
                      }`}
                    >
                      {phase.label}
                    </span>

                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[#6F8F86]"
                      />
                    )}

                    {!isUnlocked && (
                      <Lock
                        className="h-3 w-3 text-[#687572]/70 ml-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* One-Line Short Description */}
                  <span
                    className={`mt-1 text-[11px] leading-snug max-w-[210px] line-clamp-1 ${
                      isActive
                        ? 'text-[#172A2A]/80 font-medium'
                        : 'text-[#687572]'
                    }`}
                  >
                    {phase.shortDescription}
                  </span>
                </button>

                {/* Connecting Journey Line between phases (No gradients) */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className="mx-3 flex-1 flex items-center"
                  >
                    <div
                      className={`h-[1.5px] w-full transition-colors duration-300 ${
                        phase.number < currentPhase
                          ? 'bg-[#6F8F86]'
                          : 'bg-[#D9DDD8]'
                      }`}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* Mobile (< md): Compact Connected Progress Indicator */}
        <div className="md:hidden space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 justify-center rounded-xs border border-[#6F8F86] bg-[#E3ECE8] px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#172A2A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6F8F86]" />
                <span>
                  {activePhaseDef.code} {activePhaseDef.label}
                </span>
              </span>
              <span className="text-xs text-[#687572] truncate max-w-[200px]">
                {activePhaseDef.shortDescription}
              </span>
            </div>
            <span className="font-mono-tabular text-[11px] text-[#687572] shrink-0">
              Phase {currentPhase} / 4
            </span>
          </div>

          {/* Connected Step Bar on Mobile */}
          <div className="grid grid-cols-4 gap-1.5">
            {PHASES.map((phase) => {
              const isActive = phase.number === currentPhase;
              const isCompleted = phase.number < currentPhase;
              const isUnlocked = phase.number <= maxUnlockedPhase;
              const isInteractive = isUnlocked && Boolean(onSelectPhase);

              return (
                <button
                  key={phase.key}
                  type="button"
                  disabled={!isInteractive}
                  onClick={() => isInteractive && onSelectPhase?.(phase.number)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`flex flex-col items-start gap-1 py-1 text-left focus-visible:outline-none ${
                    isInteractive ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`h-1.5 w-full rounded-full transition-colors duration-200 ${
                      isActive
                        ? 'bg-[#6F8F86]'
                        : isCompleted
                        ? 'bg-[#172A2A]'
                        : 'bg-[#D9DDD8]'
                    }`}
                  />
                  <span
                    className={`font-mono-tabular text-[10px] tracking-wider uppercase ${
                      isActive
                        ? 'font-semibold text-[#172A2A]'
                        : isCompleted
                        ? 'font-medium text-[#172A2A]'
                        : 'text-[#687572]'
                    }`}
                  >
                    {phase.code} {phase.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
