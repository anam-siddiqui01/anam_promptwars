import React from 'react';
import { Check, X } from 'lucide-react';

export interface ContextChipProps {
  label: string;
  selected: boolean;
  onToggle: (label: string) => void;
  isCustom?: boolean;
  onRemoveCustom?: (label: string) => void;
  disabled?: boolean;
}

export const ContextChip: React.FC<ContextChipProps> = ({
  label,
  selected,
  onToggle,
  isCustom = false,
  onRemoveCustom,
  disabled = false,
}) => {
  return (
    <div className="inline-flex items-stretch">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(label)}
        aria-pressed={selected}
        className={`group inline-flex min-h-[40px] items-center justify-between gap-2.5 px-3.5 py-2 text-xs sm:text-sm transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] focus-visible:ring-offset-1 ${
          isCustom && selected ? 'rounded-l-xs' : 'rounded-xs'
        } ${
          selected
            ? 'border-[1.5px] border-[#6F8F86] bg-[#E3ECE8] text-[#172A2A] font-semibold shadow-2xs'
            : 'border border-[#D9DDD8] bg-white text-[#172A2A] hover:border-[#6F8F86] hover:bg-[#F7F5F0] font-medium'
        } ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer active:translate-y-[0.5px]'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-2xs border transition-colors duration-150 ${
            selected
              ? 'border-[#6F8F86] bg-[#6F8F86] text-white'
              : 'border-[#D9DDD8] bg-white group-hover:border-[#6F8F86]'
          }`}
        >
          {selected && <Check className="h-3 w-3 stroke-[2.5]" />}
        </span>
        <span>{label}</span>
      </button>

      {isCustom && selected && onRemoveCustom && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemoveCustom(label)}
          aria-label={`Remove custom context ${label}`}
          title={`Remove ${label}`}
          className="inline-flex min-h-[40px] items-center justify-center rounded-r-xs border-[1.5px] border-l-0 border-[#6F8F86] bg-[#E3ECE8] px-2 text-[#687572] hover:bg-[#172A2A] hover:text-white hover:border-[#172A2A] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] focus-visible:ring-offset-1 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
