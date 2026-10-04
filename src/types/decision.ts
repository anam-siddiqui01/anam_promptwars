export type PhaseNumber = 1 | 2 | 3 | 4;

export type PhaseKey = 'FRAME' | 'MIRROR' | 'REFLECT' | 'STRESS_TEST';

export interface PhaseDefinition {
  number: PhaseNumber;
  code: string;
  key: PhaseKey;
  label: string;
  shortDescription: string;
}

export interface AssumptionItem {
  title: string;
  description: string;
  question: string;
}

export interface MissingFactorItem {
  title: string;
  description: string;
  question: string;
}

export interface PerspectiveItem {
  perspective: string;
  description: string;
  question: string;
}

export interface EvidenceGapItem {
  claim: string;
  question: string;
}

export interface MirrorAnalysis {
  assumptions: AssumptionItem[];
  missingFactors: MissingFactorItem[];
  perspectives: PerspectiveItem[];
  evidenceGaps: EvidenceGapItem[];
  probes: string[];
}

export interface MirrorValidationMeta {
  model: string;
  schemaVerified: boolean;
  alignmentChecked: boolean;
  transformationsApplied: number;
  timestamp: string;
}

export type BlindSpotCategory =
  | 'assumptions'
  | 'missingFactors'
  | 'perspectives'
  | 'evidenceGaps';

export type BlindSpotState =
  | 'OPEN'
  | 'THINKING'
  | 'ADDRESSED'
  | 'NEEDS_INFO'
  | 'SKIPPED';

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface BlindSpotItemProgress {
  id: string;
  category: BlindSpotCategory;
  index: number;
  explored: boolean;
  thinkingOpen: boolean;
  state: BlindSpotState;
  response: string;
  confidence?: ConfidenceLevel | null;
  needsMoreInfo?: boolean;
  skipped?: boolean;
}

export interface ReflectionSynthesis {
  beforeReasons: string[];
  afterSynthesis: string;
  keyShifts: string[];
  openInformationNeeds: string[];
  generatedAt: string;
  model?: string;
}

export type DecisionStance =
  | 'yes'
  | 'no'
  | 'less_certain'
  | 'need_more_info';

export interface StressTestRecord {
  stance: DecisionStance | null;
  finalConclusion: string;
  completedAt: string | null;
}

export interface DecisionSession {
  id: string;
  decision: string;
  reasoning: string;
  context: string[];
  currentPhase: PhaseNumber;
  createdAt: string;
  mirrorAnalysis?: MirrorAnalysis;
  mirrorValidation?: MirrorValidationMeta;
  blindSpotProgress?: Record<string, BlindSpotItemProgress>;
  reflectionSynthesis?: ReflectionSynthesis;
  stressTest?: StressTestRecord;
}

export interface DecisionDraft {
  decision: string;
  reasoning: string;
  context: string[];
}

export const PHASES: PhaseDefinition[] = [
  {
    number: 1,
    code: '01',
    key: 'FRAME',
    label: 'FRAME',
    shortDescription: 'Articulate the decision and your current reasoning',
  },
  {
    number: 2,
    code: '02',
    key: 'MIRROR',
    label: 'MIRROR',
    shortDescription: 'Surface unstated assumptions and overlooked angles',
  },
  {
    number: 3,
    code: '03',
    key: 'REFLECT',
    label: 'REFLECT',
    shortDescription: 'Respond to targeted inquiry across blind spots',
  },
  {
    number: 4,
    code: '04',
    key: 'STRESS_TEST',
    label: 'STRESS TEST',
    shortDescription: 'Test your reasoning against competing scenarios',
  },
];

export const PRESET_CONTEXT_OPTIONS: readonly string[] = [
  'Career',
  'Education',
  'Money',
  'Time',
  'Future',
  'Relationships',
  'Health',
  'Location',
  'Family',
  'Other',
] as const;

export interface ExampleDecisionPrompt {
  id: string;
  title: string;
  decision: string;
  reasoning: string;
  context: string[];
}

export const EXAMPLE_DECISIONS: ExampleDecisionPrompt[] = [
  {
    id: 'gate-vs-placements',
    title: 'GATE 2027 vs. Campus Placements',
    decision: 'Should I seriously prepare for GATE 2027, or prioritize campus placements?',
    reasoning:
      "I'm considering preparing seriously for GATE 2027 because getting into a good IIT or another strong institute for higher studies could open better research and career opportunities. At the same time, I don't want to miss campus placements because getting a job after graduation would give me financial independence and industry experience.\n\nI feel like if I focus too much on GATE, I might lose placement opportunities, but if I focus too much on placements, I might regret not giving GATE a serious attempt.\n\nI have limited time, so I'm struggling to decide which one should be my priority.",
    context: ['Career', 'Education', 'Time', 'Money', 'Future'],
  },
  {
    id: 'internship-offer',
    title: '6-Month Internship Offer',
    decision: 'Should I accept this 6-month internship at a fast-growing climate tech startup?',
    reasoning:
      'The team is working on grid-scale storage which aligns with what I want to do after graduation. However, accepting it means delaying my final semester by half a year and taking a 30% stipend cut compared to my summer corporate return offer. I feel like the hands-on mentorship at a 25-person company matters more right now than graduating on schedule.',
    context: ['Career', 'Education', 'Money', 'Time'],
  },
  {
    id: 'relocation-tradeoff',
    title: 'Relocating for a Lead Role',
    decision: 'Should I relocate to another city to lead a new product division?',
    reasoning:
      'Stepping into a director-level scope is the exact career milestone I have been working toward for three years. My hesitation is that my partner has strong local community ties here, and moving would turn our weekly family dinners into quarterly flights. I am assuming we can rebuild our routine quickly because the compensation bump covers travel.',
    context: ['Career', 'Location', 'Relationships', 'Family'],
  },
  {
    id: 'bootstrap-vs-raise',
    title: 'Bootstrapping vs. Raising Pre-Seed',
    decision: 'Should we stay bootstrapped for another 12 months instead of raising a pre-seed round now?',
    reasoning:
      'We have $9,500 in monthly recurring revenue and low burn, so keeping full control lets us build calmly without investor pressure. I worry that fundraising will distract us for three months when we should be shipping to customers, though our main competitor just hired four engineers.',
    context: ['Career', 'Money', 'Time'],
  },
];
