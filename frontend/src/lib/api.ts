const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3002";

export interface EnvVar {
  key: string;
  value: string;
  isPublic: boolean;
}

export interface AgentInfo {
  name: string;
  status: string;
  appId: string | null;
  walletAddressEth: string | null;
  walletAddressSol: string | null;
  instanceIp: string | null;
  dockerDigest: string | null;
  createdAt: string;
  healthy: boolean;
}

export interface PatternUsed {
  source: "memory" | "learning";
  key: string;
  summary: string;
}

export interface TaskResult {
  result: string;
  skillsUsed: string[];
  patternsUsed?: PatternUsed[];
  routingSignature: string;
  agentSignature: string;
  agentAddress: string;
  sessionId?: string;
}

function getHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch a server-issued nonce for SIWE authentication.
 * The nonce is valid for 5 minutes and can only be used once.
 */
export async function fetchNonce(): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/auth/nonce`);
  if (!res.ok) throw new Error("Failed to fetch nonce");
  const { nonce } = await res.json();
  return nonce;
}

export async function verifyAuth(
  message: string,
  signature: string
): Promise<{ address: string; token: string; hasAgent: boolean }> {
  const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  if (!res.ok) throw new Error("Auth verification failed");
  return res.json();
}

/**
 * Check if a wallet has an active EigenAI grant (via backend proxy to avoid CORS).
 */
export async function getGrantStatus(address: string): Promise<{
  hasGrant: boolean;
  tokenCount: number;
}> {
  const res = await fetch(`${BACKEND_URL}/api/auth/grant?address=${encodeURIComponent(address)}`);
  if (!res.ok) return { hasGrant: false, tokenCount: 0 };
  const data = await res.json();
  return {
    hasGrant: data.hasGrant ?? false,
    tokenCount: data.tokenCount ?? 0,
  };
}

export interface DeployResponse {
  agentId: number;
  appId?: string;
  walletAddress?: string;
  instanceIp?: string;
  pending?: boolean;
  dispatchId?: string;
  message?: string;
}

export interface DeployStatusResponse {
  status: "pending" | "success" | "error" | "not_found";
  dispatchId?: string;
  action?: "deploy" | "upgrade";
  error?: string;
  createdAt?: string;
  completedAt?: string;
  agent?: {
    id: number;
    appId: string | null;
    walletAddress: string | null;
    instanceIp: string | null;
    status: string;
  };
}

export async function deployAgent(
  token: string,
  name: string,
  envVars: EnvVar[],
  verifiable: boolean = false
): Promise<DeployResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agents/deploy`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ name, envVars, verifiable }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Deploy failed");
  }
  return res.json();
}

export async function getDeployStatus(
  token: string,
  dispatchId?: string
): Promise<DeployStatusResponse> {
  const url = dispatchId
    ? `${BACKEND_URL}/api/agents/deploy-status?dispatchId=${encodeURIComponent(dispatchId)}`
    : `${BACKEND_URL}/api/agents/deploy-status`;
  const res = await fetch(url, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to get deploy status");
  }
  return res.json();
}

export async function pollDeployStatus(
  token: string,
  dispatchId: string,
  onProgress?: (status: DeployStatusResponse) => void,
  maxWaitMs: number = 300000,
  intervalMs: number = 3000
): Promise<DeployStatusResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getDeployStatus(token, dispatchId);
    onProgress?.(status);

    if (status.status !== "pending") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Deploy timed out");
}

export async function upgradeAgent(token: string, envVars: EnvVar[]): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/agents/upgrade`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ envVars }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Upgrade failed");
  }
}

export async function getAgentEnvVars(token: string): Promise<EnvVar[]> {
  const res = await fetch(`${BACKEND_URL}/api/agents/env`, {
    headers: getHeaders(token),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Failed to get agent env vars");
  const data = await res.json();
  return data.envVars ?? [];
}

export async function stopAgent(token: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/agents/stop`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Stop failed");
}

export async function startAgent(token: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/agents/start`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Start failed");
}

export async function terminateAgent(token: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/agents/terminate`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Terminate failed");
}

export async function getAgentInfo(token: string): Promise<AgentInfo | null> {
  const res = await fetch(`${BACKEND_URL}/api/agents/info`, {
    headers: getHeaders(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to get agent info");
  return res.json();
}

export async function submitTask(
  token: string,
  task: string,
  sessionId?: string
): Promise<TaskResult> {
  const res = await fetch(`${BACKEND_URL}/api/agents/task`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ task, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Task submission failed");
  }
  return res.json();
}

export interface X402Config {
  enabled: boolean;
  costPerCall: string;
  currency: string;
  network: string;
}

export interface Skill {
  id: string;
  description: string;
  version: string;
  author: string;
  contentHash: string;
  requiresEnv: string[];
  hasExecutionManifest: boolean;
  x402?: X402Config;
}

export interface SkillCatalogEntry extends Skill {
  status: "enabled" | "disabled";
  missingEnvVars: string[];
}

export async function getSkills(token: string): Promise<Skill[]> {
  const res = await fetch(`${BACKEND_URL}/api/agents/skills`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.skills ?? [];
}

export async function getSkillsCatalog(token: string): Promise<SkillCatalogEntry[]> {
  const res = await fetch(`${BACKEND_URL}/api/agents/skills-catalog`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.skills ?? [];
}

export interface HistoryEntry {
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
  agentAddress: string;
  signature: string;
}

export async function getHistory(token: string): Promise<HistoryEntry[]> {
  const res = await fetch(`${BACKEND_URL}/api/agents/history`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries ?? [];
}

export async function getLogs(token: string, lines: number = 100): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/agents/logs?lines=${lines}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.logs ?? "";
}

export interface TelegramLinkResponse {
  code: string;
  url: string;
}

export interface TelegramStatus {
  linked: boolean;
  chatId: string | null;
}

export async function getTelegramLinkCode(token: string): Promise<TelegramLinkResponse> {
  const res = await fetch(`${BACKEND_URL}/api/telegram/link`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to generate Telegram link");
  }
  return res.json();
}

export async function getTelegramStatus(token: string): Promise<TelegramStatus> {
  const res = await fetch(`${BACKEND_URL}/api/telegram/status`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return { linked: false, chatId: null };
  return res.json();
}

export async function unlinkTelegram(token: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/telegram/link`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to unlink Telegram");
  }
}

// ── Learnings API ─────────────────────────────────────────────────────────────

export interface LearningEntry {
  entryId: string;
  entryType: "LRN" | "ERR" | "FEAT";
  category?: string;
  summary: string;
  content: string;
  priority?: string;
  status: string;
  createdAt: string;
}

export async function getLearnings(
  token: string,
  filters?: { status?: string; type?: string }
): Promise<LearningEntry[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.type) params.set("type", filters.type);

  const url = params.toString()
    ? `${BACKEND_URL}/api/agents/learnings?${params}`
    : `${BACKEND_URL}/api/agents/learnings`;

  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries ?? [];
}

export async function deleteLearning(token: string, entryId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/agents/learnings/${encodeURIComponent(entryId)}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to delete learning");
  }
}

// ── Memory API ────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  key: string;
  content: string;
  updatedAt: string;
}

export async function getMemory(token: string): Promise<MemoryEntry[]> {
  const res = await fetch(`${BACKEND_URL}/api/agents/memory`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries ?? [];
}

export async function deleteMemory(token: string, key: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/agents/memory?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to delete memory");
  }
}

// ── Billing API ────────────────────────────────────────────────────────────────

export interface BillingStatus {
  active: boolean;
  wallet: string | null;
  period: string | null;
  totalDue: string;
  remainingCredits: string;
  manageUrl: string | null;
  needsSubscription?: boolean;
}

export async function getBillingStatus(token: string): Promise<BillingStatus> {
  const res = await fetch(`${BACKEND_URL}/api/billing/status`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    return {
      active: false,
      wallet: null,
      period: null,
      totalDue: "0.00",
      remainingCredits: "0.00",
      manageUrl: null,
      needsSubscription: true,
    };
  }
  return res.json();
}

export async function getSubscribeUrl(token: string): Promise<string | null> {
  const res = await fetch(`${BACKEND_URL}/api/billing/subscribe`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.subscribeUrl ?? null;
}
