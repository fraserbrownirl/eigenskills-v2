"use client";

import { useState } from "react";
import { stopAgent, startAgent, terminateAgent } from "@/lib/api";
import { useAgentPolling, type TabType } from "@/hooks/useAgentPolling";
import {
  AgentStatusCard,
  ContainerLogs,
  ExecutionHistory,
  MemoryPanel,
  MessagingPanel,
  SecretsPanel,
  SkillsPanel,
  TabNavigation,
  TaskInterface,
  TerminateConfirmation,
} from "./dashboard/index";
import { Loader2, AlertCircle } from "lucide-react";

interface DashboardProps {
  token: string;
  address: string;
  onAgentTerminated: () => void;
}

export default function Dashboard({ token, address, onAgentTerminated }: DashboardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("task");

  const {
    agent,
    loading,
    skillsCatalog,
    history,
    logs,
    logsLoading,
    error,
    setError,
    refreshInfo,
    refreshHistory,
    refreshLogs,
  } = useAgentPolling({ token, activeTab });

  async function handleAction(action: "stop" | "start" | "terminate") {
    setActionLoading(action);
    setError(null);
    try {
      if (action === "stop") await stopAgent(token);
      else if (action === "start") await startAgent(token);
      else if (action === "terminate") {
        await terminateAgent(token);
        onAgentTerminated();
        return;
      }
      await refreshInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActionLoading(null);
      setShowTerminateConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading agent status...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-8 w-8" />
          <p>No agent found. Something went wrong.</p>
        </div>
      </div>
    );
  }

  const canSubmitTask = !!agent.instanceIp;
  const agentStartingUp = agent.status === "running" && !agent.instanceIp;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
      <AgentStatusCard
        agent={agent}
        address={address}
        actionLoading={actionLoading}
        onAction={handleAction}
        onTerminateClick={() => setShowTerminateConfirm(true)}
      />

      {showTerminateConfirm && (
        <TerminateConfirmation
          loading={actionLoading === "terminate"}
          onCancel={() => setShowTerminateConfirm(false)}
          onConfirm={() => handleAction("terminate")}
        />
      )}

      {agent.status === "running" && (
        <div className="space-y-6">
          <TabNavigation activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

          <div className="min-h-[400px]">
            {activeTab === "task" && (
              <TaskInterface
                token={token}
                canSubmit={canSubmitTask}
                agentStartingUp={agentStartingUp}
                healthy={agent.healthy}
                onError={setError}
              />
            )}

            {activeTab === "skills" && (
              <SkillsPanel
                skills={skillsCatalog}
                onMissingVarClick={() => setActiveTab("secrets")}
              />
            )}

            {activeTab === "memory" && <MemoryPanel token={token} onError={setError} />}

            {activeTab === "history" && (
              <ExecutionHistory history={history} onRefresh={refreshHistory} />
            )}

            {activeTab === "logs" && (
              <ContainerLogs logs={logs} loading={logsLoading} onRefresh={refreshLogs} />
            )}

            {activeTab === "messaging" && <MessagingPanel token={token} onError={setError} />}

            {activeTab === "secrets" && <SecretsPanel token={token} onError={setError} />}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive flex items-center gap-2 border border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
