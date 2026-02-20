"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  Trash2,
  Loader2,
  Activity,
  Server,
  Shield,
  Globe,
  Wallet,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentInfo } from "@/lib/api";

interface AgentStatusCardProps {
  agent: AgentInfo;
  address: string;
  actionLoading: string | null;
  onAction: (action: "stop" | "start" | "terminate") => void;
  onTerminateClick: () => void;
}

function CopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function AgentStatusCard({
  agent,
  address,
  actionLoading,
  onAction,
  onTerminateClick,
}: AgentStatusCardProps) {
  const isRunning = agent.status === "running";
  const isStopped = agent.status === "stopped";
  const isTerminated = agent.status === "terminated";

  const hasEthWallet = !!agent.walletAddressEth;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold">{agent.name}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </CardDescription>
        </div>
        <Badge
          variant={isRunning ? "success" : isStopped ? "warning" : "destructive"}
          className={cn(
            "px-3 py-1 text-sm capitalize",
            isRunning &&
              "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/20",
            isStopped && "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/20",
            isTerminated &&
              "bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/20"
          )}
        >
          {agent.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent TEE Wallet Address */}
        <div className="rounded-lg border bg-card/50 p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Wallet className="h-4 w-4" />
            Agent TEE Wallet
          </div>
          {hasEthWallet ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground font-mono truncate">
                {agent.walletAddressEth}
              </span>
              <CopyButton address={agent.walletAddressEth!} />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              {agent.status === "deploying" ? "Generating in TEE..." : "Not available"}
            </span>
          )}
        </div>

        {/* Status Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              Connection
            </div>
            <div className="space-y-0.5">
              <div
                className={cn(
                  "font-medium",
                  agent.healthy
                    ? "text-emerald-500"
                    : agent.status === "running"
                      ? "text-amber-500"
                      : "text-muted-foreground"
                )}
              >
                {agent.healthy
                  ? "Online"
                  : agent.status === "deploying"
                    ? "Starting..."
                    : agent.status === "running"
                      ? "Unreachable"
                      : agent.status === "stopped"
                        ? "Offline"
                        : "Terminated"}
              </div>
              {!agent.healthy && agent.status === "running" && (
                <div className="text-xs text-muted-foreground">
                  Container running but not responding
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Globe className="h-4 w-4" />
              Instance IP
            </div>
            <div className="font-mono text-sm text-foreground">{agent.instanceIp || "N/A"}</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Server className="h-4 w-4" />
              Runtime
            </div>
            <div className="font-medium text-foreground">EigenCompute TEE</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Shield className="h-4 w-4" />
              Security
            </div>
            <div className="font-medium text-foreground">Intel TDX</div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t bg-muted/20 p-4">
        {isRunning ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction("stop")}
            disabled={!!actionLoading}
          >
            {actionLoading === "stop" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            Stop Agent
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => onAction("start")}
            disabled={!!actionLoading || isTerminated}
          >
            {actionLoading === "start" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Agent
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          onClick={onTerminateClick}
          disabled={!!actionLoading || isTerminated}
        >
          {actionLoading === "terminate" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Terminate
        </Button>
      </CardFooter>
    </Card>
  );
}
