"use client";

import { useState, useEffect, useCallback } from "react";
import {
  deployAgent,
  getGrantStatus,
  pollDeployStatus,
  getBillingStatus,
  type EnvVar,
  type BillingStatus,
} from "@/lib/api";
import { signEigenAIGrant, getConnectedAccount } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Shield,
  AlertCircle,
  Key,
  User,
  Server,
  CreditCard,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentSetupProps {
  token: string;
  onDeployed: () => void;
}

interface GrantCredentials {
  message: string;
  signature: string;
  walletAddress: string;
}

export default function AgentSetup({ token, onDeployed }: AgentSetupProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [verifiable, setVerifiable] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Billing state
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [checkingBilling, setCheckingBilling] = useState(false);

  // Grant state
  const [grantCredentials, setGrantCredentials] = useState<GrantCredentials | null>(null);
  const [grantStatus, setGrantStatus] = useState<{
    checked: boolean;
    hasGrant: boolean;
    tokenCount: number;
  }>({ checked: false, hasGrant: false, tokenCount: 0 });
  const [signingGrant, setSigningGrant] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Check billing status on mount
  const checkBilling = useCallback(async () => {
    setCheckingBilling(true);
    try {
      const status = await getBillingStatus(token);
      setBillingStatus(status);
    } catch (err) {
      console.error("Failed to check billing:", err);
      setBillingStatus({
        active: false,
        wallet: null,
        period: null,
        totalDue: "0.00",
        remainingCredits: "0.00",
        manageUrl: null,
        needsSubscription: true,
      });
    } finally {
      setCheckingBilling(false);
    }
  }, [token]);

  useEffect(() => {
    if (step === 1 && !billingStatus) {
      checkBilling();
    }
  }, [step, billingStatus, checkBilling]);

  const checkGrant = useCallback(async () => {
    const address = await getConnectedAccount();
    if (!address) return;

    setWalletAddress(address);
    const status = await getGrantStatus(address);
    setGrantStatus({
      checked: true,
      hasGrant: status.hasGrant,
      tokenCount: status.tokenCount,
    });
  }, []);

  // Check grant status when entering step 3
  useEffect(() => {
    if (step === 3 && !grantStatus.checked) {
      checkGrant();
    }
  }, [step, grantStatus.checked, checkGrant]);

  async function handleSignGrant() {
    if (!walletAddress) return;

    setSigningGrant(true);
    setError(null);

    try {
      const { grantMessage, grantSignature } = await signEigenAIGrant(walletAddress);
      setGrantCredentials({
        message: grantMessage,
        signature: grantSignature,
        walletAddress,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign grant message");
    } finally {
      setSigningGrant(false);
    }
  }

  function addEnvVar() {
    setEnvVars([...envVars, { key: "", value: "", isPublic: false }]);
  }

  function removeEnvVar(index: number) {
    setEnvVars(envVars.filter((_, i) => i !== index));
  }

  function updateEnvVar(index: number, field: keyof EnvVar, value: string | boolean) {
    setEnvVars(envVars.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  const [deployProgress, setDeployProgress] = useState<string | null>(null);

  async function handleDeploy() {
    setDeploying(true);
    setError(null);
    setDeployProgress(null);

    try {
      // Build env vars including grant credentials if signed
      const allVars: EnvVar[] = [...envVars.filter((v) => v.key && v.value)];

      if (persona.trim()) {
        allVars.push({ key: "AGENT_SOUL", value: persona.trim(), isPublic: false });
      }

      if (grantCredentials) {
        allVars.push(
          {
            key: "EIGENAI_GRANT_MESSAGE",
            value: grantCredentials.message,
            isPublic: false,
          },
          {
            key: "EIGENAI_GRANT_SIGNATURE",
            value: grantCredentials.signature,
            isPublic: false,
          },
          {
            key: "EIGENAI_WALLET_ADDRESS",
            value: grantCredentials.walletAddress,
            isPublic: false,
          }
        );
      }

      const result = await deployAgent(token, name, allVars, verifiable);

      // Handle async deployment (GitHub Actions)
      if (result.pending && result.dispatchId) {
        setDeployProgress(
          "Deployment started. Waiting for EigenCompute to provision your agent..."
        );

        const finalStatus = await pollDeployStatus(
          token,
          result.dispatchId,
          (status) => {
            if (status.status === "pending") {
              const elapsed = status.createdAt
                ? Math.floor((Date.now() - new Date(status.createdAt).getTime()) / 1000)
                : 0;
              setDeployProgress(`Deploying to EigenCompute... (${elapsed}s elapsed)`);
            }
          },
          300000,
          5000
        );

        if (finalStatus.status === "error") {
          throw new Error(finalStatus.error || "Deployment failed");
        }

        setDeployProgress("Deployment complete!");
      }

      onDeployed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(false);
      setDeployProgress(null);
    }
  }

  const totalSteps = 5;

  const steps = [
    { id: 1, title: "Billing", icon: CreditCard },
    { id: 2, title: "Identity", icon: User },
    { id: 3, title: "Authorization", icon: Shield },
    { id: 4, title: "Configuration", icon: Key },
    { id: 5, title: "Review", icon: Server },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isCompleted = s.id < step;

            return (
              <div key={s.id} className="flex flex-col items-center relative z-10">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 bg-background",
                    isActive
                      ? "border-primary text-primary shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      : isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium transition-colors duration-300",
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {s.title}
                </span>
              </div>
            );
          })}

          {/* Progress bar background */}
          <div
            className="absolute top-9 left-0 w-full h-0.5 bg-muted -z-0 hidden md:block"
            style={{ width: "calc(100% - 4rem)", left: "2rem" }}
          />

          {/* Active progress bar */}
          <div
            className="absolute top-9 left-0 h-0.5 bg-primary transition-all duration-500 -z-0 hidden md:block"
            style={{
              width: `calc(${((step - 1) / (totalSteps - 1)) * 100}% - 4rem)`,
              left: "2rem",
            }}
          />
        </div>
      </div>

      <Card className="border-border bg-card shadow-lg">
        {/* Step 1: Billing */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>EigenCloud Billing</CardTitle>
              <CardDescription>
                Agent deployment requires an active EigenCloud subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-card/50 p-4 space-y-4">
                {checkingBilling ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking subscription status...
                  </div>
                ) : billingStatus?.active ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="success"
                        className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-none"
                      >
                        Subscription Active
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Billing Period</span>
                        <p className="font-medium">{billingStatus.period || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current Balance</span>
                        <p className="font-medium">${billingStatus.totalDue}</p>
                      </div>
                    </div>
                    {billingStatus.manageUrl && (
                      <a
                        href={billingStatus.manageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Manage billing <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="warning"
                        className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-none"
                      >
                        No Subscription
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You need an EigenCloud subscription to deploy agents. Pricing is{" "}
                      <span className="font-medium text-foreground">$0.177/vCPU-hour</span> for TEE
                      compute.
                    </p>
                    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
                      <p className="font-medium">To subscribe:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>
                          Install the ecloud CLI:{" "}
                          <code className="bg-muted px-1 rounded">
                            npm i -g @layr-labs/ecloud-cli
                          </code>
                        </li>
                        <li>
                          Run:{" "}
                          <code className="bg-muted px-1 rounded">ecloud billing subscribe</code>
                        </li>
                        <li>Complete payment via Stripe</li>
                      </ol>
                    </div>
                  </>
                )}
              </div>

              {!checkingBilling && !billingStatus?.active && (
                <Button variant="outline" onClick={checkBilling} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check Again
                </Button>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => setStep(2)}
                disabled={checkingBilling || !billingStatus?.active}
                className="w-full"
              >
                {billingStatus?.active ? (
                  <>
                    Continue <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  "Subscription required to continue"
                )}
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 2: Name + Persona */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Name your agent</CardTitle>
              <CardDescription>
                Give your agent a display name and optionally define its personality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="agent-name"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Agent Name
                </label>
                <Input
                  id="agent-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Verifiable Agent"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="agent-persona"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Persona (optional)
                </label>
                <textarea
                  id="agent-persona"
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  placeholder="Be concise and direct. Have opinions. When you discover something non-obvious, log it as a learning."
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  Defines how your agent communicates and behaves. Blank uses the default.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!name.trim()} className="flex-1">
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 3: Authorize EigenAI */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Authorize EigenAI</CardTitle>
              <CardDescription>
                Sign a message to let your agent use your EigenAI grant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grant status */}
              <div className="rounded-lg border bg-card/50 p-4 space-y-4">
                {!grantStatus.checked ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking grant status...
                  </div>
                ) : grantStatus.hasGrant ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="success"
                        className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-none"
                      >
                        Grant Active
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {grantStatus.tokenCount.toLocaleString()} tokens available
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="warning"
                        className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-none"
                      >
                        No Grant Found
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your wallet doesn&apos;t have an EigenAI grant.{" "}
                      <a
                        href="https://determinal.eigenarcade.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:text-primary/80"
                      >
                        Get one at EigenArcade
                      </a>
                      , then return here.
                    </p>
                  </>
                )}
              </div>

              {/* Grant signature status */}
              {grantStatus.hasGrant && (
                <div className="rounded-lg border bg-card/50 p-4">
                  {grantCredentials ? (
                    <div className="flex items-center gap-3 text-emerald-500">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Grant authorized</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Sign a message to authorize your agent to use your grant. This signature is
                        encrypted and only accessible inside the TEE.
                      </p>
                      <Button
                        onClick={handleSignGrant}
                        disabled={signingGrant}
                        variant="outline"
                        className="w-full"
                      >
                        {signingGrant ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Waiting for signature...
                          </>
                        ) : (
                          "Sign Authorization"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setStep(4);
                }}
                disabled={grantStatus.hasGrant && !grantCredentials}
                className="flex-1"
              >
                {grantStatus.hasGrant && !grantCredentials ? "Sign to continue" : "Continue"}
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 4: Env vars */}
        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Configure Environment</CardTitle>
              <CardDescription>
                Add your API keys and configuration. Encrypted variables are only accessible inside
                your agent&apos;s TEE.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {envVars.map((envVar, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 rounded-lg border bg-card/50 p-3 sm:flex-row sm:items-start"
                  >
                    <div className="flex-1 space-y-2">
                      <Input
                        type="text"
                        value={envVar.key}
                        onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                        placeholder="KEY_NAME"
                        className="font-mono text-sm"
                      />
                      <Input
                        type="password"
                        value={envVar.value}
                        onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                        placeholder="Value"
                        className="font-mono text-sm"
                      />
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={envVar.isPublic}
                          onChange={(e) => updateEnvVar(i, "isPublic", e.target.checked)}
                          className="rounded border-input bg-background text-primary focus:ring-primary"
                        />
                        Make public (visible on Verifiability Dashboard)
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvVar(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addEnvVar} className="w-full border-dashed">
                <Plus className="mr-2 h-4 w-4" />
                Add Variable
              </Button>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(5)} className="flex-1">
                Review <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 5: Review and deploy */}
        {step === 5 && (
          <>
            <CardHeader>
              <CardTitle>Review & Deploy</CardTitle>
              <CardDescription>
                Confirm your agent configuration before deploying to EigenCompute.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-lg border bg-card/50 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Agent name</span>
                    <p className="font-semibold text-foreground">{name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Runtime</span>
                    <p className="text-foreground">EigenCompute TEE (Intel TDX)</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Instance type</span>
                    <p className="text-foreground">g1-standard-4t</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Build type</span>
                    <p className="text-foreground">
                      {verifiable ? "Verifiable (on-chain attestation)" : "Standard"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Environment variables</span>
                    <p className="text-foreground">
                      {envVars.filter((v) => v.key).length} custom (
                      {envVars.filter((v) => v.isPublic).length} public,{" "}
                      {envVars.filter((v) => !v.isPublic && v.key).length} encrypted)
                      {grantCredentials && " + 3 grant credentials"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">Persona</span>
                  <p className="mt-1 text-sm text-foreground/90 italic">
                    {persona.trim() ? (
                      `"${persona.trim().slice(0, 120)}${persona.length > 120 ? "..." : ""}"`
                    ) : (
                      <span className="text-muted-foreground not-italic">Default Persona</span>
                    )}
                  </p>
                </div>

                <div className="border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">Authorization</span>
                  <div className="mt-1">
                    {grantCredentials ? (
                      <Badge
                        variant="success"
                        className="bg-emerald-500/15 text-emerald-500 border-none"
                      >
                        Using Wallet Grant
                      </Badge>
                    ) : (
                      <Badge
                        variant="warning"
                        className="bg-amber-500/15 text-amber-500 border-none"
                      >
                        Separate Grant Required
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Verifiable Build</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        On-chain attestation proves exactly what code runs in your agent
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verifiable}
                        onChange={(e) => setVerifiable(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(4)}
                disabled={deploying}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={handleDeploy} disabled={deploying} className="flex-1">
                {deploying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {deployProgress ? "Deploying..." : "Starting..."}
                  </>
                ) : (
                  "Deploy Agent"
                )}
              </Button>
            </CardFooter>
            {deployProgress && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{deployProgress}</span>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
