"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAgentInfo,
  getSkillsCatalog,
  getHistory,
  getLogs,
  type AgentInfo,
  type SkillCatalogEntry,
  type HistoryEntry,
} from "@/lib/api";

const POLL_INTERVAL_ACTIVE = 15_000;
const POLL_INTERVAL_DEPLOYING = 5_000;
const DEFAULT_LOG_LINES = 200;

export type TabType = "task" | "skills" | "memory" | "history" | "logs" | "messaging" | "secrets";

export interface UseAgentPollingOptions {
  token: string;
  activeTab: TabType;
}

export interface UseAgentPollingResult {
  agent: AgentInfo | null;
  loading: boolean;
  skillsCatalog: SkillCatalogEntry[];
  history: HistoryEntry[];
  logs: string;
  logsLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  refreshInfo: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshLogs: () => Promise<void>;
}

export function useAgentPolling({
  token,
  activeTab,
}: UseAgentPollingOptions): UseAgentPollingResult {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);

  const refreshInfo = useCallback(async () => {
    try {
      const info = await getAgentInfo(token);
      setAgent(info);
    } catch {
      setError("Failed to fetch agent info");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const refreshSkills = useCallback(async () => {
    try {
      const catalog = await getSkillsCatalog(token);
      setSkillsCatalog(catalog);
    } catch {
      console.error("Failed to fetch skills catalog");
    }
  }, [token]);

  const refreshHistory = useCallback(async () => {
    if (!agent?.instanceIp) return;
    try {
      const h = await getHistory(token);
      setHistory(h);
    } catch {
      console.error("Failed to fetch history");
    }
  }, [token, agent?.instanceIp]);

  const refreshLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const l = await getLogs(token, DEFAULT_LOG_LINES);
      setLogs(l);
    } catch {
      console.error("Failed to fetch logs");
    } finally {
      setLogsLoading(false);
    }
  }, [token]);

  const pollInterval = agent?.instanceIp ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_DEPLOYING;

  useEffect(() => {
    refreshInfo();
    const interval = setInterval(refreshInfo, pollInterval);
    return () => clearInterval(interval);
  }, [refreshInfo, pollInterval]);

  useEffect(() => {
    if (activeTab === "skills") {
      refreshSkills();
    } else if (activeTab === "history" && agent?.instanceIp) {
      refreshHistory();
    } else if (activeTab === "logs") {
      refreshLogs();
    }
  }, [activeTab, refreshSkills, refreshHistory, refreshLogs, agent?.instanceIp]);

  return {
    agent,
    loading,
    skillsCatalog,
    history,
    logs,
    logsLoading,
    error,
    setError,
    refreshInfo,
    refreshSkills,
    refreshHistory,
    refreshLogs,
  };
}
