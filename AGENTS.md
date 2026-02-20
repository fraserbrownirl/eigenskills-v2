# SkillsSeal — Agent Context

This file provides AI agents with a complete map of the codebase. Read this before exploring.

## Architecture Overview

SkillsSeal is a verifiable agent platform on EigenLayer's EigenCompute. Users connect an Ethereum wallet, configure API keys, and deploy a personal AI agent into a Trusted Execution Environment (TEE). The agent routes tasks to skills from a curated GitHub registry using EigenAI, and every action is cryptographically signed.

**Three components:**
1. **Agent** (`agent/`) — Docker container deployed per-user into TEE
2. **Backend** (`backend/`) — Express server orchestrating deploys + SIWE auth
3. **Frontend** (`frontend/`) — Next.js web app for wallet connect, setup, dashboard

**No smart contracts** — the curated GitHub registry is the trust model.

## File Map

### Agent (`agent/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/index.ts` | Express HTTP server, 5 endpoints | App startup, route handlers |
| `src/wallet.ts` | TEE wallet via viem `mnemonicToAccount` | `getAgentAddress()`, `signMessage()` |
| `src/router.ts` | EigenAI skill routing with tool calling + graph traversal | `routeTask()`, `agentLoop()`, `checkGrantStatus()` |
| `src/graph.ts` | Skill graph fetching and wikilink extraction | `fetchGraphNode()`, `fetchGraphIndex()`, `resolveWikilinks()` |
| `src/registry.ts` | Fetches/caches registry.json from GitHub | `listSkills()`, `getSkill()`, `fetchRegistry()` |
| `src/executor.ts` | Sandboxed skill execution | `executeSkill()` |
| `src/logger.ts` | Signed execution log (in-memory, 1000 cap) | `log()`, `getHistory()` |
| `Dockerfile` | Simple image (linux/amd64, root, Python) — CLI auto-layers TEE tools | — |

### Backend (`backend/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/index.ts` | Express server + all API routes | App startup, 8 route handlers |
| `src/auth.ts` | SIWE verification + HMAC session tokens | `verifySiweMessage()`, `createToken()`, `requireAuth` middleware |
| `src/db.ts` | SQLite database (users + agents tables) | `createUser()`, `createAgent()`, `getAgentByUser()`, `updateAgent()` |
| `src/eigencompute.ts` | Deploy orchestrator (CLI primary, SDK fallback) | `deployAgent()`, `deployViaCli()`, `upgradeAgent()`, `stopAgent()`, `startAgent()`, `terminateAgent()`, `getAppInfo()` |
| `src/eigencompute-sdk.ts` | SDK fallback via `@layr-labs/ecloud-sdk` (no Docker, no CLI) | `deployAgent()`, `upgradeAgent()`, `stopAgent()`, `startAgent()`, `terminateAgent()` |

### Frontend (`frontend/src/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `app/page.tsx` | Main page — landing/setup/dashboard flow | — |
| `app/layout.tsx` | Root layout, dark theme, Geist fonts | — |
| `components/ConnectWallet.tsx` | MetaMask connect + SIWE sign-in | — |
| `components/AgentSetup.tsx` | 4-step wizard (name, grant, env vars, deploy) | — |
| `components/Dashboard.tsx` | Agent status, controls, task submission | — |
| `lib/wallet.ts` | MetaMask helpers, SIWE message creation | `connectWallet()`, `signSiweMessage()`, `signGrantMessage()` |
| `lib/api.ts` | Backend API client | `verifyAuth()`, `deployAgent()`, `submitTask()`, etc. |

### Registry (`registry/`)

| File | Purpose |
|------|---------|
| `registry.json` | Auto-generated skill index (id, name, contentHash, requiresEnv) |
| `scripts/generate-registry.py` | Validates SKILL.md, computes hashes, writes registry.json |
| `scripts/validate-graph.py` | Validates skill graph wikilinks, reachability, orphan detection |
| `skills/*/SKILL.md` | Skill manifest (YAML frontmatter: name, description, requires_env, execution) |
| `graph/*.md` | Skill graph nodes (index, MOCs, concept files with wikilinks) |
| `.github/workflows/update-registry.yml` | GitHub Action to regenerate registry.json on push |

### Skill Graph (`registry/graph/`)

The skill graph enables progressive disclosure for complex task routing. Instead of dumping all 34 skill descriptions into the system prompt, the agent navigates a knowledge graph via the `explore_skills` tool.

| File | Purpose |
|------|---------|
| `index.md` | Entry point — lists all domains and skill IDs, injected into system prompt |
| `defi.md` | DeFi domain MOC — Aave lending, DEX swaps, pools, token data |
| `social.md` | Social domain MOC — Twitter operations |
| `ai.md` | AI domain MOC — LLM access (Anthropic, Google, OpenAI) |
| `identity.md` | Identity domain MOC — ENS, wallet validation |
| `text-tools.md` | Text tools MOC — summarize, translate, humanize |
| `aave-lending.md` | Sub-MOC — Full Aave V3 lending lifecycle |
| `dex-trading.md` | Sub-MOC — Quote-then-swap flow, pool discovery |
| `ens-management.md` | Sub-MOC — ENS commit-reveal registration lifecycle |
| `x402-payments.md` | Concept node — How PayToll x402 micropayments work |

**Graph Structure:**
- Every node has YAML frontmatter with `id`, `description`, `skills[]`, `links[]`
- Body text contains `[[wikilinks]]` woven into prose explaining *when and why* to follow paths
- SKILL.md files also have wikilinks connecting related skills and concepts

**Agent Integration:**
- `agent/src/graph.ts` — `fetchGraphNode()`, `fetchGraphIndex()`, caching
- `agent/src/router.ts` — `explore_skills` tool definition, handles graph traversal in agentic loop
- System prompt injects `index.md` content instead of flat skill list

## API Contracts

### Backend Routes (all require Bearer token except `/api/auth/verify`)

| Method | Path | Request Body | Response | Description |
|--------|------|--------------|----------|-------------|
| POST | `/api/auth/verify` | `{ message, signature }` | `{ token, address, agent? }` | Verify SIWE, issue session token |
| POST | `/api/agents/deploy` | `{ name, envVars: [{key, value, isPublic}], verifiable? }` | `{ agent }` | Deploy new agent to EigenCompute |
| POST | `/api/agents/upgrade` | `{ envVars }` | `{ success }` | Update agent env vars |
| POST | `/api/agents/stop` | — | `{ success }` | Pause agent |
| POST | `/api/agents/start` | — | `{ success }` | Resume agent |
| POST | `/api/agents/terminate` | — | `{ success }` | Destroy agent (irreversible) |
| GET | `/api/agents/info` | — | `{ agent }` | Get agent status + metadata |
| POST | `/api/agents/task` | `{ task }` | `{ result, skills, routingSignature, agentSignature }` | Proxy task to agent |

### Agent Routes (no auth — relies on TEE network isolation)

| Method | Path | Request Body | Response | Description |
|--------|------|--------------|----------|-------------|
| POST | `/task` | `{ task, userAddress }` | `{ result, skills, routingSignature, agentSignature }` | Execute task via skill routing |
| GET | `/skills` | — | `{ skills: [...] }` | List available skills (filtered by env vars) |
| GET | `/history` | — | `{ history: [...] }` | Signed execution log |
| GET | `/whoami` | — | `{ address, network, registryUrl, tee }` | Agent identity |
| GET | `/health` | — | `{ status: 'ok' }` | Liveness check |

## Data Flow: Task Execution

```
Frontend                    Backend                     Agent (TEE)
   |                           |                            |
   |-- POST /api/agents/task ->|                            |
   |                           |-- POST /task ------------->|
   |                           |                            |-- listSkills()
   |                           |                            |-- routeTask() [EigenAI tool call]
   |                           |                            |-- executeSkill() [sandboxed]
   |                           |                            |-- signMessage(result)
   |                           |<-- { result, signatures } -|
   |<-- { result, signatures } |                            |
```

## Implementation Status

### Complete
- TEE wallet derivation (viem)
- EigenAI routing with tool calling + grant auth
- Sandboxed skill execution (restricted env vars)
- Signed execution logging
- SIWE authentication (frontend + backend)
- **Deploy architecture: CLI primary + SDK fallback** — CLI tries first, SDK fallback on Fly.io (no Docker). Both paths work. See "Deploy Troubleshooting" section.
- Verifiable build toggle in frontend — user chooses on-chain attestation
- 4-step agent setup wizard with verifiable build option
- Dashboard with status, controls, task submission
- Skill registry with 34 skills (3 original + 31 PayToll API skills) + GitHub Action CI
- **Skill graph system** — traversable knowledge graph with MOCs, wikilinks, `explore_skills` tool
- Skills panel with domain-based grouping (DeFi, Social, AI, Identity, Text Tools)

### Missing / Incomplete
- No tests (zero coverage)
- Client-generated SIWE nonce (should be server-issued)
- No session persistence (state lost on page refresh)
- No "Update Env Vars" UI (API exists, no frontend)
- No execution history view in Dashboard
- SQLite database (not production-ready)
- Content hash verification not implemented (registry has hashes, executor doesn't verify)
- WalletConnect installed but unused (MetaMask only)

### Deferred to V2
- EigenLayer AVS integration
- Agent-to-agent communication
- Skill marketplace with payments
- Multi-agent orchestration

## Common Tasks

| Task | Where to Edit |
|------|---------------|
| Add a new backend API route | `backend/src/index.ts` — add route handler, update `requireAuth` if needed |
| Add a new agent endpoint | `agent/src/index.ts` — add Express route |
| Change auth logic | `backend/src/auth.ts` (SIWE verify, token create/verify) |
| Add a new skill | See "Adding Skills" section below |
| Change skill execution | `agent/src/executor.ts` — `executeSkill()` function |
| Change EigenAI routing | `agent/src/router.ts` — tool definitions, prompt, response parsing |
| Add frontend component | `frontend/src/components/`, import in `page.tsx` |
| Add API client method | `frontend/src/lib/api.ts` |
| Change database schema | `backend/src/db.ts` — add migration in `initDb()` |

## Adding Skills

### 1. Create Skill Files

```
registry/skills/{skill-name}/
├── SKILL.md     # Manifest with YAML frontmatter
└── run.js       # Execution script (or run.py, run.sh)
```

**SKILL.md structure:**
```markdown
---
name: skill-name
description: >
  One-sentence description of what this skill does.
version: 1.0.0
author: skillsseal
requires_env: [API_KEY_NAME]   # Or [] if no keys needed
execution:
  - run: node run.js {{input}}
---

# Skill Title

Prose description with [[wikilinks]] to related skills and concepts.
Link to domain MOC: [[defi]] or [[social]] or [[ai]] or [[identity]] or [[text-tools]].
Link to related skills: [[other-skill-name]].
```

### 2. Update Skill Graph

1. **Add skill to relevant MOC** — edit `registry/graph/{domain}.md`:
   - Add skill ID to `skills:` array in frontmatter
   - Add `[[skill-name]]` wikilink in prose where contextually relevant

2. **If new sub-domain** — create sub-MOC (e.g., `registry/graph/new-topic.md`):
   - Frontmatter: `id`, `description`, `skills[]`, `links[]`
   - Body: prose with `[[wikilinks]]` explaining relationships
   - Link from parent MOC

### 3. Validate and Generate

```bash
cd registry
python scripts/validate-graph.py    # Check wikilinks, reachability
python scripts/generate-registry.py # Regenerate registry.json
```

### 4. TEE Compatibility Checklist

| Requirement | Check |
|-------------|-------|
| No local filesystem access | TEE storage is ephemeral |
| No OAuth browser flows | Headless container, no UI |
| No self-modification | Breaks TEE attestation |
| No LAN/local network | Cloud-hosted, isolated |
| Minimal dependencies | Container size matters |
| API keys via env vars | KMS-encrypted in TEE |

## Known Gotchas

### Deploy Strategy (CLI Primary, SDK Fallback on Fly.io)

The backend uses CLI-based deployment as the primary path, with SDK as fallback:

| Strategy | When Used | Docker Needed? | Description |
|----------|-----------|----------------|-------------|
| **CLI** (primary) | Always tried first | Yes | Shells out to `ecloud` CLI with tested flags. CLI auto-layers TEE tools (KMS client, env script) at deploy time. Simple Dockerfile, no manual TEE setup. |
| **SDK** (fallback) | When CLI fails due to no Docker | No | Falls back to `@layr-labs/ecloud-sdk` TypeScript package. Uses `prepareDeployFromVerifiableBuild()`. |
| **GitHub Actions** | When `USE_GITHUB_ACTIONS=true` | No (on host) | Triggers a GitHub Actions workflow. Async — results delivered via webhook. Legacy option. |

**Critical: On Fly.io, Docker is NOT available.** The backend container on Fly.io doesn't have a Docker daemon. This means:
1. CLI deploy is attempted first
2. CLI fails with "Docker is not running" error
3. Backend catches this error and falls back to SDK
4. SDK's `prepareDeployFromVerifiableBuild()` deploys the pre-built image

This is the **intended behavior**, not a bug. The SDK fallback works correctly — it successfully deployed multiple apps. Do NOT "fix" this by removing the SDK fallback or changing the deploy strategy.

**Verifiable Build Toggle:** The frontend exposes a toggle for "Verifiable Build" (default: on). When enabled, the CLI answers "y" to "Build from verifiable source?" prompt, generating on-chain attestation. When disabled, answers "n" for faster deploys without source verification.

**Why CLI over SDK?** The CLI handles TEE tooling automatically (auto-layers `compute-source-env.sh`, `kms-client`, labels, ENTRYPOINT). The SDK's `prepareDeployFromVerifiableBuild()` also works but requires the image to already be pushed to Docker Hub.

### Deploy Troubleshooting

**When deploys fail with 500 error, check these in order:**

#### 1. Check Active App Quota
```bash
ecloud compute app list --environment sepolia --private-key 0x...
```
EigenCompute has a limit on active apps per wallet. If you have too many running/stopped apps, new deploys will revert with `EstimateGasExecutionError`. **Fix: Terminate stale apps.**

#### 2. Check Billing Status
```bash
ecloud billing status --private-key 0x...
```
If credits are exhausted or there's an outstanding balance, deploys may be blocked. **Fix: Settle balance via Stripe portal link in output.**

#### 3. Common Error: `EstimateGasExecutionError: Execution reverted`
This is an on-chain revert during gas estimation. Causes:
- **App quota exceeded** — too many active apps on the wallet
- **Billing issue** — credits exhausted or outstanding balance
- **Contract state issue** — rare, usually resolves after terminating stuck apps

This error does NOT mean the deploy code is broken. The SDK's `prepareDeployFromVerifiableBuild()` is the correct method — it works for pre-built Docker images despite the name suggesting "verifiable source builds."

#### 4. Diagnostic Commands
```bash
# List all apps (including terminated)
ecloud compute app list --environment sepolia --all --private-key 0x...

# Get app details
ecloud compute app info <app-id> --environment sepolia --private-key 0x...

# Terminate a stale app
echo "y" | ecloud compute app terminate <app-id> --environment sepolia --private-key 0x...

# Check billing
ecloud billing status --private-key 0x...
```

#### 5. What NOT to Do
- Do NOT change `eigencompute.ts` or `eigencompute-sdk.ts` when deploys fail — the architecture is correct
- Do NOT remove the SDK fallback — it's required for Fly.io where Docker is unavailable
- Do NOT assume the error is a code bug — check operational issues (quota, billing) first

### Wallet: viem, not ethers
Agent wallet uses `viem` (`mnemonicToAccount`). The `ethers` package is in dependencies but unused.

### Two Different "EigenAI" Endpoints
- **Grant API:** `https://determinal-api.eigenarcade.com/api/chat/completions` — what the agent actually calls
- **Direct EigenAI:** `https://eigenai-sepolia.eigencloud.xyz/v1/chat/completions` — documented but not used

The router uses the Grant API with wallet signature authentication, not direct EigenAI.

### `_PUBLIC` Suffix Convention
Env vars ending in `_PUBLIC` are visible on-chain in EigenCompute. All others are KMS-encrypted and only decrypted inside the TEE.

### Skill `requires_env` Filtering
`registry.ts` filters skills by whether their `requires_env` vars are present. If a skill requires `OPENAI_API_KEY` and the agent doesn't have it, that skill won't appear in `listSkills()`.

### Dev Mode Behavior
- No `MNEMONIC` env var → `wallet.ts` returns zero-address and dummy signatures
- `SKILL_REGISTRY_LOCAL` env var → `executor.ts` copies from local path instead of git sparse-checkout

### Docker Image Updates via Upgrade
EigenCompute supports in-place image updates that **preserve the wallet**. To deploy new agent code:
1. Rebuild + push Docker image to Docker Hub
2. Call `upgradeAgent()` (Dashboard "Update" or API `POST /api/agents/upgrade`)
3. Wallet address, grants, and instance IP remain unchanged

What stays the same across upgrades:
- App ID
- TEE wallet address (same MNEMONIC)
- Instance IP (usually)
- EigenAI grant activation

What changes:
- Docker image (new attestation generated)
- Environment variables (if updated)

### When to Terminate (Rare)
Only terminate when you want to **permanently destroy** the agent:
- Wallet is destroyed and funds are irrecoverable
- Requires fresh deploy with new wallet address
- New wallet requires new EigenAI grant activation at https://eigenarcade.com

### TEE Network Binding (Critical)
**Servers MUST bind to `0.0.0.0`, not localhost.** Inside the TEE container, `app.listen(PORT)` defaults to `127.0.0.1`, which rejects all external connections. The symptom is a container that shows "running" but returns `ECONNREFUSED` on the instance IP. Fix: `app.listen(PORT, "0.0.0.0", callback)`. This applies to the agent's Express server and any other HTTP listener deployed to EigenCompute.

### TEE Constraints (Critical for Architecture)

**No Persistent Storage**
- EigenCompute has no volumes, no disk mounts, no persistent filesystem
- Container filesystem is wiped on every `stop`/`start`/`upgrade`
- All persistence must go through external storage (Supabase, backend API, IPFS)
- Use signed-state pattern: sign state before saving, verify signature when loading

**Trust Anchors**
- **Wallet** = identity anchor (persists across upgrades, destroyed on terminate)
- **Docker image** = trust anchor (attestation proves this exact image runs)
- **TEE attestation** = binding (proves only this image can access the wallet)

**Attestation is Docker-Digest-Specific**
- On-chain record proves the SHA-256 digest of the deployed image
- If agent modifies its own files at runtime, modified code runs **unattested**
- This breaks verifiability — never self-modify source files

**Evolution Strategies**
- **Config-driven** (recommended): same image, behavior changes through external config/data
- **Upgrade-mediated**: new image via `upgrade`, new attestation, wallet preserved

See `docs/eigencompute-reference.md` for detailed documentation.

## Reference Docs

For deeper details, read these in `docs/`:
- `eigenskills-build-plan.md` — Full architecture, component design, build phases (legacy filename)
- `eigenai-reference.md` — EigenAI API, grant auth flow, signature verification
- `eigencompute-reference.md` — Dockerfile requirements, CLI commands, env vars
- `README.md` — Setup instructions, troubleshooting
