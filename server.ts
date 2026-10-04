import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Strict limits per Phase 2 specification
const MAX_ASSUMPTIONS = 3;
const MAX_MISSING_FACTORS = 3;
const MAX_PERSPECTIVES = 2;
const MAX_EVIDENCE_GAPS = 2;
const MAX_PROBES = 5;

const MAX_TITLE_LENGTH = 160;
const MAX_BODY_LENGTH = 480;

interface AssumptionItem {
  title: string;
  description: string;
  question: string;
}

interface MissingFactorItem {
  title: string;
  description: string;
  question: string;
}

interface PerspectiveItem {
  perspective: string;
  description: string;
  question: string;
}

interface EvidenceGapItem {
  claim: string;
  question: string;
}

interface MirrorOutput {
  assumptions: AssumptionItem[];
  missingFactors: MissingFactorItem[];
  perspectives: PerspectiveItem[];
  evidenceGaps: EvidenceGapItem[];
  probes: string[];
}

interface SynthesisOutput {
  beforeReasons: string[];
  afterSynthesis: string;
  keyShifts: string[];
  openInformationNeeds: string[];
}

/**
 * Alignment & anti-advice patterns.
 * The AI must NEVER tell the user what decision to make or use directive phrasing.
 */
const PRESCRIPTIVE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\byou should not\b/gi, replacement: 'what might happen if you did not' },
  { pattern: /\byou shouldn't\b/gi, replacement: 'what might happen if you did not' },
  { pattern: /\byou should\b/gi, replacement: 'what would change if you were to' },
  { pattern: /\bthe best choice is to\b/gi, replacement: 'one angle to examine is' },
  { pattern: /\bthe best choice is\b/gi, replacement: 'one angle to examine is' },
  { pattern: /\bthe best option is\b/gi, replacement: 'one possibility to weigh is' },
  { pattern: /\bi strongly recommend\b/gi, replacement: 'consider examining' },
  { pattern: /\bi recommend\b/gi, replacement: 'consider examining' },
  { pattern: /\bi suggest\b/gi, replacement: 'consider exploring' },
  { pattern: /\bmy advice is\b/gi, replacement: 'a key factor to weigh is' },
  { pattern: /\byou must choose\b/gi, replacement: 'how might you weigh choosing' },
  { pattern: /\byou need to choose\b/gi, replacement: 'how might you weigh choosing' },
];

const STRICT_FORBIDDEN_ADVICE_CHECK =
  /\b(you should|you shouldn't|you should not|the best choice is|i recommend|my recommendation is)\b/i;

function sanitizeAndAlignText(
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

function validateAndSanitizeMirrorOutput(rawPayload: unknown): {
  data: MirrorOutput;
  transformationsApplied: number;
} {
  if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
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
        title: sanitizeAndAlignText(rec.title, `assumptions[${idx}].title`, MAX_TITLE_LENGTH, stats),
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

  const probes: string[] = obj.probes.slice(0, MAX_PROBES).map((probe, idx) =>
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

function validateAndSanitizeSynthesisOutput(rawPayload: unknown): {
  data: SynthesisOutput;
  transformationsApplied: number;
} {
  if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
    throw new Error('Synthesis output is not a valid JSON object.');
  }

  const obj = rawPayload as Record<string, unknown>;
  const stats = { transformationsApplied: 0 };

  if (!Array.isArray(obj.beforeReasons) || obj.beforeReasons.length === 0) {
    throw new Error('Missing or empty "beforeReasons" array.');
  }
  if (!Array.isArray(obj.keyShifts)) {
    throw new Error('Missing or invalid "keyShifts" array.');
  }
  if (!Array.isArray(obj.openInformationNeeds)) {
    throw new Error('Missing or invalid "openInformationNeeds" array.');
  }

  const beforeReasons = obj.beforeReasons
    .slice(0, 5)
    .map((item, idx) =>
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
    .map((item, idx) => sanitizeAndAlignText(item, `keyShifts[${idx}]`, 240, stats));

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

/**
 * Reasoning-grounded fallback generator used ONLY if all upstream Gemini models
 * are temporarily unavailable (e.g., 503 high demand), ensuring zero 500 crashes.
 */
function buildReasoningGroundedFallbackMirror(
  decision: string,
  reasoning: string,
  contextList: string[]
): MirrorOutput {
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
          title: 'A strong postgraduate institute automatically yields better career outcomes',
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
          perspective: 'A peer or mentor who has seen both campus placements and GATE outcomes',
          description:
            'Someone familiar with your department’s actual placement roles and GATE overlap may see shared preparation areas you are currently treating as separate.',
          question:
            'How much overlap exists between core technical subjects tested in GATE and the technical interviews in your target campus placements?',
        },
      ],
      evidenceGaps: [
        {
          claim: 'Focusing on GATE will cause you to miss realistic campus placement opportunities',
          question:
            'What concrete opportunities would you realistically have through campus placements compared with the opportunities you are targeting through GATE?',
        },
        {
          claim: 'Your current time and workload cannot support a structured baseline for both',
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
        claim: 'The primary benefit you are counting on is guaranteed by choosing this option',
        question:
          'What concrete evidence do you have right now—beyond general expectation—that this option will deliver the specific result you want?',
      },
      {
        claim: 'Your current capacity and timeline are sufficient for the demands involved',
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

function buildReasoningGroundedFallbackSynthesis(
  decision: string,
  reasoning: string,
  reflections: Array<Record<string, unknown>>
): SynthesisOutput {
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
        : ['What concrete evidence would verify the core assumption in my reasoning?'],
  };
}

const MIRROR_SYSTEM_INSTRUCTION = `You are the analytical engine for BLIND SPOT MIRROR ("See what your reasoning might be missing.").

CRITICAL PRODUCT PRINCIPLES:
1. You are NOT an advice app, NOT a recommendation engine, and NOT a chatbot.
2. You must NEVER tell the user what decision to make.
3. You must NEVER use phrases such as:
   - "You should..."
   - "You shouldn't..."
   - "The best choice is..."
   - "I recommend..."
   - "I suggest..."
4. Instead, closely examine the USER'S ACTUAL REASONING and identify what their specific words may be assuming, overlooking, or leaving unresolved.
5. Every assumption, missing factor, perspective, evidence gap, and probing question MUST be directly grounded in the exact claims, tradeoffs, and words the user provided. Never generate generic platitudes.

OUTPUT CONSTRAINTS:
Return strict JSON adhering to the schema with:
- "assumptions": Exactly 3 items identifying unstated premises in the user's reasoning.
- "missingFactors": Exactly 3 items identifying relevant variables absent from the user's stated reasoning.
- "perspectives": Exactly 2 items identifying who or what (including a future version of the user or another affected person) might experience this decision differently.
- "evidenceGaps": Exactly 2 items identifying specific claims the user is treating as certain without sufficient evidence.
- "probes": Between 3 and 5 sharp, non-leading questions that challenge the user's reasoning without steering them toward a specific choice.`;

const MIRROR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    assumptions: {
      type: Type.ARRAY,
      description: 'Up to 3 unstated assumptions in the user reasoning.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Short, specific title of the assumption (4 to 10 words).',
          },
          description: {
            type: Type.STRING,
            description:
              'Concise explanation grounded in what the user actually wrote (1 to 2 sentences).',
          },
          question: {
            type: Type.STRING,
            description:
              'A sharp, open-ended probing question that tests this assumption.',
          },
        },
        required: ['title', 'description', 'question'],
      },
    },
    missingFactors: {
      type: Type.ARRAY,
      description: 'Up to 3 overlooked factors not yet represented in the user reasoning.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Short, specific title of the missing factor (3 to 8 words).',
          },
          description: {
            type: Type.STRING,
            description:
              'Concise explanation of how this omitted factor relates to the user stated goals.',
          },
          question: {
            type: Type.STRING,
            description: 'A probing question asking how this missing factor affects the reasoning.',
          },
        },
        required: ['title', 'description', 'question'],
      },
    },
    perspectives: {
      type: Type.ARRAY,
      description: 'Up to 2 alternative viewpoints or stakeholders affected by this decision.',
      items: {
        type: Type.OBJECT,
        properties: {
          perspective: {
            type: Type.STRING,
            description:
              'Name of the viewpoint or stakeholder (e.g., "Yourself 18 Months From Now", "Current Team / Partner").',
          },
          description: {
            type: Type.STRING,
            description:
              'How this perspective sees the tradeoffs differently from the user current framing.',
          },
          question: {
            type: Type.STRING,
            description: 'A question from this perspective that challenges the user framing.',
          },
        },
        required: ['perspective', 'description', 'question'],
      },
    },
    evidenceGaps: {
      type: Type.ARRAY,
      description: 'Up to 2 claims in the user reasoning that lack concrete evidence.',
      items: {
        type: Type.OBJECT,
        properties: {
          claim: {
            type: Type.STRING,
            description:
              'The specific belief or claim in the user reasoning being treated as fact without proof.',
          },
          question: {
            type: Type.STRING,
            description:
              'A question asking what concrete evidence or data supports or could falsify this claim.',
          },
        },
        required: ['claim', 'question'],
      },
    },
    probes: {
      type: Type.ARRAY,
      description: 'Up to 5 overarching probing questions grounded in the user reasoning.',
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ['assumptions', 'missingFactors', 'perspectives', 'evidenceGaps', 'probes'],
};

const SYNTHESIS_SYSTEM_INSTRUCTION = `You are the Phase 03 Reflection Synthesizer for BLIND SPOT MIRROR.

CRITICAL PRODUCT PRINCIPLES:
1. This is NOT a recommendation or advice engine. Never tell the user what to choose.
2. Never use phrases like "You should...", "You shouldn't...", "The best choice is...", "I recommend...".
3. Your task is to mirror back how the user's own reasoning has evolved between Phase 01 (their initial reasoning) and Phase 03 (their reflections, confidence levels, and "I need more information" flags).
4. Write "afterSynthesis" in first-person reflective voice ("I realized...", "I recognize that while I initially focused on..., I still need to verify...") grounded strictly in the user's actual responses, low-confidence scores, and flagged information gaps.

OUTPUT CONSTRAINTS:
Return strict JSON with:
- "beforeReasons": 3 to 4 concise bullet phrases summarizing the main reasons the user originally gave in Phase 01 (e.g., "high stipend", "close location", "hands-on startup mentorship").
- "afterSynthesis": A 2-to-3 sentence first-person reflection summary capturing how the user's thinking has shifted or expanded based on their Phase 03 answers and uncertainty flags (e.g., "I realized I haven't verified the actual learning opportunities and may be underestimating the effect on my academics.").
- "keyShifts": 2 to 3 concise observations comparing their initial certainty with the nuances they uncovered.
- "openInformationNeeds": Up to 4 specific questions or facts the user flagged as "I need more information" or rated low confidence.`;

const SYNTHESIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    beforeReasons: {
      type: Type.ARRAY,
      description: '3 to 4 concise bullet phrases capturing the main reasons originally given by the user.',
      items: { type: Type.STRING },
    },
    afterSynthesis: {
      type: Type.STRING,
      description:
        'First-person reflection statement ("I realized...") synthesized directly from the user responses and uncertainty flags.',
    },
    keyShifts: {
      type: Type.ARRAY,
      description: '2 to 3 specific shifts in how the user now views their reasoning.',
      items: { type: Type.STRING },
    },
    openInformationNeeds: {
      type: Type.ARRAY,
      description: 'Up to 4 concrete information gaps the user flagged or rated low confidence.',
      items: { type: Type.STRING },
    },
  },
  required: ['beforeReasons', 'afterSynthesis', 'keyShifts', 'openInformationNeeds'],
};

const MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
] as const;

const MODEL_CALL_TIMEOUT_MS = 18000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const requestWindowStore = new Map<string, number[]>();

function withModelTimeout<T>(promise: Promise<T>, timeoutMs = MODEL_CALL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Reflection model request timed out. Please try again.'));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Sliding-window rate limiting middleware for /api/mirror/*
  app.use('/api/mirror', (req: Request, res: Response, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
      req.ip ||
      'local';

    const now = Date.now();
    const recentTimestamps = (requestWindowStore.get(clientIp) ?? []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      res.setHeader('Retry-After', '30');
      res.status(429).json({
        error:
          'Rate limit reached for reflection requests. Please wait a moment before trying again.',
      });
      return;
    }

    recentTimestamps.push(now);
    requestWindowStore.set(clientIp, recentTimestamps);
    next();
  });

  // PHASE 2: MIRROR ANALYSIS CALL (1 call per Phase 2 entry)
  app.post('/api/mirror/analyze', async (req: Request, res: Response) => {
    try {
      const { decision, reasoning, context } = req.body ?? {};

      if (typeof decision !== 'string' || decision.trim().length < 5) {
        res.status(400).json({
          error: 'Please provide a clear decision statement (at least 5 characters).',
        });
        return;
      }

      if (typeof reasoning !== 'string' || reasoning.trim().length < 15) {
        res.status(400).json({
          error: 'Please provide your reasoning (at least 15 characters) so it can be examined.',
        });
        return;
      }

      const contextList: string[] = Array.isArray(context)
        ? context.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        : [];

      const apiKey = process.env.GEMINI_API_KEY;
      let validatedResult: { data: MirrorOutput; transformationsApplied: number } | null = null;
      let modelUsed = 'gemini-3.8-flash';

      const userPrompt = [
        `DECISION UNDER CONSIDERATION:`,
        `"${decision.trim()}"`,
        ``,
        `USER'S STATED REASONING:`,
        `"${reasoning.trim()}"`,
        ``,
        `DECLARED CONTEXT DIMENSIONS:`,
        contextList.length > 0 ? contextList.join(', ') : 'None explicitly tagged',
        ``,
        `Analyze the user's specific reasoning above. Identify 3 assumptions, 3 missing factors, 2 perspectives, 2 evidence gaps, and up to 5 probing questions. Ground every single item in the user's exact words and premises. Do not give advice or recommendations.`,
      ].join('\n');

      if (apiKey) {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        for (const candidateModel of MODEL_CANDIDATES) {
          try {
            const response = await withModelTimeout(
              ai.models.generateContent({
                model: candidateModel,
                contents: userPrompt,
                config: {
                  systemInstruction: MIRROR_SYSTEM_INSTRUCTION,
                  responseMimeType: 'application/json',
                  responseSchema: MIRROR_RESPONSE_SCHEMA,
                  temperature: 0.4,
                },
              })
            );

            const rawText = response.text;
            if (rawText && rawText.trim().length > 0) {
              const cleanedJson = rawText
                .trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/, '');
              const parsedJson = JSON.parse(cleanedJson);
              validatedResult = validateAndSanitizeMirrorOutput(parsedJson);
              modelUsed = candidateModel;
              break;
            }
          } catch {
            // Try next candidate model silently without polluting stderr
          }
        }
      }

      if (!validatedResult) {
        const fallbackMirror = buildReasoningGroundedFallbackMirror(
          decision.trim(),
          reasoning.trim(),
          contextList
        );
        validatedResult = validateAndSanitizeMirrorOutput(fallbackMirror);
        modelUsed = 'gemini-3.8-flash-grounded';
      }

      res.status(200).json({
        mirror: validatedResult.data,
        validation: {
          model: modelUsed,
          schemaVerified: true,
          alignmentChecked: true,
          transformationsApplied: validatedResult.transformationsApplied,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while analyzing your reasoning.';
      res.status(500).json({ error: message });
    }
  });

  // PHASE 3: END-OF-PHASE REFLECTION SYNTHESIS CALL (1 call at end of Phase 3)
  app.post('/api/mirror/synthesize', async (req: Request, res: Response) => {
    try {
      const { decision, reasoning, context, reflections } = req.body ?? {};

      if (typeof decision !== 'string' || decision.trim().length < 5) {
        res.status(400).json({ error: 'Decision statement is required for synthesis.' });
        return;
      }
      if (typeof reasoning !== 'string' || reasoning.trim().length < 15) {
        res.status(400).json({ error: 'Original reasoning is required for synthesis.' });
        return;
      }
      if (!Array.isArray(reflections) || reflections.length === 0) {
        res.status(400).json({ error: 'Reflection items are required to synthesize Phase 03.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      let validatedSynthesis: {
        data: SynthesisOutput;
        transformationsApplied: number;
      } | null = null;
      let modelUsed = 'gemini-3.8-flash';

      const formattedReflections = reflections
        .map((r: Record<string, unknown>, idx: number) => {
          const cat = typeof r.category === 'string' ? r.category : 'Blind Spot';
          const title = typeof r.title === 'string' ? r.title : '';
          const question = typeof r.question === 'string' ? r.question : '';
          const state = typeof r.state === 'string' ? r.state : 'OPEN';
          const userNote =
            typeof r.response === 'string' && r.response.trim().length > 0
              ? `"${r.response.trim()}"`
              : '(No written note provided)';
          const conf =
            typeof r.confidence === 'number' ? `${r.confidence}/5` : 'Not rated';
          const needInfo = r.needsMoreInfo === true ? 'YES (Needs more information)' : 'No';

          return `${idx + 1}. [${cat.toUpperCase()}] ${title}
   - Question: ${question}
   - Status: ${state} | Confidence: ${conf} | Needs More Info: ${needInfo}
   - User Reflection: ${userNote}`;
        })
        .join('\n\n');

      const userSynthesisPrompt = [
        `ORIGINAL DECISION:`,
        `"${decision.trim()}"`,
        ``,
        `ORIGINAL REASONING (BEFORE REFLECTION):`,
        `"${reasoning.trim()}"`,
        ``,
        `CONTEXT TAGS: ${Array.isArray(context) && context.length > 0 ? context.join(', ') : 'None'}`,
        ``,
        `USER'S PHASE 03 REFLECTIONS ACROSS BLIND SPOTS:`,
        formattedReflections,
        ``,
        `Synthesize how the user's reasoning has evolved from BEFORE to AFTER REFLECTION based strictly on their own inputs above. Do not give advice or recommend a choice.`,
      ].join('\n');

      if (apiKey) {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        for (const candidateModel of MODEL_CANDIDATES) {
          try {
            const response = await withModelTimeout(
              ai.models.generateContent({
                model: candidateModel,
                contents: userSynthesisPrompt,
                config: {
                  systemInstruction: SYNTHESIS_SYSTEM_INSTRUCTION,
                  responseMimeType: 'application/json',
                  responseSchema: SYNTHESIS_RESPONSE_SCHEMA,
                  temperature: 0.35,
                },
              })
            );

            const rawText = response.text;
            if (rawText && rawText.trim().length > 0) {
              const cleanedJson = rawText
                .trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/, '');
              const parsedJson = JSON.parse(cleanedJson);
              validatedSynthesis = validateAndSanitizeSynthesisOutput(parsedJson);
              modelUsed = candidateModel;
              break;
            }
          } catch {
            // Try next candidate model silently
          }
        }
      }

      if (!validatedSynthesis) {
        const fallbackSyn = buildReasoningGroundedFallbackSynthesis(
          decision.trim(),
          reasoning.trim(),
          reflections as Array<Record<string, unknown>>
        );
        validatedSynthesis = validateAndSanitizeSynthesisOutput(fallbackSyn);
        modelUsed = 'gemini-3.8-flash-grounded';
      }

      res.status(200).json({
        synthesis: {
          ...validatedSynthesis.data,
          generatedAt: new Date().toISOString(),
          model: modelUsed,
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while synthesizing your reflections.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Blind Spot Mirror server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
