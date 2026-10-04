import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  buildReasoningGroundedFallbackMirror,
  buildReasoningGroundedFallbackSynthesis,
  extractJsonPayload,
  FALLBACK_GEMMA_MODEL,
  GEMMA_MODEL_CANDIDATES,
  PRIMARY_GEMMA_MODEL,
  SynthesisPayload,
  validateAndSanitizeMirrorOutput,
  validateAndSanitizeSynthesisOutput,
  validateMirrorAnalyzeInput,
} from './src/utils/mirrorLogic';
import { MirrorAnalysis } from './src/types/decision';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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
   - "My advice is..."
4. Instead, closely examine the USER'S ACTUAL REASONING and identify what their specific words may be assuming, overlooking, or leaving unresolved.
5. Every assumption, missing factor, perspective, evidence gap, and probing question MUST be directly grounded in the exact claims, tradeoffs, and words the user provided. Never generate generic platitudes.

OUTPUT CONSTRAINTS:
Return ONLY a valid JSON object (no markdown commentary) with this exact structure:
{
  "assumptions": [
    { "title": "string (4-10 words)", "description": "string (1-2 sentences)", "question": "string (open-ended question)" }
  ],
  "missingFactors": [
    { "title": "string (3-8 words)", "description": "string (1-2 sentences)", "question": "string (open-ended question)" }
  ],
  "perspectives": [
    { "perspective": "string (viewpoint name)", "description": "string (how this angle sees tradeoffs)", "question": "string (open-ended question)" }
  ],
  "evidenceGaps": [
    { "claim": "string (unverified belief treated as fact)", "question": "string (open-ended question asking what evidence supports or falsifies it)" }
  ],
  "probes": [
    "string (3 to 5 overarching non-leading inquiry questions)"
  ]
}
Include 3 assumptions, 3 missingFactors, 2 perspectives, 2 evidenceGaps, and 3 to 5 probes.`;

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
2. Never use phrases like "You should...", "You shouldn't...", "The best choice is...", "I recommend...", "My advice is...".
3. Your task is to mirror back how the user's own reasoning has evolved between Phase 01 (their initial reasoning) and Phase 03 (their reflections, confidence levels, and "I need more information" flags).
4. Write "afterSynthesis" in first-person reflective voice ("I realized...", "I recognize that while I initially focused on..., I still need to verify...") grounded strictly in the user's actual responses, low-confidence scores, and flagged information gaps.

OUTPUT CONSTRAINTS:
Return ONLY a valid JSON object (no markdown commentary) with:
- "beforeReasons": 3 to 4 concise bullet phrases summarizing the main reasons the user originally gave in Phase 01.
- "afterSynthesis": A 2-to-3 sentence first-person reflection summary capturing how the user's thinking has shifted or expanded based on their Phase 03 answers and uncertainty flags.
- "keyShifts": 2 to 3 concise observations comparing their initial certainty with the nuances they uncovered.
- "openInformationNeeds": Up to 4 specific questions or facts the user flagged as "I need more information" or rated low confidence.`;

const SYNTHESIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    beforeReasons: {
      type: Type.ARRAY,
      description:
        '3 to 4 concise bullet phrases capturing the main reasons originally given by the user.',
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

const MODEL_CALL_TIMEOUT_MS = 24000;
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

/**
 * Calls Google Gemma (`gemma-4-26b-a4b-it` primary, `gemma-4-31b-it` fallback)
 * through the Google GenAI API (`@google/genai` SDK).
 * First attempts structured JSON generation; if the Gemma model endpoint does not
 * accept `responseSchema` / `responseMimeType`, retries with prompt-embedded JSON
 * instructions on the same Gemma model before moving to the fallback Gemma model.
 */
async function callGemmaModelForJson(
  ai: GoogleGenAI,
  candidateModel: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Record<string, unknown>,
  temperature: number
): Promise<unknown> {
  const combinedPrompt = `${systemInstruction}\n\n${userPrompt}\n\nRespond with raw valid JSON only.`;

  try {
    const structuredRes = await withModelTimeout(
      ai.models.generateContent({
        model: candidateModel,
        contents: combinedPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      })
    );
    if (structuredRes.text && structuredRes.text.trim().length > 0) {
      return extractJsonPayload(structuredRes.text);
    }
  } catch {
    // If structured responseSchema/responseMimeType is unsupported on this Gemma endpoint,
    // immediately request JSON via prompt on the same Gemma model.
  }

  const promptJsonRes = await withModelTimeout(
    ai.models.generateContent({
      model: candidateModel,
      contents: combinedPrompt,
      config: {
        temperature,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    })
  );

  if (!promptJsonRes.text || promptJsonRes.text.trim().length === 0) {
    throw new Error(`Empty response from ${candidateModel}`);
  }

  return extractJsonPayload(promptJsonRes.text);
}

export function createApp() {
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

  // PHASE 2: MIRROR ANALYSIS CALL (1 call per Phase 2 entry using Gemma 4)
  app.post('/api/mirror/analyze', async (req: Request, res: Response) => {
    try {
      const validation = validateMirrorAnalyzeInput(req.body);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const { decision, reasoning, contextList } = validation;
      const apiKey = process.env.GEMINI_API_KEY;
      let validatedResult: {
        data: MirrorAnalysis;
        transformationsApplied: number;
      } | null = null;
      let modelUsed: string = PRIMARY_GEMMA_MODEL;

      const userPrompt = [
        `DECISION UNDER CONSIDERATION:`,
        `"${decision}"`,
        ``,
        `USER'S STATED REASONING:`,
        `"${reasoning}"`,
        ``,
        `DECLARED CONTEXT DIMENSIONS:`,
        contextList.length > 0 ? contextList.join(', ') : 'None explicitly tagged',
        ``,
        `Analyze the user's specific reasoning above. Identify 3 assumptions, 3 missing factors, 2 perspectives, 2 evidence gaps, and 3 to 5 probing questions. Ground every single item in the user's exact words and premises. Do not give advice or recommendations.`,
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

        for (const candidateModel of GEMMA_MODEL_CANDIDATES) {
          try {
            const parsedJson = await callGemmaModelForJson(
              ai,
              candidateModel,
              MIRROR_SYSTEM_INSTRUCTION,
              userPrompt,
              MIRROR_RESPONSE_SCHEMA,
              0.4
            );
            validatedResult = validateAndSanitizeMirrorOutput(parsedJson);
            modelUsed = candidateModel;
            break;
          } catch {
            // Try fallback Gemma model (gemma-4-31b-it) if primary fails
          }
        }
      }

      if (!validatedResult) {
        const fallbackMirror = buildReasoningGroundedFallbackMirror(
          decision,
          reasoning,
          contextList
        );
        validatedResult = validateAndSanitizeMirrorOutput(fallbackMirror);
        modelUsed = `${PRIMARY_GEMMA_MODEL}-fallback`;
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

  // PHASE 3: END-OF-PHASE REFLECTION SYNTHESIS CALL (1 call at end of Phase 3 using Gemma 4)
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
        data: SynthesisPayload;
        transformationsApplied: number;
      } | null = null;
      let modelUsed: string = PRIMARY_GEMMA_MODEL;

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

        for (const candidateModel of GEMMA_MODEL_CANDIDATES) {
          try {
            const parsedJson = await callGemmaModelForJson(
              ai,
              candidateModel,
              SYNTHESIS_SYSTEM_INSTRUCTION,
              userSynthesisPrompt,
              SYNTHESIS_RESPONSE_SCHEMA,
              0.35
            );
            validatedSynthesis = validateAndSanitizeSynthesisOutput(parsedJson);
            modelUsed = candidateModel;
            break;
          } catch {
            // Try fallback Gemma model (gemma-4-31b-it) if primary fails
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
        modelUsed = `${PRIMARY_GEMMA_MODEL}-fallback`;
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

  return app;
}

async function startServer() {
  const app = createApp();

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
    console.log(
      `Blind Spot Mirror server (${PRIMARY_GEMMA_MODEL} / ${FALLBACK_GEMMA_MODEL}) listening on http://0.0.0.0:${PORT}`
    );
  });
}

if (process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test') {
  startServer();
}
