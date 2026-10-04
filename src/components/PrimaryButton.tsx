import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  showArrow?: boolean;
  fullWidthOnMobile?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  isLoading = false,
  loadingText = 'Preparing reflection...',
  showArrow = false,
  fullWidthOnMobile = true,
  disabled,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={`group relative inline-flex min-h-[46px] items-center justify-center gap-2.5 rounded-xs px-6 py-3 text-sm font-semibold tracking-[0.01em] transition-all duration-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] focus-visible:ring-offset-2 ${
        fullWidthOnMobile ? 'w-full sm:w-auto' : ''
      } ${
        isDisabled
          ? 'border border-[#D9DDD8] bg-[#E3ECE8]/50 text-[#687572] cursor-not-allowed'
          : 'border border-[#172A2A] bg-[#172A2A] text-white hover:bg-[#243B3B] hover:border-[#243B3B] active:translate-y-[1px] cursor-pointer shadow-2xs'
      } ${className}`}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2
            className="h-4 w-4 animate-spin text-[#E3ECE8]"
            aria-hidden="true"
          />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {showArrow && (
            <ArrowRight
              className={`h-4 w-4 transition-transform duration-200 ${
                isDisabled
                  ? 'text-[#687572]'
                  : 'text-[#E3ECE8] group-hover:translate-x-1'
              }`}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </button>
  );
};
