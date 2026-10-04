import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  steps?: string[];
  activeStepIndex?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Preparing your reflection space',
  subtitle = 'Structuring your decision frame and organizing your reasoning premises.',
  steps = [
    'Parsing decision statement and context tags',
    'Isolating explicit claims and unstated premises',
    'Preparing Phase 02 Mirror workspace',
  ],
  activeStepIndex = 0,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full border border-[#D9DDD8] bg-white p-8 sm:p-12 rounded-xs shadow-2xs"
    >
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xs border border-[#6F8F86]/40 bg-[#E3ECE8]">
          <Loader2
            className="h-4 w-4 animate-spin text-[#172A2A]"
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-[0.02em] text-[#6F8F86]">
              Reflection engine
            </span>
          </div>
          <h3 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#172A2A]">
            {title}
          </h3>
          <p className="mt-1.5 text-sm text-[#687572] leading-relaxed max-w-xl">
            {subtitle}
          </p>

          <div className="mt-6 space-y-2.5 border-t border-[#D9DDD8] pt-5">
            {steps.map((step, index) => {
              const isCurrent = index === activeStepIndex;
              const isPast = index < activeStepIndex;
              return (
                <div
                  key={step}
                  className="flex items-center gap-3 text-xs sm:text-sm"
                >
                  <span
                    className={`font-mono-tabular text-xs font-semibold ${
                      isCurrent
                        ? 'text-[#6F8F86]'
                        : isPast
                        ? 'text-[#172A2A]'
                        : 'text-[#687572]/60'
                    }`}
                  >
                    0{index + 1}
                  </span>
                  <span
                    className={
                      isCurrent
                        ? 'font-medium text-[#172A2A]'
                        : isPast
                        ? 'text-[#687572]'
                        : 'text-[#687572]/60'
                    }
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
