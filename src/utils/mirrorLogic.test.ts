import { describe, expect, it } from 'vitest';
import {
  buildReasoningGroundedFallbackMirror,
  buildReasoningGroundedFallbackSynthesis,
  canTransitionToPhase,
  computeReflectionMetrics,
  containsPrescriptiveAdvice,
  ensureInquiryQuestionFormat,
  extractJsonPayload,
  FALLBACK_GEMMA_MODEL,
  GEMMA_MODEL_CANDIDATES,
  PRIMARY_GEMMA_MODEL,
  resolveMirrorOutputWithFallback,
  resolveSynthesisOutputWithFallback,
  sanitizeAndAlignText,
  validateAndSanitizeMirrorOutput,
  validateAndSanitizeSynthesisOutput,
  validateMirrorAnalyzeInput,
  validateUserDecisionInput,
} from './mirrorLogic';
import { DecisionSession, MirrorAnalysis } from '../types/decision';

const VALID_SAMPLE_MIRROR: MirrorAnalysis = {
  assumptions: [
    {
      title: 'Both paths must be treated as mutually exclusive',
      description:
        'Your reasoning assumes that preparing for GATE 2027 prevents you from participating effectively in campus placements.',
      question:
        'What makes you believe you need to completely prioritize one path over the other?',
    },
    {
      title: 'Higher studies automatically unlock better career outcomes',
      description:
        'You link admission to a strong institute directly to superior opportunities without defining which roles require an M.Tech.',
      question:
        'What specific outcome are you expecting from pursuing higher studies, and what makes that outcome valuable to you?',
    },
    {
      title: 'Preparation timelines have zero overlap',
      description:
        'You treat core computer science exam preparation and technical interview preparation as separate workloads.',
      question:
        'Where do your core subject strengths already support both options?',
    },
  ],
  missingFactors: [
    {
      title: 'Ranking of 3-year career priorities',
      description:
        'Your reasoning mentions research, financial independence, and industry experience without establishing which matters most right now.',
      question:
        'Which matters most to you in the next few years: research, higher studies, financial independence, or industry experience?',
    },
    {
      title: 'Specific GATE target institutes and programs',
      description:
        'You mention a good IIT or strong institute broadly without identifying target cutoffs or specializations.',
      question:
        'Which institutes, programs, or career paths are you actually targeting through GATE?',
    },
    {
      title: 'Opportunity cost of a single-track year',
      description:
        'Committing exclusively to one track carries distinct tradeoffs in income, momentum, or academic depth.',
      question:
        'What would you give up by spending the next year primarily preparing for GATE, and what would you give up by primarily pursuing placements?',
    },
  ],
  perspectives: [
    {
      perspective: 'Your future self two years after graduation',
      description:
        'Your future self will live with the day-to-day reality of a research lab or an engineering team rather than the abstract choice.',
      question:
        'Which choice might your future self regret more, and what makes you think that?',
    },
    {
      perspective: 'A mentor familiar with both placements and GATE',
      description:
        'An experienced observer may see ways to stage preparation rather than treating the decision as binary.',
      question:
        'How could you structure a baseline schedule that tests your readiness for both before locking in one priority?',
    },
  ],
  evidenceGaps: [
    {
      claim: 'Focusing on GATE will cause you to lose placement opportunities',
      question:
        'What concrete opportunities would you realistically have through campus placements compared with the opportunities you are targeting through GATE?',
    },
    {
      claim: 'Your current schedule cannot support structured preparation',
      question:
        'What evidence do you have that your current time, preparation level, and academic workload are sufficient for the outcome you want?',
    },
  ],
  probes: [
    'What makes you believe you need to completely prioritize one path over the other?',
    'Which matters most to you in the next few years: research, higher studies, financial independence, industry experience, or long-term career flexibility?',
    'Which institutes, programs, or career paths are you actually targeting through GATE?',
  ],
};

describe('Gemma 4 Model Configuration', () => {
  it('configures gemma-4-26b-a4b-it as primary and gemma-4-31b-it as fallback', () => {
    expect(PRIMARY_GEMMA_MODEL).toBe('gemma-4-26b-a4b-it');
    expect(FALLBACK_GEMMA_MODEL).toBe('gemma-4-31b-it');
    expect(GEMMA_MODEL_CANDIDATES).toEqual([
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
    ]);
  });
});

describe('A. Input Validation', () => {
  it('rejects empty or too-short decision statements', () => {
    const emptyResult = validateUserDecisionInput({
      decision: '   ',
      reasoning:
        'I want to take this role because the mentorship looks strong and the team is small.',
      context: ['Career'],
    });
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.decisionError).toBeDefined();

    const shortResult = validateUserDecisionInput({
      decision: 'Job?',
      reasoning:
        'I want to take this role because the mentorship looks strong and the team is small.',
      context: ['Career'],
    });
    expect(shortResult.valid).toBe(false);
    expect(shortResult.decisionError).toContain('at least 8 characters');

    const apiShortDecision = validateMirrorAnalyzeInput({
      decision: 'Go?',
      reasoning: 'Valid reasoning that is more than fifteen characters long.',
    });
    expect(apiShortDecision.valid).toBe(false);
    expect(apiShortDecision.error).toContain('decision');
  });

  it('rejects empty or too-short reasoning', () => {
    const emptyReasoning = validateUserDecisionInput({
      decision: 'Should I relocate for the new product lead role?',
      reasoning: '',
      context: [],
    });
    expect(emptyReasoning.valid).toBe(false);
    expect(emptyReasoning.reasoningError).toBeDefined();

    const shortReasoning = validateUserDecisionInput({
      decision: 'Should I relocate for the new product lead role?',
      reasoning: 'Because it pays.',
      context: [],
    });
    expect(shortReasoning.valid).toBe(false);
    expect(shortReasoning.reasoningError).toContain('20+ characters');

    const apiShortReasoning = validateMirrorAnalyzeInput({
      decision: 'Should I relocate for the new product lead role?',
      reasoning: 'Too short',
    });
    expect(apiShortReasoning.valid).toBe(false);
    expect(apiShortReasoning.error).toContain('reasoning');
  });

  it('accepts well-formed decision and reasoning input', () => {
    const validForm = validateUserDecisionInput({
      decision: 'Should I seriously prepare for GATE 2027, or prioritize campus placements?',
      reasoning:
        'I am considering GATE 2027 for higher studies at an IIT, but campus placements offer immediate financial independence.',
      context: ['Career', 'Education'],
    });
    expect(validForm.valid).toBe(true);
    expect(validForm.decisionError).toBeUndefined();
    expect(validForm.reasoningError).toBeUndefined();

    const validApi = validateMirrorAnalyzeInput({
      decision: '  Should I seriously prepare for GATE 2027?  ',
      reasoning:
        '  I am considering GATE 2027 for higher studies at an IIT, but campus placements offer immediate financial independence.  ',
      context: ['Career', 'Education', ''],
    });
    expect(validApi.valid).toBe(true);
    expect(validApi.decision).toBe('Should I seriously prepare for GATE 2027?');
    expect(validApi.contextList).toEqual(['Career', 'Education']);
  });
});

describe('B. Blind Spot Output Validation', () => {
  it('accepts a valid structured MirrorAnalysis response', () => {
    const result = validateAndSanitizeMirrorOutput(VALID_SAMPLE_MIRROR);
    expect(result.data.assumptions).toHaveLength(3);
    expect(result.data.missingFactors).toHaveLength(3);
    expect(result.data.perspectives).toHaveLength(2);
    expect(result.data.evidenceGaps).toHaveLength(2);
    expect(result.data.probes).toHaveLength(3);
  });

  it('extracts JSON safely from markdown code fences or surrounding text', () => {
    const fenced = '```json\n' + JSON.stringify(VALID_SAMPLE_MIRROR) + '\n```';
    const parsed = extractJsonPayload(fenced);
    const validated = validateAndSanitizeMirrorOutput(parsed);
    expect(validated.data.assumptions[0].title).toBe(
      VALID_SAMPLE_MIRROR.assumptions[0].title
    );
  });

  it('rejects responses missing required fields', () => {
    const missingPerspectives = {
      ...VALID_SAMPLE_MIRROR,
      perspectives: undefined,
    };
    expect(() =>
      validateAndSanitizeMirrorOutput(missingPerspectives)
    ).toThrow(/perspectives/i);

    const missingNestedQuestion = {
      ...VALID_SAMPLE_MIRROR,
      assumptions: [
        {
          title: 'Valid title here',
          description: 'Valid description here.',
          question: '',
        },
      ],
    };
    expect(() =>
      validateAndSanitizeMirrorOutput(missingNestedQuestion)
    ).toThrow(/cannot be empty/i);
  });

  it('rejects responses with invalid item counts', () => {
    const emptyAssumptions = {
      ...VALID_SAMPLE_MIRROR,
      assumptions: [],
    };
    expect(() => validateAndSanitizeMirrorOutput(emptyAssumptions)).toThrow(
      /Invalid item count for "assumptions"/i
    );

    const tooManyAssumptions = {
      ...VALID_SAMPLE_MIRROR,
      assumptions: [
        ...VALID_SAMPLE_MIRROR.assumptions,
        {
          title: 'Fourth extra assumption item',
          description: 'Exceeds the maximum allowed count of 3.',
          question: 'Why is there a fourth assumption?',
        },
      ],
    };
    expect(() =>
      validateAndSanitizeMirrorOutput(tooManyAssumptions)
    ).toThrow(/Invalid item count for "assumptions"/i);

    const tooManyPerspectives = {
      ...VALID_SAMPLE_MIRROR,
      perspectives: [
        ...VALID_SAMPLE_MIRROR.perspectives,
        {
          perspective: 'Third extra perspective',
          description: 'Exceeds the maximum allowed count of 2.',
          question: 'How does this third perspective view the choice?',
        },
      ],
    };
    expect(() =>
      validateAndSanitizeMirrorOutput(tooManyPerspectives)
    ).toThrow(/Invalid item count for "perspectives"/i);
  });
});

describe('C. AI Safety & Non-Prescriptive Alignment', () => {
  it('rejects output containing prohibited recommendation or directive language', () => {
    expect(
      containsPrescriptiveAdvice(
        'You should definitely prioritize campus placements over GATE.'
      )
    ).toBe(true);
    expect(
      containsPrescriptiveAdvice(
        'The best choice is to accept the internship offer immediately.'
      )
    ).toBe(true);
    expect(
      containsPrescriptiveAdvice(
        'I recommend taking the job first and trying GATE later.'
      )
    ).toBe(true);
    expect(
      containsPrescriptiveAdvice('My advice is to stay bootstrapped.')
    ).toBe(true);

    const unsafeMirrorPayload = {
      ...VALID_SAMPLE_MIRROR,
      assumptions: [
        {
          title: 'Career priority assumption',
          description:
            'You should choose campus placements because the best choice is financial security.',
          question: 'Why not take the placement offer?',
        },
      ],
    };

    expect(() =>
      validateAndSanitizeMirrorOutput(unsafeMirrorPayload)
    ).toThrow(/Alignment rejection/i);
  });

  it('accepts neutral, non-prescriptive reflective reasoning language', () => {
    const neutralStatements = [
      'Your reasoning assumes that preparing for GATE and sitting for placements cannot overlap.',
      'What concrete evidence do you have that your current weekly schedule cannot accommodate both?',
      'Which matters most to you over the next two years: research depth or immediate industry experience?',
    ];

    for (const text of neutralStatements) {
      expect(containsPrescriptiveAdvice(text)).toBe(false);
      expect(sanitizeAndAlignText(text, 'testField', 300)).toBe(text);
    }

    expect(
      ensureInquiryQuestionFormat('Verify target IIT cutoff ranks.')
    ).toBe('How will you verify target IIT cutoff ranks?');
  });
});

describe('D. Fallback Behavior', () => {
  it('falls back safely when AI output is malformed or unparseable', () => {
    const malformedInputs: unknown[] = [
      'This is not JSON at all',
      '{ "assumptions": [broken json',
      null,
      { assumptions: [] },
    ];

    for (const badInput of malformedInputs) {
      const resolved = resolveMirrorOutputWithFallback(
        badInput,
        'Should I seriously prepare for GATE 2027, or prioritize campus placements?',
        'I want higher studies at an IIT for research, but I also want financial independence from placements.',
        ['Career', 'Education', 'Time']
      );

      expect(resolved.usedFallback).toBe(true);
      expect(resolved.data.assumptions.length).toBeGreaterThanOrEqual(1);
      expect(resolved.data.missingFactors.length).toBeGreaterThanOrEqual(1);
      expect(resolved.data.perspectives.length).toBeGreaterThanOrEqual(1);
      expect(resolved.data.evidenceGaps.length).toBeGreaterThanOrEqual(1);
      expect(resolved.data.probes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('falls back safely when AI output violates non-prescriptive safety rules', () => {
    const unsafeAiOutput = {
      ...VALID_SAMPLE_MIRROR,
      probes: [
        'You should choose GATE 2027 because the best choice is an IIT degree.',
      ],
    };

    const resolved = resolveMirrorOutputWithFallback(
      unsafeAiOutput,
      'Should I seriously prepare for GATE 2027, or prioritize campus placements?',
      'I want higher studies at an IIT for research, but I also want financial independence from placements.',
      ['Career', 'Education']
    );

    expect(resolved.usedFallback).toBe(true);
    for (const probe of resolved.data.probes) {
      expect(containsPrescriptiveAdvice(probe)).toBe(false);
    }
  });

  it('produces schema-valid and safety-verified fallback outputs for both Mirror and Synthesis', () => {
    const genericFallback = buildReasoningGroundedFallbackMirror(
      'Should we stay bootstrapped for 12 months or raise a pre-seed round?',
      'We have $9,500 MRR and low burn so staying bootstrapped keeps control, though competitors are hiring.',
      ['Career', 'Money']
    );
    const validatedMirror = validateAndSanitizeMirrorOutput(genericFallback);
    expect(validatedMirror.data.assumptions).toHaveLength(3);

    const synthesisFallback = resolveSynthesisOutputWithFallback(
      'not-json',
      'Should I seriously prepare for GATE 2027, or prioritize campus placements?',
      'I want higher studies at an IIT for research, but I also want financial independence from placements.',
      []
    );
    expect(synthesisFallback.usedFallback).toBe(true);
    const validatedSyn = validateAndSanitizeSynthesisOutput(
      synthesisFallback.data
    );
    expect(validatedSyn.data.beforeReasons.length).toBeGreaterThan(0);
    expect(containsPrescriptiveAdvice(validatedSyn.data.afterSynthesis)).toBe(
      false
    );
  });
});

describe('E. Phase Progression & User-Owned Decision Governance', () => {
  it('enforces phase gating and requires a user-authored conclusion to complete reflection', () => {
    expect(canTransitionToPhase(1, null)).toBe(true);
    expect(canTransitionToPhase(2, null)).toBe(false);

    const sessionInPhase2: DecisionSession = {
      id: 'bsm_test_1',
      decision: 'Should I accept the 6-month internship?',
      reasoning:
        'The team works on grid-scale storage, though it delays graduation by one semester.',
      context: ['Career'],
      currentPhase: 2,
      createdAt: new Date().toISOString(),
      mirrorAnalysis: VALID_SAMPLE_MIRROR,
      blindSpotProgress: {
        'assumptions-0': {
          id: 'assumptions-0',
          category: 'assumptions',
          index: 0,
          explored: true,
          thinkingOpen: false,
          state: 'ADDRESSED',
          response: 'I verified that graduation delay is reversible.',
          confidence: 4,
          needsMoreInfo: false,
        },
      },
    };

    expect(canTransitionToPhase(3, sessionInPhase2)).toBe(true);
    expect(canTransitionToPhase(4, sessionInPhase2)).toBe(true);

    const metricsWithoutConclusion = computeReflectionMetrics(
      VALID_SAMPLE_MIRROR,
      sessionInPhase2.blindSpotProgress,
      undefined,
      ''
    );
    expect(metricsWithoutConclusion.totalIdentified).toBe(10);
    expect(metricsWithoutConclusion.addressedCount).toBe(1);
    expect(metricsWithoutConclusion.canCompleteReflection).toBe(false);

    const metricsWithUserConclusion = computeReflectionMetrics(
      VALID_SAMPLE_MIRROR,
      sessionInPhase2.blindSpotProgress,
      undefined,
      'I will speak with my academic advisor about credit transfer before deciding.'
    );
    expect(metricsWithUserConclusion.canCompleteReflection).toBe(true);
  });
});
