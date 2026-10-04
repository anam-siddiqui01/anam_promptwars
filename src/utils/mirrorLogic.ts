import {
  AssumptionItem,
  BlindSpotItemProgress,
  DecisionDraft,
  DecisionSession,
  EvidenceGapItem,
  MirrorAnalysis,
  MissingFactorItem,
  PerspectiveItem,
  PhaseNumber,
  ReflectionSynthesis,
} from '../types/decision';

export const MAX_ASSUMPTIONS = 3;
export const MAX_MISSING_FACTORS = 3;
export const MAX_PERSPECTIVES = 2;
export const MAX_EVIDENCE_GAPS = 2;
export const MAX_PROBES = 5;

export const MAX_TITLE_LENGTH = 160;
export const MAX_BODY_LENGTH = 480;

export type DecisionStance =
  | 'yes'
  | 'no'
  | 'less_certain'
  | 'need_more_info';

export interface StressTestState {
  stance: DecisionStance | null;
  finalConclusion: string;
  completedAt: string | null;
}

/**
 * Alignment & anti-advice patterns.
 * The AI must NEVER tell the user what decision to make or use directive phrasing.
 */
export const PRESCRIPTIVE_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  {
    pattern: /\byou should not\b/gi,
    replacement: 'what might happen if you did not',
  },
  {
    pattern: /\byou shouldn't\b/gi,
    replacement: 'what might happen if you did not',
  },
  {
    pattern: /\byou should\b/gi,
    replacement: 'what would change if you were to',
  },
  {
    pattern: /\bthe best choice is to\b/gi,
    replacement: 'one angle to examine is',
  },
  {
    pattern: /\bthe best choice is\b/gi,
    replacement: 'one angle to examine is',
  },
  {
    pattern: /\bthe best option is\b/gi,
    replacement: 'one possibility to weigh is',
  },
  {
    pattern: /\bi strongly recommend\b/gi,
    replacement: 'consider examining',
  },
  {
    pattern: /\bi recommend\b/gi,
    replacement: 'consider examining',
  },
  {
    pattern: /\bi suggest\b/gi,
    replacement: 'consider exploring',
  },
  {
    pattern: /\bmy advice is\b/gi,
    replacement: 'a key factor to weigh is',
  },
  {
    pattern: /\byou must choose\b/gi,
    replacement: 'how might you weigh choosing',
  },
  {
    pattern: /\byou need to choose\b/gi,
    replacement: 'how might you weigh choosing',
  },
];

export const STRICT_FORBIDDEN_ADVICE_CHECK =
  /\b(you should|you shouldn't|you should not|the best choice is|i recommend|my recommendation is)\b/i;

export function containsPrescriptiveAdvice(text: string): boolean {
  return STRICT_FORBIDDEN_ADVICE_CHECK.test(text);
}

export function sanitizeAndAlignText(
  raw: unknown,
  fieldName: string,
  maxLength: number,
  stats: { transformationsApplied: number }
): string {
  if (typeof raw !== 'string') {
    throw new Error(`Invalid field "${fieldName}": expected string.`);
  }
  let text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) {
    throw new Error(`Invalid field "${fieldName}": string cannot be empty.`);
  }

  for (const rule of PRESCRIPTIVE_REPLACEMENTS) {
    if (rule.pattern.test(text)) {
      text = text.replace(rule.pattern, rule.replacement);
      stats.transformationsApplied += 1;
    }
  }

  if (STRICT_FORBIDDEN_ADVICE_CHECK.test(text)) {
    throw new Error(
      `Alignment rejection in "${fieldName}": output contained directive advice.`
    );
  }

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }

  return text;
}

export function validateAndSanitizeMirrorOutput(rawPayload: unknown): {
  data: MirrorAnalysis;
  transformationsApplied: number;
} {
  if (
    typeof rawPayload !== 'object' ||
    rawPayload === null ||
    Array.isArray(rawPayload)
  ) {
    throw new Error('Model output is not a valid JSON object.');
  }

  const obj = rawPayload as Record<string, unknown>;
  const stats = { transformationsApplied: 0 };

  if (!Array.isArray(obj.assumptions)) {
    throw new Error('Missing or invalid "assumptions" array.');
  }
  if (!Array.isArray(obj.missingFactors)) {
    throw new Error('Missing or invalid "missingFactors" array.');
  }
  if (!Array.isArray(obj.perspectives)) {
    throw new Error('Missing or invalid "perspectives" array.');
  }
  if (!Array.isArray(obj.evidenceGaps)) {
    throw new Error('Missing or invalid "evidenceGaps" array.');
  }
  if (!Array.isArray(obj.probes)) {
    throw new Error('Missing or invalid "probes" array.');
  }

  const assumptions: AssumptionItem[] = obj.assumptions
    .slice(0, MAX_ASSUMPTIONS)
    .map((item, idx) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Invalid assumption item at index ${idx}.`);
      }
      const rec = item as Record<string, unknown>;
      return {
        title: sanitizeAndAlignText(
          rec.title,
          `assumptions[${idx}].title`,
          MAX_TITLE_LENGTH,
          stats
        ),
        description: sanitizeAndAlignText(
          rec.description,
          `assumptions[${idx}].description`,
          MAX_BODY_LENGTH,
          stats
        ),
        question: sanitizeAndAlignText(
          rec.question,
          `assumptions[${idx}].question`,
          MAX_BODY_LENGTH,
          stats
        ),
      };
    });

  const missingFactors: MissingFactorItem[] = obj.missingFactors
    .slice(0, MAX_MISSING_FACTORS)
    .map((item, idx) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Invalid missingFactor item at index ${idx}.`);
      }
      const rec = item as Record<string, unknown>;
      return {
        title: sanitizeAndAlignText(
          rec.title,
          `missingFactors[${idx}].title`,
          MAX_TITLE_LENGTH,
          stats
        ),
        description: sanitizeAndAlignText(
          rec.description,
          `missingFactors[${idx}].description`,
          MAX_BODY_LENGTH,
          stats
        ),
        question: sanitizeAndAlignText(
          rec.question,
          `missingFactors[${idx}].question`,
          MAX_BODY_LENGTH,
          stats
        ),
      };
    });

  const perspectives: PerspectiveItem[] = obj.perspectives
    .slice(0, MAX_PERSPECTIVES)
    .map((item, idx) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Invalid perspective item at index ${idx}.`);
      }
      const rec = item as Record<string, unknown>;
      return {
        perspective: sanitizeAndAlignText(
          rec.perspective,
          `perspectives[${idx}].perspective`,
          MAX_TITLE_LENGTH,
          stats
        ),
        description: sanitizeAndAlignText(
          rec.description,
          `perspectives[${idx}].description`,
          MAX_BODY_LENGTH,
          stats
        ),
        question: sanitizeAndAlignText(
          rec.question,
          `perspectives[${idx}].question`,
          MAX_BODY_LENGTH,
          stats
        ),
      };
    });

  const evidenceGaps: EvidenceGapItem[] = obj.evidenceGaps
    .slice(0, MAX_EVIDENCE_GAPS)
    .map((item, idx) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Invalid evidenceGap item at index ${idx}.`);
      }
      const rec = item as Record<string, unknown>;
      return {
        claim: sanitizeAndAlignText(
          rec.claim,
          `evidenceGaps[${idx}].claim`,
          MAX_BODY_LENGTH,
          stats
        ),
        question: sanitizeAndAlignText(
          rec.question,
          `evidenceGaps[${idx}].question`,
          MAX_BODY_LENGTH,
          stats
        ),
      };
    });

  const probes: string[] = obj.probes
    .slice(0, MAX_PROBES)
    .map((probe, idx) =>
      sanitizeAndAlignText(probe, `probes[${idx}]`, MAX_BODY_LENGTH, stats)
    );

  if (
    assumptions.length === 0 ||
    missingFactors.length === 0 ||
    perspectives.length === 0 ||
    evidenceGaps.length === 0 ||
    probes.length === 0
  ) {
    throw new Error('Model returned one or more empty blind spot categories.');
  }

  return {
    data: {
      assumptions,
      missingFactors,
      perspectives,
      evidenceGaps,
      probes,
    },
    transformationsApplied: stats.transformationsApplied,
  };
}

export function validateUserDecisionInput(draft: DecisionDraft): {
  valid: boolean;
  decisionError?: string;
  reasoningError?: string;
} {
  const decision = typeof draft.decision === 'string' ? draft.decision.trim() : '';
  const reasoning = typeof draft.reasoning === 'string' ? draft.reasoning.trim() : '';

  let decisionError: string | undefined;
  let reasoningError: string | undefined;

  if (decision.length === 0) {
    decisionError = 'Please state the decision you are considering.';
  } else if (decision.length < 8) {
    decisionError = 'Add a bit more specificity (at least 8 characters).';
  } else if (draft.decision.length > 240) {
    decisionError = 'Keep the decision question concise (under 240 characters).';
  }

  if (reasoning.length === 0) {
    reasoningError = 'Share the reasoning or considerations behind your current leaning.';
  } else if (reasoning.length < 20) {
    reasoningError =
      'Write at least a sentence or two (20+ characters) so the mirror has reasoning to examine.';
  } else if (draft.reasoning.length > 3000) {
    reasoningError = 'Reasoning exceeds the 3000 character limit.';
  }

  return {
    valid: !decisionError && !reasoningError,
    decisionError,
    reasoningError,
  };
}

export function canTransitionToPhase(
  targetPhase: PhaseNumber,
  session: DecisionSession | null
): boolean {
  if (targetPhase === 1) return true;
  if (!session || !session.mirrorAnalysis) return false;
  if (targetPhase === 2 || targetPhase === 3) return true;
  if (targetPhase === 4) {
    // Phase 4 is accessible once the user has entered Phase 3 or engaged with blind spots
    const progressItems = session.blindSpotProgress
      ? Object.values(session.blindSpotProgress)
      : [];
    const engagedCount = progressItems.filter(
      (p) =>
        p.explored ||
        p.state !== 'OPEN' ||
        p.response.trim().length > 0 ||
        p.confidence != null ||
        p.needsMoreInfo ||
        p.skipped
    ).length;
    return session.currentPhase >= 3 || engagedCount >= 1;
  }
  return false;
}

export interface ReflectionCompletionMetrics {
  totalIdentified: number;
  exploredCount: number;
  addressedCount: number;
  stillUncertainCount: number;
  newConsiderationsCount: number;
  unresolvedCount: number;
  canCompleteReflection: boolean;
}

export function computeReflectionMetrics(
  mirror: MirrorAnalysis | undefined,
  progressMap: Record<string, BlindSpotItemProgress> | undefined,
  synthesis?: ReflectionSynthesis,
  finalConclusion?: string
): ReflectionCompletionMetrics {
  if (!mirror) {
    return {
      totalIdentified: 0,
      exploredCount: 0,
      addressedCount: 0,
      stillUncertainCount: 0,
      newConsiderationsCount: 0,
      unresolvedCount: 0,
      canCompleteReflection: false,
    };
  }

  const totalIdentified =
    mirror.assumptions.length +
    mirror.missingFactors.length +
    mirror.perspectives.length +
    mirror.evidenceGaps.length;

  const items = progressMap ? Object.values(progressMap) : [];

  let exploredCount = 0;
  let addressedCount = 0;
  let stillUncertainCount = 0;
  let writtenNotesCount = 0;

  for (const item of items) {
    const isAddr = item.state === 'ADDRESSED';
    const isNeedInfo = Boolean(item.needsMoreInfo) || item.state === 'NEEDS_INFO';
    const isLowConf = item.confidence != null && item.confidence <= 2;
    const hasNote = item.response.trim().length > 0;
    const isExplored =
      item.explored ||
      isAddr ||
      isNeedInfo ||
      Boolean(item.skipped) ||
      hasNote ||
      item.confidence != null;

    if (isExplored) {
      exploredCount += 1;
    }
    if (isAddr) {
      addressedCount += 1;
    }
    if (isNeedInfo || isLowConf || (!isAddr && isExplored)) {
      stillUncertainCount += 1;
    }
    if (hasNote) {
      writtenNotesCount += 1;
    }
  }

  const synthesisShifts = synthesis?.keyShifts?.length ?? 0;
  const newConsiderationsCount = Math.max(
    writtenNotesCount + synthesisShifts,
    exploredCount > 0 ? Math.min(exploredCount, 3) : 0
  );

  const unresolvedCount = Math.max(0, totalIdentified - addressedCount);
  const hasConclusion =
    typeof finalConclusion === 'string' && finalConclusion.trim().length >= 5;

  return {
    totalIdentified,
    exploredCount,
    addressedCount,
    stillUncertainCount,
    newConsiderationsCount,
    unresolvedCount,
    canCompleteReflection: hasConclusion,
  };
}

/**
 * Ensures every item in "Questions worth investigating" is phrased strictly as an
 * open inquiry ending with "?" rather than a directive recommendation.
 */
export function ensureInquiryQuestionFormat(rawText: string): string {
  let cleaned = rawText.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  // Transform imperative starts like "Ask the company about..." into a reflective question
  cleaned = cleaned
    .replace(/^ask\s+([^.?!]+)[.?!]?$/i, 'What could you learn by asking $1?')
    .replace(
      /^verify\s+([^.?!]+)[.?!]?$/i,
      'How will you verify $1?'
    )
    .replace(
      /^check\s+([^.?!]+)[.?!]?$/i,
      'What evidence would help you check $1?'
    )
    .replace(
      /^talk to\s+([^.?!]+)[.?!]?$/i,
      'What perspective might emerge if you spoke with $1?'
    );

  if (!cleaned.endsWith('?')) {
    cleaned = `${cleaned.replace(/[.!]+$/, '')}?`;
  }
  return cleaned;
}
