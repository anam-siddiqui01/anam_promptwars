import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) => {
  return (
    <div
      className={`w-full border border-dashed border-[#D9DDD8] bg-[#F7F5F0] rounded-xs text-left ${
        compact ? 'p-5' : 'p-7 sm:p-9'
      }`}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xs border border-[#D9DDD8] bg-white text-[#6F8F86]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-editorial text-xl sm:text-2xl text-[#172A2A]">
            {title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-[#687572] leading-relaxed max-w-lg">
            {description}
          </p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.01em] text-[#172A2A] hover:text-[#6F8F86] underline decoration-[#6F8F86] underline-offset-4 transition-colors cursor-pointer"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
