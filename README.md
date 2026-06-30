# QuorumCall

**A petition that passes once it gathers N consensus-VERIFIED endorsements, on GenLayer.**

Open a petition: an action to trigger, an eligibility criterion endorsers must meet, and a threshold.
Each `endorse` submits evidence of the endorser's eligibility; every validator independently judges
whether the evidence proves eligibility, accepted only when they agree on the boolean (comparative
equivalence). Only **verified, unique** endorsements count — when the verified count reaches the
threshold, the petition flips to `passed` (the trigger).

The verb is **"gather verified endorsements until a threshold fires"** — a quorum gate, distinct from a
trust score or a single verdict; ineligible/duplicate endorsements simply don't count.

- **Live demo:** https://quorumcall.pages.dev
- **Contract (Bradbury, chain 4221):** `0x447a49c8590DCeDDFb48F7843466B9F734c97E7e`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x447a49c8590DCeDDFb48F7843466B9F734c97E7e

---

## Why GenLayer is essential

Sybil-resistant petitions need to *verify* each endorser is genuinely eligible — from real-world
evidence, not just a wallet signature. GenLayer has validators independently check each endorsement's
evidence and agree before it counts, so a quorum means N verified humans/members, not N throwaway keys.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Open | `open_petition(action, eligibility, threshold)` | Defines the trigger + who may endorse. |
| Endorse | `endorse(id, evidence_url)` | Consensus verifies eligibility; verified + unique → counts. |
| Trigger | *(automatic)* | At `verified ≥ threshold` the state flips to `passed`. |
| Read | `get_petition(id)` / `stats()` | Verified count, endorsement log, state. |

### Correctness check

`_check` wraps the eligibility judgment in **`gl.eq_principle.prompt_comparative`** — principle: *"the
`eligible` boolean must match across validators."* `validate_elig` requires a real boolean + reason;
`normalize_elig` defaults to **ineligible**. Each address may endorse once (dedup), and only `eligible`
endorsements increment the verified count; the threshold flip is deterministic. Unit-tested incl.
ineligible→not-counted, duplicate guard, and a verified→threshold→passed run.

## Architecture

```
QuorumCall/
├── contracts/quorum_call.py  ← GenLayer Intelligent Contract (consensus eligibility + quorum threshold trigger)
├── tests/                    ← pytest: eligibility guards, dedup, endorse→threshold→passed flow
└── app/                      ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                rose petition theme, quorum progress bar + endorsement log
```

## Tests

```bash
cd QuorumCall
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_elig` / `validate_elig`, a threshold guard, and a full **ineligible → verify →
duplicate-guard → threshold → passed** run (shim auto-inits `TreeMap`, varies `sender_address`).
**On-chain smoke-tested:** `open_petition` write + `get_petition` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/quorum_call.py
```
