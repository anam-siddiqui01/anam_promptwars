import React from 'react';
import { Plus } from 'lucide-react';
import { PhaseNumber } from '../types/decision';
import { BlindSpotLogo } from './BlindSpotLogo';
import { PhaseProgress } from './PhaseProgress';

export type ActiveNavTab = 'workspace' | 'sessions' | 'principles' | 'schema';

export interface PageContainerProps {
  currentPhase: PhaseNumber;
  maxUnlockedPhase: PhaseNumber;
  onSelectPhase: (phase: PhaseNumber) => void;
  activeNav: ActiveNavTab;
  onSelectNav: (tab: ActiveNavTab) => void;
  savedSessionCount: number;
  onNewDecision: () => void;
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  currentPhase,
  maxUnlockedPhase,
  onSelectPhase,
  activeNav,
  onSelectNav,
  savedSessionCount,
  onNewDecision,
  children,
}) => {
  const isReflectionActive = activeNav === 'workspace';
  const isSessionsActive = activeNav === 'sessions';
  const isMethodologyActive =
    activeNav === 'principles' || activeNav === 'schema';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5F0] text-[#172A2A] selection:bg-[#E3ECE8] selection:text-[#172A2A]">
      {/* Top Product Navigation Bar */}
      <header className="border-b border-[#D9DDD8] bg-[#F7F5F0] sticky top-0 z-30">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-10">
          {/* Zone 1: Brand Mark + Compact Wordmark */}
          <div className="flex items-center gap-9">
            <a
              href="#reflection"
              onClick={(e) => {
                e.preventDefault();
                onSelectNav('workspace');
              }}
              className="group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-xs"
            >
              <BlindSpotLogo size="default" />
              <span className="text-[15px] font-semibold tracking-[0.015em] text-[#172A2A]">
                Blind Spot Mirror
              </span>
            </a>

            {/* Zone 2: Lighter, Editorial Navigation */}
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-7"
            >
              <button
                type="button"
                onClick={() => onSelectNav('workspace')}
                className={`relative py-1 text-sm tracking-[0.005em] transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-xs ${
                  isReflectionActive
                    ? 'text-[#172A2A] font-semibold'
                    : 'text-[#687572] hover:text-[#172A2A] font-normal'
                }`}
              >
                <span>Reflection</span>
                {isReflectionActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[18px] h-[2px] bg-[#6F8F86]"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectNav('sessions')}
                className={`relative py-1 text-sm tracking-[0.005em] transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-xs flex items-center gap-1.5 ${
                  isSessionsActive
                    ? 'text-[#172A2A] font-semibold'
                    : 'text-[#687572] hover:text-[#172A2A] font-normal'
                }`}
              >
                <span>Saved Sessions</span>
                {savedSessionCount > 0 && (
                  <span className="font-mono-tabular text-xs text-[#687572]">
                    ({savedSessionCount})
                  </span>
                )}
                {isSessionsActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[18px] h-[2px] bg-[#6F8F86]"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectNav('principles')}
                className={`relative py-1 text-sm tracking-[0.005em] transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-xs ${
                  isMethodologyActive
                    ? 'text-[#172A2A] font-semibold'
                    : 'text-[#687572] hover:text-[#172A2A] font-normal'
                }`}
              >
                <span>Methodology</span>
                {isMethodologyActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[18px] h-[2px] bg-[#6F8F86]"
                  />
                )}
              </button>
            </nav>
          </div>

          {/* Zone 3: New Decision Frame Action */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNewDecision}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#172A2A] bg-white border border-[#D9DDD8] rounded-xs hover:bg-[#172A2A] hover:text-white hover:border-[#172A2A] active:translate-y-[0.5px] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>New Decision Frame</span>
            </button>
          </div>
        </div>

        {/* Mobile Compact Nav */}
        <div className="flex md:hidden items-center justify-between border-t border-[#D9DDD8] px-4 py-2 text-xs bg-[#F7F5F0]">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onSelectNav('workspace')}
              className={`whitespace-nowrap py-0.5 transition-colors cursor-pointer ${
                isReflectionActive
                  ? 'text-[#172A2A] font-semibold border-b-2 border-[#6F8F86]'
                  : 'text-[#687572] font-normal'
              }`}
            >
              Reflection
            </button>
            <button
              type="button"
              onClick={() => onSelectNav('sessions')}
              className={`whitespace-nowrap py-0.5 transition-colors cursor-pointer ${
                isSessionsActive
                  ? 'text-[#172A2A] font-semibold border-b-2 border-[#6F8F86]'
                  : 'text-[#687572] font-normal'
              }`}
            >
              Saved Sessions {savedSessionCount > 0 ? `(${savedSessionCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => onSelectNav('principles')}
              className={`whitespace-nowrap py-0.5 transition-colors cursor-pointer ${
                isMethodologyActive
                  ? 'text-[#172A2A] font-semibold border-b-2 border-[#6F8F86]'
                  : 'text-[#687572] font-normal'
              }`}
            >
              Methodology
            </button>
          </div>
        </div>
      </header>

      {/* Persistent 4-Phase Connected Journey Bar */}
      {isReflectionActive && (
        <PhaseProgress
          currentPhase={currentPhase}
          maxUnlockedPhase={maxUnlockedPhase}
          onSelectPhase={(phase) => {
            onSelectNav('workspace');
            onSelectPhase(phase);
          }}
        />
      )}

      {/* Main Thinking Canvas */}
      <main className="flex-1 mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        {children}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#D9DDD8] bg-[#F7F5F0] mt-auto">
        <div className="mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-[1320px] px-4 sm:px-6 lg:px-10 py-6 text-xs text-[#687572]">
          <div className="flex flex-wrap items-center gap-2.5">
            <BlindSpotLogo size="small" />
            <span className="font-semibold tracking-[0.01em] text-[#172A2A]">
              Blind Spot Mirror
            </span>
            <span className="text-[#D9DDD8]" aria-hidden="true">
              —
            </span>
            <span>See what your reasoning might be missing.</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-[#687572]">
            <span>The AI doesn&apos;t decide</span>
            <span className="text-[#D9DDD8]" aria-hidden="true">
              ·
            </span>
            <span>The AI holds up the mirror</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
