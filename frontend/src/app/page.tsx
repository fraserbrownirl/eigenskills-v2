"use client";

import { useState, useEffect } from "react";
import ConnectWallet from "@/components/ConnectWallet";
import AgentSetup from "@/components/AgentSetup";
import Dashboard from "@/components/Dashboard";
import { getAgentInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SealLogo } from "@/components/ui/meme-logo";
import { Shield, Cpu, Lock, LogOut } from "lucide-react";

type View = "landing" | "setup" | "dashboard" | "loading";

const SESSION_KEY = "skillsseal-session";

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [address, setAddress] = useState("");
  const [token, setToken] = useState("");

  // Restore session from localStorage on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (!saved) {
          setView("landing");
          return;
        }

        const { token: savedToken, address: savedAddress } = JSON.parse(saved);

        // Validate token by checking agent info
        // Note: In a real app, we might want to do this check more gracefully
        // to avoid blocking the UI if the API is slow
        try {
          const agentInfo = await getAgentInfo(savedToken);
          setToken(savedToken);
          setAddress(savedAddress);

          if (agentInfo && agentInfo.status !== "terminated") {
            setView("dashboard");
          } else {
            setView("setup");
          }
        } catch (e) {
          // If token is invalid, clear session
          console.error("Session restoration failed:", e);
          localStorage.removeItem(SESSION_KEY);
          setView("landing");
        }
      } catch {
        // Token invalid or expired — clear and show landing
        localStorage.removeItem(SESSION_KEY);
        setView("landing");
      }
    }

    restoreSession();
  }, []);

  function handleConnected(addr: string, tok: string, hasAgent: boolean) {
    // Save session to localStorage
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: tok, address: addr }));

    setAddress(addr);
    setToken(tok);
    setView(hasAgent ? "dashboard" : "setup");
  }

  function handleDeployed() {
    setView("dashboard");
  }

  function handleTerminated() {
    setView("setup");
  }

  function handleDisconnect() {
    localStorage.removeItem(SESSION_KEY);
    setAddress("");
    setToken("");
    setView("landing");
  }

  if (view === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground animate-pulse">Initializing secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <SealLogo size={32} />
            <span className="text-lg font-bold tracking-tight">SkillsSeal</span>
          </div>

          {address && (
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs md:flex">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-muted-foreground">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto max-w-screen-2xl px-4 py-8 md:px-8 md:py-12">
        {/* Landing */}
        {view === "landing" && (
          <div className="flex flex-col items-center justify-center space-y-12 py-12 md:py-24">
            <div className="text-center space-y-6 max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Shield className="mr-2 h-4 w-4" />
                AI Agents in Hardware-Isolated TEEs
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl bg-gradient-to-r from-blue-600 via-blue-500 to-pink-500 bg-clip-text text-transparent">
                Create agents that learn and earn
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
                Deploy AI agents that skill up, work, and compound value inside Trusted Execution
                Environments.
              </p>
            </div>

            <div className="w-full max-w-md">
              <ConnectWallet onConnected={handleConnected} />
            </div>

            <div className="grid grid-cols-1 gap-8 pt-12 text-left md:grid-cols-3 max-w-5xl w-full">
              <Feature
                icon={Shield}
                title="TEE-Isolated Wallets"
                description="Each agent derives its own wallet inside a hardware-isolated TEE. The private key exists only in protected memory."
              />
              <Feature
                icon={Cpu}
                title="Signed Actions"
                description="Every task execution is cryptographically signed by the agent's wallet. You can verify any action came from your agent."
              />
              <Feature
                icon={Lock}
                title="Encrypted Secrets"
                description="API keys and credentials are KMS-encrypted at rest. They're decrypted only inside the TEE at runtime."
              />
            </div>
          </div>
        )}

        {/* Setup */}
        {view === "setup" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AgentSetup token={token} onDeployed={handleDeployed} />
          </div>
        )}

        {/* Dashboard */}
        {view === "dashboard" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Dashboard token={token} address={address} onAgentTerminated={handleTerminated} />
          </div>
        )}
      </main>
    </div>
  );
}

function Feature({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
