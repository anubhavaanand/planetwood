# MiroFish Skill — Multi-Agent Scenario Simulation for DeepSeek Harness

> **Version:** 1.0.0 | **License:** MIT | **Author:** anubhavanand  
> **MiroFish:** https://github.com/666ghj/MiroFish | **DSH:** https://github.com/ranxianglei/billion-context  
> **Skill type:** User-level DSH skill (place in `~/.config/dsh/skills/mirofish/SKILL.md`)

---

## Table of Contents

1. [Overview](#overview)
2. [Service URLs & Quick Start](#service-urls--quick-start)
3. [Health Check](#health-check)
4. [Prerequisites](#prerequisites)
5. [Core Concepts](#core-concepts)
6. [The 5-Step Workflow](#the-5-step-workflow)
7. [Endpoint Reference](#endpoint-reference)
8. [Planetwood Data Export](#planetwood-data-export)
9. [Scenario Playbook](#scenario-playbook)
10. [Performance & Cost](#performance--cost)
11. [Troubleshooting](#troubleshooting)
12. [Common Pitfalls](#common-pitfalls)
13. [Validation Checklist](#validation-checklist)

---

## Overview

**MiroFish** is an open-source (AGPL-3.0) AI prediction engine powered by multi-agent swarm intelligence. It extracts seed information from real-world data, automatically constructs a high-fidelity parallel digital world populated by thousands of AI agents with independent personalities, long-term memory, and behavioral logic. Agents interact and socially evolve over simulated rounds, producing structured prediction reports with probabilities, alternative scenarios, key risks, and recommendations.

**Why use it with DSH?** The DeepSeek Harness agent can drive MiroFish entirely via its REST API — no MCP server needed. Feed Planetwood game data as seed material, frame prediction requirements in natural language, and receive actionable simulation reports that inform game balance decisions.

**Key capabilities:**
- Natural language input → full simulation pipeline (no structured data required)
- Thousands of unique agent personalities with emergent social dynamics
- Mid-simulation variable injection ("God's-eye view")
- Post-simulation agent interviews and ReportAgent chat
- GraphRAG knowledge graph anchoring agent memory
- Open source and self-hostable (Docker or source)

---

## Service URLs & Quick Start

| Service | URL |
|---------|-----|
| Frontend (UI) | http://localhost:3000 |
| Backend (API) | http://localhost:5001 |
| Base API path | http://localhost:5001/api |
| Backend health | http://localhost:5001/health |

### One-liner (after filling in `.env`)

```bash
cd /home/anubhavanand/MiroFish && npm run setup:all && npm run dev
```

`npm run dev` starts backend + frontend together via `concurrently`.

### Start individually

```bash
cd /home/anubhavanand/MiroFish && npm run backend   # backend only (port 5001)
cd /home/anubhavanand/MiroFish && npm run frontend  # frontend only (port 3000)
```

### Docker (requires Docker daemon running)

```bash
cd /home/anubhavanand/MiroFish && cp .env.example .env  # then edit keys
docker compose up -d
```

---

## Health Check

Run these before starting any simulation:

```bash
# Backend health (should return {"service":"MiroFish Backend","status":"ok"})
curl -s http://localhost:5001/health

# Frontend (should return 200)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/

# .env validation (no server needed — validates required keys)
cd /home/anubhavanand/MiroFish/backend && uv run python -c "from app.config import Config; print(Config.validate() or 'OK')"

# List existing graph projects (confirms API routing)
curl -s http://localhost:5001/api/graph/project/list
```

---

## Prerequisites

1. **MiroFish installed** at `/home/anubhavanand/MiroFish`
2. **Python 3.11 or 3.12** — the backend pins `>=3.11,<3.13`. System Python 3.14 will NOT work. Install via `uv python install 3.12`.
3. **Node.js ≥ 18** (includes npm) — check with `node -v`
4. **`uv`** (Python package manager) — install from https://docs.astral.sh/uv/
5. **Backend venv** at `/home/anubhavanand/MiroFish/backend/.venv` — create with `cd backend && uv sync`
6. **`.env`** at `/home/anubhavanand/MiroFish/.env` (copy from `.env.example`) with:
   - `LLM_API_KEY` — OpenAI-compatible API key
   - `LLM_BASE_URL` — e.g., `http://localhost:20128/v1` or `https://api.openai.com/v1`
   - `LLM_MODEL_NAME` — e.g., `kilocode/claude-sonnet-4.6-low`, `gpt-4o-mini`
   - `ZEP_API_KEY` — free tier at https://app.getzep.com
   - **Optional:** `LLM_BOOST_API_KEY` + `LLM_BOOST_BASE_URL` + `LLM_BOOST_MODEL_NAME` (all three or none — partial config errors)
   - **Do NOT set `ZEP_API_URL`** — MiroFish only talks to Zep Cloud and errors if present
7. **Dependencies installed:** `npm run setup:all` (root + frontend + backend)
8. **Backend running:** `cd backend && uv run python run.py`
9. **Frontend running:** `cd frontend && npm run dev`

---

## Core Concepts

| Concept | ID | What it is |
|---------|----|-----------|
| **Project** | `project_id` | Container for seed material + ontology. Created during ontology generation. |
| **Ontology** | (embedded in project) | Entity types and edge types extracted from seed. Max 10 types, 10 attrs each. |
| **Graph** | `graph_id` | Knowledge graph built from ontology + seed. Stored in Zep Cloud. |
| **Simulation** | `simulation_id` | Agent simulation instance. Created from a project (derives graph). |
| **Report** | `report_id` | Prediction report. Requires a completed simulation run. |

**Key rule:** Graph building requires a `project_id` (not raw ontology). Simulation creation requires a `project_id` (not `graph_id`). Report generation requires a `simulation_id` with a completed run.

---

## The 5-Step Workflow

### Step 1 — Generate Ontology (Multipart Form-Data)

MiroFish extracts entity types and edge types from seed material. **This is a multipart form upload, not JSON.**

```bash
curl -s -X POST http://localhost:5001/api/graph/ontology/generate \
  -F "files=@seed_material.txt" \
  -F "simulation_requirement=Predict player retention after adding prestige mode"
```

**Required fields:**
- `files` — one or more text files (pdf, md, txt, markdown; max 50MB total)
- `simulation_requirement` — natural language prediction question

**Returns:** `project_id` and ontology definition.

### Step 2 — Build Knowledge Graph

```bash
curl -s -X POST http://localhost:5001/api/graph/build \
  -H "Content-Type: application/json" \
  -d '{"project_id": "PROJECT_ID"}'
```

**Returns:** `graph_id`. The graph is stored in Zep Cloud and anchors agent memory.

### Step 3 — Create & Run Simulation

**3a. Create simulation:**
```bash
curl -s -X POST http://localhost:5001/api/simulation/create \
  -H "Content-Type: application/json" \
  -d '{"project_id": "PROJECT_ID"}'
```
Returns: `simulation_id`.

**3b. Prepare environment:**
```bash
curl -s -X POST http://localhost:5001/api/simulation/prepare \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "SIM_ID"}'
```
Check status (POST, not GET):
```bash
curl -s -X POST http://localhost:5001/api/simulation/prepare/status \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "SIM_ID"}'
```

**3c. Start simulation (set max_rounds here):**
```bash
curl -s -X POST http://localhost:5001/api/simulation/start \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "SIM_ID", "max_rounds": 20}'
```

**3d. Poll run status:**
```bash
curl -s http://localhost:5001/api/simulation/SIM_ID
```

### Step 4 — Generate Report

Report generation requires a **completed** simulation run.

```bash
curl -s -X POST http://localhost:5001/api/report/generate \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "SIM_ID"}'
```
Returns: `report_id`.

**Poll progress:**
```bash
curl -s http://localhost:5001/api/report/REPORT_ID/progress
```

**Get report:**
```bash
curl -s http://localhost:5001/api/report/REPORT_ID
```

**Download report:**
```bash
curl -s http://localhost:5001/api/report/REPORT_ID/download -o report.md
```

### Step 5 — Deep Interaction

**Chat with ReportAgent:**
```bash
curl -s -X POST http://localhost:5001/api/report/chat \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "SIM_ID", "message": "What was the most surprising finding?"}'
```

**Get agent interaction log:**
```bash
curl -s http://localhost:5001/api/report/REPORT_ID/agent-log
```

**Stream agent log:**
```bash
curl -s http://localhost:5001/api/report/REPORT_ID/agent-log/stream
```

---

## Endpoint Reference

### Health & System

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Backend health check |

### Graph (Projects & Knowledge Graph)

| Method | Path | Body / Params | Purpose |
|--------|------|---------------|---------|
| GET | `/api/graph/project/list` | — | List all graph projects |
| GET | `/api/graph/project/{id}` | — | Get project details |
| DELETE | `/api/graph/project/{id}` | — | Delete project |
| POST | `/api/graph/project/{id}/reset` | — | Reset project |
| POST | `/api/graph/ontology/generate` | multipart: `files`, `simulation_requirement` | Generate ontology |
| POST | `/api/graph/build` | `{"project_id": "..."}` | Build knowledge graph |
| GET | `/api/graph/data/{graph_id}` | — | Get graph data |
| DELETE | `/api/graph/delete/{graph_id}` | — | Delete graph |
| GET | `/api/graph/task/{task_id}` | — | Get task status |
| GET | `/api/graph/tasks` | — | List tasks |

### Simulation

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/api/simulation/entities/{graph_id}` | — | List entities |
| GET | `/api/simulation/entities/{graph_id}/{uuid}` | — | Get entity |
| GET | `/api/simulation/entities/{graph_id}/by-type/{type}` | — | Filter by type |
| POST | `/api/simulation/create` | `{"project_id": "..."}` | Create simulation |
| POST | `/api/simulation/prepare` | `{"simulation_id": "..."}` | Prepare environment |
| POST | `/api/simulation/prepare/status` | `{"simulation_id": "..."}` | Check prep status |
| POST | `/api/simulation/start` | `{"simulation_id": "...", "max_rounds": N}` | Run simulation |
| GET | `/api/simulation/{id}` | — | Get simulation details |
| GET | `/api/simulation/list` | — | List simulations |

### Report

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/api/report/generate` | `{"simulation_id": "..."}` | Generate report |
| POST | `/api/report/generate/status` | `{"simulation_id": "..."}` | Check gen status |
| GET | `/api/report/{id}` | — | Get report |
| GET | `/api/report/by-simulation/{sim_id}` | — | Get report by sim |
| GET | `/api/report/list` | — | List reports |
| GET | `/api/report/{id}/download` | — | Download report |
| DELETE | `/api/report/{id}` | — | Delete report |
| POST | `/api/report/chat` | `{"simulation_id": "...", "message": "..."}` | Chat with ReportAgent |
| GET | `/api/report/{id}/progress` | — | Generation progress |
| GET | `/api/report/{id}/sections` | — | Get sections |
| GET | `/api/report/{id}/section/{n}` | — | Get section N |
| GET | `/api/report/check/{sim_id}` | — | Check report exists |
| GET | `/api/report/{id}/agent-log` | — | Agent interaction log |
| GET | `/api/report/{id}/agent-log/stream` | — | Stream agent log |
| GET | `/api/report/{id}/console-log` | — | Console log |
| GET | `/api/report/{id}/console-log/stream` | — | Stream console log |
| POST | `/api/report/tools/search` | `{"query": "..."}` | Search report tools |
| POST | `/api/report/tools/statistics` | `{"..."}` | Statistics tools |

---

## Planetwood Data Export

MiroFish ingests **text only** (pdf, md, txt, markdown; max 50MB). No JSON, GLB, DRC, or KTX2 files. Export game data as markdown/text before seeding.

### Constraints

- Max file size: 50MB (configurable via `MAX_FILE_SIZE_MB`)
- Max text length: 50,000 characters per file (configurable via `MAX_TEXT_LENGTH`)
- Supported formats: pdf, md, txt, markdown
- Text is chunked into 500-character segments for graph building

### Export Recipes

**A. Quest definitions → `quests.md`**
```bash
# Convert src/data/quests.js to markdown
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/data/quests.js','utf8');
// Extract quest objects and format as markdown
console.log('# Planetwood Quests\n');
// ... parse and format
" > /tmp/quests.md
```

**B. NPC roster + positions → `npcs.md`**
```bash
# Extract from main.js NPC_STREET_POS and NPC init
grep -A2 "NPC_STREET_POS" src/main.js | head -40
```

**C. Shop items → `shop.md`**
```bash
cat src/data/shop.js | sed 's/export const/##/g' > /tmp/shop.md
```

**D. Animation data → `animations.md`**
```bash
# Summarize decoded_animations.json by NPC type
python3 -c "
import json
data = json.load(open('public/decoded_animations.json'))
print('# Animation Data Summary')
for npc, anims in data.items():
    print(f'## {npc}: {len(anims)} animations')
" > /tmp/animations.md
```

**E. Scene/mesh counts → `scene.md`**
```bash
# Count meshes, textures, materials
find public -name '*.glb' -o -name '*.drc' | wc -l
```

**F. Multiplayer parameters → `multiplayer.md`**
```bash
# Extract from server/index.js and MultiplayerSystem.js
grep -n "radius\|rateLimit\|maxMessages\|DISCONNECT" src/systems/MultiplayerSystem.js server/index.js
```

### Recommended Seed Template

Create a single `planetwood_seed.md` combining all exports:

```markdown
# Planetwood Game Seed

## Game Overview
Three.js r185 + Vite multiplayer planet game. Node.js WebSocket relay.
Player walks WASD, interacts with NPCs via E key, completes quests.

## Quests
[paste quests.md content]

## NPCs
[paste npcs.md content]

## Economy
[paste shop.md content]

## Multiplayer
[paste multiplayer.md content]

## Player Stats
- Walk speed: 5 units/s, Run: 12 units/s
- Interaction radius: 7 units
- Chat radius: 20 units (default), rate limit: 2s, max 100 messages
- Planet transition: z > 160
```

---

## Scenario Playbook

### Scenario A — Player Retention (Prestige Mode)

**Purpose:** Predict whether the prestige system (GD-06) increases 7-day retention.

**Player Fantasy:** "I keep my progress and get a reward multiplier."

**Seed contents:** Quest list, prestige dialogues, stardust/multiplier values, daily reward schedule.

**Simulation requirement:**
> "Predict 7-day retention rate for players who complete prestige vs. those who don't. Test sensitivity across multiplier 1.2×, 1.5×, 2.0×. Identify which player archetype (completionist, socializer, explorer) benefits most."

**Entities:** Player, Quest, PrestigeTier, DailyReward, NPC  
**Metrics:** retention_7d, prestige_adoption_rate, avg_prestige_level  
**Failure indicators:** retention_7d < 40% for prestige players; prestige_adoption < 20%  
**Tuning levers:** multiplier value, stardust cost, quest cycle count (5 vs 10)

---

### Scenario B — Quest Balance

**Purpose:** Find which quest has the highest abandonment rate.

**Seed contents:** All quest steps with objectives, NPC names, rewards (XP/coins/reputation).

**Simulation requirement:**
> "Which quest step has the highest abandonment rate? Identify if any quest has >25% drop-off. Compare branch choices (promote vs. apologize vs. silent) for completion time and satisfaction."

**Entities:** Quest, QuestStep, NPC, Player, Reputation  
**Metrics:** step_completion_rate, abandonment_rate, time_to_complete, branch_choice_distribution  
**Failure indicators:** any step < 75% completion; any branch < 10% selection  
**Tuning levers:** objective clarity, reward size, NPC proximity, interaction radius (7m)

---

### Scenario C — NPC Dialogue Impact

**Purpose:** Test if boss quest branching causes player frustration.

**Seed contents:** Boss dialogue tree, reputation consequences, branch text overrides.

**Simulation requirement:**
> "Simulate 100 players completing the office-worker quest. Measure satisfaction scores for each branch (promote: +25 boss rep, apologize: +10 office-worker rep, silent: none). Identify if silent branch causes >30% dissatisfaction."

**Entities:** NPC (Boss, OfficeWorker), Player, DialogueBranch, Reputation  
**Metrics:** satisfaction_score, branch_selection_rate, replay_rate  
**Failure indicators:** any branch < 3.0/5.0 satisfaction; silent branch > 30% dissatisfaction  
**Tuning levers:** dialogue text, reputation values, branch consequences

---

### Scenario D — Economy Inflation

**Purpose:** Detect coin economy inflation or deflation.

**Seed contents:** Shop items (28 accessories with costs + level gates), quest rewards, daily login rewards.

**Simulation requirement:**
> "Simulate 50 players over 30 in-game days. Track coin balance per player per day. Identify if any player accumulates >10,000 coins without spending (inflation) or if any player cannot afford any shop item after 7 days (deflation). Test sensitivity across coin drop rates of 0.1, 0.25, 0.6."

**Entities:** Player, Coin, ShopItem, QuestReward, DailyReward  
**Metrics:** avg_coin_balance, sink_source_ratio, players_with_zero_spend, inflation_rate  
**Failure indicators:** sink/source ratio < 0.5 (inflation); any player unable to buy cheapest item after 7 days (deflation)  
**Tuning levers:** coin rewards, shop prices, level gates, daily reward amounts

---

### Scenario E — Multiplayer Social Dynamics

**Purpose:** Predict chat toxicity and social clustering.

**Seed contents:** Chat radius (20m), rate limit (2s), max messages (100), plaza layout.

**Simulation requirement:**
> "Simulate 20 concurrent players in the plaza area. Measure: chat message frequency, proximity clustering (players within 7m), new player first-interaction time, and griefing incidents (spam, blocking). Identify if rate limit of 2s is too restrictive or too permissive."

**Entities:** Player, ChatMessage, ProximityCluster, Plaza  
**Metrics:** messages_per_min, avg_cluster_size, first_interaction_time, griefing_rate  
**Failure indicators:** griefing_rate > 5%; first_interaction_time > 120s; messages_per_min < 0.5 (too restrictive)  
**Tuning levers:** chat radius, rate limit, max messages, plaza size

---

### Scenario F — Difficulty Spikes

**Purpose:** Find where players get stuck or frustrated.

**Seed contents:** Street layout (NPC positions from z=-120 to z=240), quest objectives, interaction radius.

**Simulation requirement:**
> "Simulate 50 players completing all 6 quests. Measure: time per quest, backtrack rate (returning to previous area), and quest abandonment. Identify any quest with >20% abandonment or >10 min average completion time. Check if NPC placement causes navigation confusion (players walking past NPCs without noticing)."

**Entities:** Player, Quest, NPC, StreetSegment, InteractionZone  
**Metrics:** quest_completion_time, backtrack_rate, abandonment_rate, npc_discovery_rate  
**Failure indicators:** any quest > 20% abandonment; any quest > 10 min avg; npc_discovery_rate < 80%  
**Tuning levers:** NPC positions, interaction radius, quest objective clarity, street lighting

---

## Performance & Cost

### LLM Token Optimization

| Knob | Effect | Recommendation |
|------|--------|----------------|
| `LLM_MODEL_NAME` | Quality vs. cost | Use `kilocode/claude-haiku-5.5` or `gpt-4o-mini` for agent gen; boost model for profile gen |
| `max_rounds` | Simulation depth | Start with 10, increase to 20-30 for production |
| Text chunk size | Graph granularity | Default 500 chars; larger = fewer chunks = lower ZEP cost |
| Agent count | Simulation fidelity | Derived from graph entities; prune irrelevant entity types |

### Round-Count Cost Ladder

| Rounds | Cost | Use Case |
|--------|------|----------|
| 10 | ~$0.50 | Smoke test, sanity check |
| 20 | ~$2.00 | Standard scenario |
| 30-40 | ~$5.00 | Deep analysis |
| 100+ | ~$15.00+ | Full simulation (use boost model) |

### ZEP Hard Limits (from source code)

| Limit | Value | Config Key |
|-------|-------|------------|
| Max ontology types | 10 | `MAX_ONTOLOGY_TYPES` |
| Max attributes per type | 10 | `MAX_ATTRIBUTES_PER_TYPE` |
| Max source-targets per edge | 10 | `MAX_SOURCE_TARGETS_PER_EDGE` |
| Max file size | 50MB | `MAX_FILE_SIZE_MB` |
| Max text length | 50,000 chars | `MAX_TEXT_LENGTH` |
| Text chunk size | 500 chars | `TEXT_CHUNK_SIZE` |

### Cost Heuristic

```
estimated_cost = (num_entities × avg_profile_tokens × rounds) × (llm_price_per_1k / 1000)
```

### Cheapest Smoke Test

```bash
# Use free model + 10 rounds + minimal seed
curl -s -X POST http://localhost:5001/api/graph/ontology/generate \
  -F "files=@minimal_seed.txt" \
  -F "simulation_requirement=Quick test"
```

Set `LLM_MODEL_NAME=openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` for zero-cost testing.

---

## Troubleshooting

### Port Conflicts

```bash
# Check what's using ports
lsof -i :3000 -i :5001 -i :20128 2>/dev/null

# Kill conflicting processes
fuser -k 3000/tcp 5001/tcp 2>/dev/null
```

### Python Version Mismatch

```bash
# Check system Python (should NOT be 3.14)
python3 --version

# Use uv-managed Python
uv python install 3.12
cd /home/anubhavanand/MiroFish/backend && uv sync
```

### Docker Daemon Not Running

```bash
# Check daemon
docker info 2>&1 | head -3

# Start (requires passwordless sudo or root)
sudo systemctl start docker
# OR use source deployment instead
```

### .env Validation Errors

```bash
# Validate without starting server
cd /home/anubhavanand/MiroFish/backend && uv run python -c "from app.config import Config; print(Config.validate() or 'OK')"

# Common errors:
# - "ZEP_API_URL must not be set" → remove ZEP_API_URL from .env
# - "LLM_BOOST_* must all be set or all unset" → either set all three or remove all three
# - "LLM_API_KEY is required" → check .env path (must be at project root, not backend/)
```

### Frontend-to-Backend Proxy Issues

```bash
# Test backend directly (bypass frontend proxy)
curl -s http://localhost:5001/health

# Test frontend proxy
curl -s http://localhost:3000/api/health 2>&1 | head
```

### API-Specific Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `400: files required` | Ontology generate needs multipart upload | Use `-F files=@seed.txt` not JSON |
| `400: project_id required` | Build/create needs project_id, not graph_id | Get project_id from ontology response |
| `400: simulation not prepared` | Must call prepare before start | Call `/simulation/prepare` first |
| `400: simulation not terminal` | Report needs completed run | Wait for simulation to finish |
| `404: project not found` | Wrong project_id or deleted | Re-generate ontology |
| `500: ZEP error` | ZEP key invalid or quota exceeded | Check ZEP_API_KEY and usage |

---

## Common Pitfalls

1. **Sending JSON to ontology/generate** — it expects multipart form-data with `files` field. JSON will fail.
2. **Using `graph_id` instead of `project_id`** — build and create endpoints need `project_id`. The graph is derived from the project.
3. **Forgetting the `/simulation/start` step** — prepare alone doesn't run the simulation. You must call start with `max_rounds`.
4. **Generating report before simulation completes** — report/generate requires a terminal (finished) simulation run.
5. **Setting `ZEP_API_URL`** — MiroFish only supports Zep Cloud. Setting this env var causes an error.
6. **Partial boost config** — `LLM_BOOST_*` must be all three or none. Partial causes validation error.
7. **Python 3.14** — backend requires 3.11–3.12. System Python 3.14 will fail on install.
8. **.env in wrong location** — must be at `MiroFish/.env`, not `MiroFish/backend/.env`.
9. **Not validating .env before starting** — run `Config.validate()` to catch issues early.

---

## Validation Checklist

Before running a scenario, verify:

- [ ] Backend health returns `{"status":"ok"}`
- [ ] Frontend returns HTTP 200
- [ ] `.env` validation prints `OK`
- [ ] `npm run setup:all` completed successfully
- [ ] Seed material is text format (pdf/md/txt), under 50MB
- [ ] Simulation requirement is a clear, falsifiable question
- [ ] `max_rounds` is set (start with 10 for testing)
- [ ] You have a plan for what metric indicates success/failure

---

## Ethics Note

MiroFish simulations can model player behavior at scale. When using this for game design:

- **Do not** use simulations to identify and exploit vulnerable player segments
- **Do not** optimize monetization loops that prey on compulsive behavior
- **Do** use simulations to improve game balance, fairness, and player experience
- **Do** validate simulation findings with real player testing before shipping changes
- **Do** be transparent with players about data usage and simulation practices

---

## License

This skill is released under the MIT License. MiroFish itself is AGPL-3.0.

## Contributing

To contribute improvements to this skill:

1. Fork the repository
2. Create a feature branch
3. Test changes against a live MiroFish instance
4. Submit a pull request with before/after comparison

For MiroFish upstream contributions, see https://github.com/666ghj/MiroFish.
EOF
echo "Skill written to /home/anubhavanand/Documents/Projects/planetwood/mirofish-skill/SKILL.md"