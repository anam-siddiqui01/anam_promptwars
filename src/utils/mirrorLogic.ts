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

export const PRIMARY_GEMMA_MODEL = 'gemma-4-26b-a4b-it';
export const FALLBACK_GEMMA_MODEL = 'gemma-4-31b-it';

export const GEMMA_MODEL_CANDIDATES = [
  PRIMARY_GEMMA_MODEL,
  FALLBACK_GEMMA_MODEL,
] as const;

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

export interface SynthesisPayload {
  beforeReasons: string[];
  afterSynthesis: string;
  keyShifts: string[];
  openInformationNeeds: string[];
}

/**
 * Strict AI Safety & Non-Prescriptive Alignment Rules.
 * The AI must NEVER recommend an option, tell the user what to choose,
 * or present itself as the decision-maker.
 */
export const STRICT_FORBIDDEN_ADVICE_CHECK =
  /\b(you should|you shouldn't|you should not|the best choice is|the best option is|the best decision is|i strongly recommend|i recommend|my recommendation is|my advice is|you must choose|you need to choose|i suggest you choose|choose gate|prioritize placements|gate is better|placements are safer)\b/i;

export function containsPrescriptiveAdvice(text: string): boolean {
  return STRICT_FORBIDDEN_ADVICE_CHECK.test(text);
}

export const containsPrescriptiveLanguage = containsPrescriptiveAdvice;

export function sanitizeAndAlignText(
  raw: unknown,
  fieldName: string,
  maxLength: number,
  stats: { transformationsApplied: number } = { transformationsApplied: 0 }
): string {
  if (typeof raw !== 'string') {
    throw new Error(`Invalid field "${fieldName}": expected string.`);
  }
  let text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) {
    throw new Error(`Invalid field "${fieldName}": string cannot be empty.`);
  }

  if (STRICT_FORBIDDEN_ADVICE_CHECK.test(text)) {
    throw new Error(
      `Alignment rejection in "${fieldName}": output contained prohibited recommendation or directive advice.`
    );
  }

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength - 1).trimEnd()}…`;
    stats.transformationsApplied += 1;
  }

  return text;
}

export function extractJsonPayload(rawText: string): unknown {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new Error('Model response text is empty.');
  }

  const trimmed = rawText.trim();
  const strippedFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(strippedFence);
  } catch {
    const firstBrace = strippedFence.indexOf('{');
    const lastBrace = strippedFence.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = strippedFence.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error('Unable to parse valid JSON object from model response.');
  }
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

  if (
    obj.assumptions.length === 0 ||
    obj.assumptions.length > MAX_ASSUMPTIONS
  ) {
    throw new Error(
      `Invalid item count for "assumptions": expected 1 to ${MAX_ASSUMPTIONS}, received ${obj.assumptions.length}.`
    );
  }
  if (
    obj.missingFactors.length === 0 ||
    obj.missingFactors.length > MAX_MISSING_FACTORS
  ) {
    throw new Error(
      `Invalid item count for "missingFactors": expected 1 to ${MAX_MISSING_FACTORS}, received ${obj.missingFactors.length}.`
    );
  }
  if (
    obj.perspectives.length === 0 ||
    obj.perspectives.length > MAX_PERSPECTIVES
  ) {
    throw new Error(
      `Invalid item count for "perspectives": expected 1 to ${MAX_PERSPECTIVES}, received ${obj.perspectives.length}.`
    );
  }
  if (
    obj.evidenceGaps.length === 0 ||
    obj.evidenceGaps.length > MAX_EVIDENCE_GAPS
  ) {
    throw new Error(
      `Invalid item count for "evidenceGaps": expected 1 to ${MAX_EVIDENCE_GAPS}, received ${obj.evidenceGaps.length}.`
    );
  }
  if (obj.probes.length === 0 || obj.probes.length > MAX_PROBES) {
    throw new Error(
      `Invalid item count for "probes": expected 1 to ${MAX_PROBES}, received ${obj.probes.length}.`
    );
  }

  const assumptions: AssumptionItem[] = obj.assumptions.map((item, idx) => {
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

  const missingFactors: MissingFactorItem[] = obj.missingFactors.map(
    (item, idx) => {
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
    }
  );

  const perspectives: PerspectiveItem[] = obj.perspectives.map((item, idx) => {
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

  const evidenceGaps: EvidenceGapItem[] = obj.evidenceGaps.map((item, idx) => {
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

  const probes: string[] = obj.probes.map((probe, idx) =>
    sanitizeAndAlignText(probe, `probes[${idx}]`, MAX_BODY_LENGTH, stats)
  );

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

export function validateAndSanitizeSynthesisOutput(rawPayload: unknown): {
  data: SynthesisPayload;
  transformationsApplied: number;
} {
  if (
    typeof rawPayload !== 'object' ||
    rawPayload === null ||
    Array.isArray(rawPayload)
  ) {
    throw new Error('Synthesis output is not a valid JSON object.');
  }

  const obj = rawPayload as Record<string, unknown>;
  const stats = { transformationsApplied: 0 };

  if (!Array.isArray(obj.beforeReasons) || obj.beforeReasons.length === 0) {
    throw new Error('Missing or empty "beforeReasons" array.');
  }
  if (obj.beforeReasons.length > 5) {
    throw new Error('Invalid item count for "beforeReasons": maximum is 5.');
  }
  if (!Array.isArray(obj.keyShifts)) {
    throw new Error('Missing or invalid "keyShifts" array.');
  }
  if (!Array.isArray(obj.openInformationNeeds)) {
    throw new Error('Missing or invalid "openInformationNeeds" array.');
  }

  const beforeReasons = obj.beforeReasons.map((item, idx) =>
    sanitizeAndAlignText(item, `beforeReasons[${idx}]`, 160, stats)
  );

  const afterSynthesis = sanitizeAndAlignText(
    obj.afterSynthesis,
    'afterSynthesis',
    600,
    stats
  );

  const keyShifts = obj.keyShifts
    .slice(0, 4)
    .map((item, idx) =>
      sanitizeAndAlignText(item, `keyShifts[${idx}]`, 240, stats)
    );

  const openInformationNeeds = obj.openInformationNeeds
    .slice(0, 5)
    .map((item, idx) =>
      sanitizeAndAlignText(item, `openInformationNeeds[${idx}]`, 240, stats)
    );

  return {
    data: {
      beforeReasons,
      afterSynthesis,
      keyShifts,
      openInformationNeeds,
    },
    transformationsApplied: stats.transformationsApplied,
  };
}

export function validateUserDecisionInput(draft: DecisionDraft): {
  valid: boolean;
  decisionError?: string;
  reasoningError?: string;
} {
  const decision =
    typeof draft.decision === 'string' ? draft.decision.trim() : '';
  const reasoning =
    typeof draft.reasoning === 'string' ? draft.reasoning.trim() : '';

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
    reasoningError =
      'Share the reasoning or considerations behind your current leaning.';
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

export function validateMirrorAnalyzeInput(body: unknown): {
  valid: boolean;
  error?: string;
  decision: string;
  reasoning: string;
  contextList: string[];
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request payload must be a JSON object.',
      decision: '',
      reasoning: '',
      contextList: [],
    };
  }

  const { decision, reasoning, context } = body as Record<string, unknown>;

  if (typeof decision !== 'string' || decision.trim().length < 5) {
    return {
      valid: false,
      error: 'Please provide a clear decision statement (at least 5 characters).',
      decision: '',
      reasoning: '',
      contextList: [],
    };
  }

  if (typeof reasoning !== 'string' || reasoning.trim().length < 15) {
    return {
      valid: false,
      error:
        'Please provide your reasoning (at least 15 characters) so it can be examined.',
      decision: decision.trim(),
      reasoning: '',
      contextList: [],
    };
  }

  const contextList: string[] = Array.isArray(context)
    ? context.filter(
        (c): c is string => typeof c === 'string' && c.trim().length > 0
      )
    : [];

  return {
    valid: true,
    decision: decision.trim(),
    reasoning: reasoning.trim(),
    contextList,
  };
}

/**
 * Reasoning-grounded fallback generator used ONLY if Gemma inference is
 * unavailable or returns malformed/unsafe output, ensuring schema compliance.
 */
export function buildReasoningGroundedFallbackMirror(
  decision: string,
  reasoning: string,
  contextList: string[] = []
): MirrorAnalysis {
  const combined = `${decision} ${reasoning}`.toLowerCase();
  const isGateOrPlacement =
    combined.includes('gate') && combined.includes('placement');

  if (isGateOrPlacement) {
    return {
      assumptions: [
        {
          title: 'GATE and placements must be mutually exclusive',
          description:
            'Your reasoning frames preparing for GATE 2027 and participating in campus placements as an all-or-nothing choice where focusing on one automatically forfeits the other.',
          question:
            'What makes you believe you need to completely prioritize one path over the other?',
        },
        {
          title:
            'A strong postgraduate institute automatically yields better career outcomes',
          description:
            'You connect getting into an IIT or top institute directly with "better research and career opportunities" without specifying which opportunities require a master’s degree versus industry experience.',
          question:
            'What specific outcome are you expecting from pursuing higher studies, and what makes that outcome valuable to you?',
        },
        {
          title: 'Regret is symmetrical between both paths',
          description:
            'You weigh the fear of missing immediate placement offers against the fear of regretting not attempting GATE, assuming both forms of regret carry the same long-term weight.',
          question:
            'Can GATE be attempted again after gaining work experience, and how does that compare to re-entering entry-level campus placements later?',
        },
      ],
      missingFactors: [
        {
          title: 'What "better career opportunities" actually means to you',
          description:
            'Your reasoning mentions research, higher studies, financial independence, and industry experience, but does not rank which of these matters most in the next two to three years.',
          question:
            'Which matters most to you in the next few years: research, higher studies, financial independence, industry experience, or long-term career flexibility?',
        },
        {
          title: 'Specific GATE target institutes and programs',
          description:
            'You refer generally to "a good IIT or another strong institute" without naming the specific programs, cutoffs, or roles those programs unlock.',
          question:
            'Which institutes, programs, or career paths are you actually targeting through GATE?',
        },
        {
          title: 'Opportunity cost of dedicating the next year to one priority',
          description:
            'Choosing one primary path affects what you give up in interview readiness, project depth, or exam rank.',
          question:
            'What would you give up by spending the next year primarily preparing for GATE, and what would you give up by primarily pursuing placements?',
        },
      ],
      perspectives: [
        {
          perspective: 'Your future self two years after graduation',
          description:
            'Looking back from 2028, your future self will experience the daily reality of either a postgraduate research program or a full-time industry role.',
          question:
            'Which choice might your future self regret more, and what makes you think that?',
        },
        {
          perspective:
            'A peer or mentor who has seen both campus placements and GATE outcomes',
          description:
            'Someone familiar with your department’s actual placement roles and GATE overlap may see shared preparation areas you are currently treating as separate.',
          question:
            'How much overlap exists between core technical subjects tested in GATE and the technical interviews in your target campus placements?',
        },
      ],
      evidenceGaps: [
        {
          claim:
            'Focusing on GATE will cause you to miss realistic campus placement opportunities',
          question:
            'What concrete opportunities would you realistically have through campus placements compared with the opportunities you are targeting through GATE?',
        },
        {
          claim:
            'Your current time and workload cannot support a structured baseline for both',
          question:
            'What evidence do you have that your current time, preparation level, and academic workload are sufficient for the outcome you want?',
        },
      ],
      probes: [
        'What makes you believe you need to completely prioritize one path over the other?',
        'Which matters most to you in the next few years: research, higher studies, financial independence, industry experience, or long-term career flexibility?',
        'Which institutes, programs, or career paths are you actually targeting through GATE?',
        'What evidence do you have that your current time, preparation level, and academic workload are sufficient for the outcome you want?',
        'What would you give up by spending the next year primarily preparing for GATE, and what would you give up by primarily pursuing placements?',
      ],
    };
  }

  const contextTag = contextList[0] ? contextList[0].toLowerCase() : 'decision';
  return {
    assumptions: [
      {
        title: 'The options are strictly binary and cannot be staged',
        description: `Your reasoning around "${decision.slice(0, 80)}" treats the choice as an immediate all-or-nothing commitment without intermediate steps.`,
        question:
          'What makes you believe you must commit fully to one side right now without testing a smaller reversible step first?',
      },
      {
        title: 'Expected upsides will materialize on the assumed timeline',
        description:
          'You connect your preferred path directly to its best-case outcome without examining the conditions required for that outcome to happen.',
        question:
          'What specific conditions would need to hold true over the next 6 to 12 months for your expected outcome to actually occur?',
      },
      {
        title: 'Current constraints will remain fixed',
        description: `Your ${contextTag} considerations assume your current constraints cannot be renegotiated or restructured.`,
        question:
          'Which constraint in your reasoning is a hard boundary, and which is an unverified assumption?',
      },
    ],
    missingFactors: [
      {
        title: 'Clear definition of success criteria',
        description:
          'Your reasoning names multiple competing priorities without establishing which single criterion carries the most weight if they conflict.',
        question:
          'If you could only optimize for one outcome over the next year, which factor in your reasoning would take precedence?',
      },
      {
        title: 'Second-order opportunity cost',
        description:
          'Focusing on the most visible benefit leaves out what you might quietly give up in bandwidth, energy, or alternative paths.',
        question:
          'What hidden cost or forfeited option would accompany your current leaning over the next year?',
      },
      {
        title: 'Reversibility and exit cost',
        description:
          'Your reasoning does not compare how difficult it would be to change course six months after making this choice.',
        question:
          'If this choice turns out differently than you expect after six months, what would it take to adjust course?',
      },
    ],
    perspectives: [
      {
        perspective: 'Your future self one year from now',
        description:
          'Once the initial urgency fades, your future self will live with the day-to-day tradeoffs rather than the abstract headline of the choice.',
        question:
          'Looking back a year from now, which unexamined tradeoff in your reasoning is most likely to feel heavier than it does today?',
      },
      {
        perspective: 'Someone affected by your bandwidth and commitments',
        description:
          'People around you may notice practical workload or schedule impacts that are not yet visible in your internal framing.',
        question:
          'How might someone close to your day-to-day routine describe the realistic demands of this choice?',
      },
    ],
    evidenceGaps: [
      {
        claim:
          'The primary benefit you are counting on is guaranteed by choosing this option',
        question:
          'What concrete evidence do you have right now—beyond general expectation—that this option will deliver the specific result you want?',
      },
      {
        claim:
          'Your current capacity and timeline are sufficient for the demands involved',
        question:
          'What evidence do you have that your available time, energy, and resources match what this path actually requires?',
      },
    ],
    probes: [
      'What makes you believe the options in your reasoning are mutually exclusive?',
      'Which outcome in your reasoning matters most to you over the next two years, and why?',
      'What concrete evidence would falsify your biggest assumption about this decision?',
      'What would you give up by committing to your current leaning for the next year?',
    ],
  };
}

export function buildReasoningGroundedFallbackSynthesis(
  decision: string,
  reasoning: string,
  reflections: Array<Record<string, unknown>> = []
): SynthesisPayload {
  const combined = `${decision} ${reasoning}`.toLowerCase();
  const isGateOrPlacement =
    combined.includes('gate') && combined.includes('placement');

  const needInfoItems = reflections
    .filter((r) => r.needsMoreInfo === true || r.state === 'NEEDS_INFO')
    .map((r) =>
      typeof r.question === 'string' && r.question.trim().length > 0
        ? r.question.trim()
        : typeof r.title === 'string'
        ? r.title.trim()
        : ''
    )
    .filter(Boolean);

  if (isGateOrPlacement) {
    return {
      beforeReasons: [
        'GATE 2027 could open higher studies and research opportunities at an IIT or top institute',
        'Campus placements provide immediate financial independence and industry experience',
        'Fear that focusing on one path means losing out on the other given limited time',
      ],
      afterSynthesis:
        'I was treating the two options as mutually exclusive and hadn’t clearly defined what outcome I actually value most. I also hadn’t investigated my realistic preparation capacity or specific GATE targets.',
      keyShifts: [
        'Moved from treating GATE and placements as strictly mutually exclusive to examining where preparation and participation can overlap',
        'Recognized that "better career opportunities" was undefined across research, financial independence, and industry experience',
        'Identified concrete evidence gaps around target GATE programs and realistic weekly preparation capacity',
      ],
      openInformationNeeds:
        needInfoItems.length > 0
          ? needInfoItems.slice(0, 4)
          : [
              'Which matters most to you in the next few years: research, higher studies, financial independence, industry experience, or long-term career flexibility?',
              'Which institutes, programs, or career paths are you actually targeting through GATE?',
              'What evidence do you have that your current time, preparation level, and academic workload are sufficient for the outcome you want?',
            ],
    };
  }

  const clauses = reasoning
    .split(/(?:[.;?!]|\b(?:because|since|however|though|while)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .slice(0, 3);

  const writtenNotes = reflections
    .map((r) => (typeof r.response === 'string' ? r.response.trim() : ''))
    .filter((s) => s.length > 0);

  return {
    beforeReasons:
      clauses.length > 0 ? clauses : [reasoning.trim().slice(0, 140)],
    afterSynthesis:
      writtenNotes.length > 0
        ? `${writtenNotes.slice(0, 2).join(' ')}`
        : 'I realized that several premises I initially treated as settled still require concrete verification before I commit to a final direction.',
    keyShifts: [
      'Separated initial visible appeal from unverified assumptions',
      'Identified specific questions and evidence gaps that need investigation before deciding',
    ],
    openInformationNeeds:
      needInfoItems.length > 0
        ? needInfoItems.slice(0, 4)
        : [
            'What concrete evidence would verify the core assumption in my reasoning?',
          ],
  };
}

/**
 * Validates raw AI output or falls back safely to a schema-verified,
 * reasoning-grounded MirrorAnalysis if the AI output is malformed or unsafe.
 */
export function resolveMirrorOutputWithFallback(
  rawInput: unknown,
  decision: string,
  reasoning: string,
  contextList: string[] = []
): {
  data: MirrorAnalysis;
  transformationsApplied: number;
  usedFallback: boolean;
} {
  try {
    const parsed =
      typeof rawInput === 'string' ? extractJsonPayload(rawInput) : rawInput;
    const validated = validateAndSanitizeMirrorOutput(parsed);
    return {
      ...validated,
      usedFallback: false,
    };
  } catch {
    const fallback = buildReasoningGroundedFallbackMirror(
      decision,
      reasoning,
      contextList
    );
    const validatedFallback = validateAndSanitizeMirrorOutput(fallback);
    return {
      ...validatedFallback,
      usedFallback: true,
    };
  }
}

export function resolveSynthesisOutputWithFallback(
  rawInput: unknown,
  decision: string,
  reasoning: string,
  reflections: Array<Record<string, unknown>> = []
): {
  data: SynthesisPayload;
  transformationsApplied: number;
  usedFallback: boolean;
} {
  try {
    const parsed =
      typeof rawInput === 'string' ? extractJsonPayload(rawInput) : rawInput;
    const validated = validateAndSanitizeSynthesisOutput(parsed);
    return {
      ...validated,
      usedFallback: false,
    };
  } catch {
    const fallback = buildReasoningGroundedFallbackSynthesis(
      decision,
      reasoning,
      reflections
    );
    const validatedFallback = validateAndSanitizeSynthesisOutput(fallback);
    return {
      ...validatedFallback,
      usedFallback: true,
    };
  }
}

export function canTransitionToPhase(
  targetPhase: PhaseNumber,
  session: DecisionSession | null
): boolean {
  if (targetPhase === 1) return true;
  if (!session || !session.mirrorAnalysis) return false;
  if (targetPhase === 2 || targetPhase === 3) return true;
  if (targetPhase === 4) {
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
    const isNeedInfo =
      Boolean(item.needsMoreInfo) || item.state === 'NEEDS_INFO';
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

  cleaned = cleaned
    .replace(/^ask\s+([^.?!]+)[.?!]?$/i, 'What could you learn by asking $1?')
    .replace(/^verify\s+([^.?!]+)[.?!]?$/i, 'How will you verify $1?')
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
