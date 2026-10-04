import {
  BlindSpotCategory,
  BlindSpotItemProgress,
  DecisionDraft,
  DecisionSession,
  MirrorAnalysis,
  MirrorValidationMeta,
  PhaseNumber,
  ReflectionSynthesis,
} from '../types/decision';
import { canTransitionToPhase } from '../utils/mirrorLogic';

const STORAGE_KEY = 'blind_spot_mirror_sessions_v1';
const ACTIVE_SESSION_KEY = 'blind_spot_mirror_active_session_id_v1';
const DEFAULT_API_TIMEOUT_MS = 45000;

export interface MirrorApiResponse {
  mirror: MirrorAnalysis;
  validation: MirrorValidationMeta;
}

export interface ReflectionSynthesisRequestItem {
  id: string;
  category: string;
  title: string;
  description: string;
  question: string;
  state: string;
  response: string;
  confidence?: number | null;
  needsMoreInfo?: boolean;
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS,
  customFetch: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await customFetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out while waiting for the reflection service. Please try again.');
    }
    throw err instanceof Error
      ? err
      : new Error('Network failure while communicating with the reflection service.');
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function analyzeDecisionReasoning(
  draft: DecisionDraft,
  customFetch: typeof fetch = fetch
): Promise<MirrorApiResponse> {
  const response = await fetchWithTimeout(
    '/api/mirror/analyze',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        decision: draft.decision.trim(),
        reasoning: draft.reasoning.trim(),
        context: draft.context,
      }),
    },
    DEFAULT_API_TIMEOUT_MS,
    customFetch
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Failed to analyze reasoning (HTTP ${response.status}).`;
    throw new Error(errorMsg);
  }

  if (!payload || !payload.mirror) {
    throw new Error('Received an invalid response structure from the mirror server.');
  }

  return payload as MirrorApiResponse;
}

export async function synthesizePhaseThreeReflections(
  params: {
    decision: string;
    reasoning: string;
    context: string[];
    reflections: ReflectionSynthesisRequestItem[];
  },
  customFetch: typeof fetch = fetch
): Promise<ReflectionSynthesis> {
  const response = await fetchWithTimeout(
    '/api/mirror/synthesize',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    },
    DEFAULT_API_TIMEOUT_MS,
    customFetch
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Failed to synthesize reflections (HTTP ${response.status}).`;
    throw new Error(errorMsg);
  }

  if (!payload || !payload.synthesis) {
    throw new Error('Received an invalid synthesis response from the server.');
  }

  return payload.synthesis as ReflectionSynthesis;
}

export function buildInitialBlindSpotProgress(
  mirror: MirrorAnalysis
): Record<string, BlindSpotItemProgress> {
  const map: Record<string, BlindSpotItemProgress> = {};

  const registerItems = (category: BlindSpotCategory, count: number) => {
    for (let i = 0; i < count; i++) {
      const id = `${category}-${i}`;
      map[id] = {
        id,
        category,
        index: i,
        explored: false,
        thinkingOpen: false,
        state: 'OPEN',
        response: '',
        confidence: null,
        needsMoreInfo: false,
        skipped: false,
      };
    }
  };

  registerItems('assumptions', mirror.assumptions.length);
  registerItems('missingFactors', mirror.missingFactors.length);
  registerItems('perspectives', mirror.perspectives.length);
  registerItems('evidenceGaps', mirror.evidenceGaps.length);

  return map;
}

export interface DecisionSessionRepository {
  listSessions(): Promise<DecisionSession[]>;
  getSessionById(id: string): Promise<DecisionSession | null>;
  createSessionWithMirror(
    draft: DecisionDraft,
    mirrorResult: MirrorApiResponse
  ): Promise<DecisionSession>;
  updateSessionWithMirror(
    id: string,
    draft: DecisionDraft,
    mirrorResult: MirrorApiResponse
  ): Promise<DecisionSession>;
  updateSession(
    id: string,
    updates: Partial<
      Pick<
        DecisionSession,
        | 'decision'
        | 'reasoning'
        | 'context'
        | 'currentPhase'
        | 'mirrorAnalysis'
        | 'mirrorValidation'
        | 'blindSpotProgress'
        | 'reflectionSynthesis'
        | 'stressTest'
      >
    >
  ): Promise<DecisionSession>;
  deleteSession(id: string): Promise<void>;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `bsm_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `bsm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function readStoredSessions(): DecisionSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DecisionSession =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.decision === 'string' &&
        typeof item.reasoning === 'string' &&
        Array.isArray(item.context) &&
        typeof item.currentPhase === 'number' &&
        typeof item.createdAt === 'string'
    );
  } catch {
    return [];
  }
}

function writeStoredSessions(sessions: DecisionSession[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export const sessionRepository: DecisionSessionRepository = {
  async listSessions(): Promise<DecisionSession[]> {
    return readStoredSessions().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getSessionById(id: string): Promise<DecisionSession | null> {
    const sessions = readStoredSessions();
    return sessions.find((s) => s.id === id) ?? null;
  },

  async createSessionWithMirror(
    draft: DecisionDraft,
    mirrorResult: MirrorApiResponse
  ): Promise<DecisionSession> {
    const newSession: DecisionSession = {
      id: generateSessionId(),
      decision: draft.decision.trim(),
      reasoning: draft.reasoning.trim(),
      context: Array.from(new Set(draft.context.map((c) => c.trim()).filter(Boolean))),
      currentPhase: 2,
      createdAt: new Date().toISOString(),
      mirrorAnalysis: mirrorResult.mirror,
      mirrorValidation: mirrorResult.validation,
      blindSpotProgress: buildInitialBlindSpotProgress(mirrorResult.mirror),
    };

    const existing = readStoredSessions();
    const updated = [newSession, ...existing];
    writeStoredSessions(updated);
    setActiveSessionId(newSession.id);

    return newSession;
  },

  async updateSessionWithMirror(
    id: string,
    draft: DecisionDraft,
    mirrorResult: MirrorApiResponse
  ): Promise<DecisionSession> {
    const sessions = readStoredSessions();
    const idx = sessions.findIndex((s) => s.id === id);

    const updatedSession: DecisionSession = {
      id: idx !== -1 ? sessions[idx].id : id,
      createdAt: idx !== -1 ? sessions[idx].createdAt : new Date().toISOString(),
      decision: draft.decision.trim(),
      reasoning: draft.reasoning.trim(),
      context: Array.from(new Set(draft.context.map((c) => c.trim()).filter(Boolean))),
      currentPhase: 2,
      mirrorAnalysis: mirrorResult.mirror,
      mirrorValidation: mirrorResult.validation,
      blindSpotProgress: buildInitialBlindSpotProgress(mirrorResult.mirror),
      reflectionSynthesis: undefined,
      stressTest: undefined,
    };

    if (idx !== -1) {
      sessions[idx] = updatedSession;
      writeStoredSessions(sessions);
    } else {
      writeStoredSessions([updatedSession, ...sessions]);
    }
    setActiveSessionId(updatedSession.id);
    return updatedSession;
  },

  async updateSession(id, updates): Promise<DecisionSession> {
    const sessions = readStoredSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`DecisionSession with id "${id}" not found.`);
    }

    const updatedSession: DecisionSession = {
      ...sessions[idx],
      ...updates,
      decision: updates.decision !== undefined ? updates.decision.trim() : sessions[idx].decision,
      reasoning:
        updates.reasoning !== undefined ? updates.reasoning.trim() : sessions[idx].reasoning,
      context:
        updates.context !== undefined
          ? Array.from(new Set(updates.context.map((c) => c.trim()).filter(Boolean)))
          : sessions[idx].context,
    };

    sessions[idx] = updatedSession;
    writeStoredSessions(sessions);
    return updatedSession;
  },

  async deleteSession(id: string): Promise<void> {
    const sessions = readStoredSessions().filter((s) => s.id !== id);
    writeStoredSessions(sessions);
    if (getActiveSessionId() === id) {
      clearActiveSessionId();
    }
  },
};

export function getActiveSessionId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setActiveSessionId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    // Ignore storage errors
  }
}

export function clearActiveSessionId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function canAccessPhase(
  targetPhase: PhaseNumber,
  activeSession: DecisionSession | null
): boolean {
  return canTransitionToPhase(targetPhase, activeSession);
}
