# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
QuorumCall — a petition that passes once it gathers N consensus-VERIFIED endorsements.

Open a petition: an action to trigger, an eligibility criterion endorsers must
meet, and a threshold. Each `endorse` submits evidence of the endorser's
eligibility; every validator independently judges whether the evidence proves
eligibility, accepted only when they agree on the boolean (comparative
equivalence). Only verified, unique endorsements count — when the verified count
reaches the threshold, the petition state flips to `passed` (the trigger).

The verb is "gather verified endorsements until a threshold fires" — a quorum
gate, distinct from a trust score or a single verdict; ineligible/duplicate
endorsements simply don't count.
"""
import json
from genlayer import *


def normalize_elig(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    eligible = raw.get("eligible")
    eligible = bool(eligible) if isinstance(eligible, bool) else str(eligible).strip().lower() in ("true", "yes", "1")
    reason = raw.get("reason")
    reason = reason[:300] if isinstance(reason, str) and reason.strip() else "no reason"
    return {"eligible": eligible, "reason": reason}


def validate_elig(data) -> bool:
    if not isinstance(data, dict):
        return False
    if not isinstance(data.get("eligible"), bool):
        return False
    r = data.get("reason")
    return isinstance(r, str) and bool(r.strip())


class QuorumCall(gl.Contract):
    petitions: TreeMap[str, str]
    petition_count: u256
    passed_count: u256
    endorsement_count: u256

    def __init__(self):
        self.petition_count = u256(0)
        self.passed_count = u256(0)
        self.endorsement_count = u256(0)

    @gl.public.write
    def open_petition(self, action: str, eligibility: str, threshold: int) -> str:
        action = str(action).strip()
        eligibility = str(eligibility).strip()
        if not action or not eligibility:
            raise Exception("action and eligibility required")
        try:
            thr = int(threshold)
        except Exception:
            thr = 0
        if thr < 1:
            raise Exception("threshold must be >= 1")
        key = str(int(self.petition_count))
        rec = {
            "creator": str(gl.message.sender_address),
            "action": action[:300],
            "eligibility": eligibility[:300],
            "threshold": thr,
            "state": "gathering",      # gathering -> passed
            "endorsers": [],           # verified, unique addresses
            "log": [],                 # [{by, eligible, reason}]
        }
        self.petitions[key] = json.dumps(rec)
        self.petition_count += u256(1)
        return key

    @gl.public.write
    def endorse(self, petition_id: str, evidence_url: str) -> dict:
        """Endorse with evidence of your eligibility; only verified, unique endorsements count."""
        petition_id = str(petition_id)
        if petition_id not in self.petitions:
            raise Exception("unknown petition")
        p = json.loads(self.petitions[petition_id])
        if p["state"] != "gathering":
            raise Exception("petition already passed")
        sender = str(gl.message.sender_address)
        if sender in p["endorsers"]:
            raise Exception("already endorsed")

        res = self._check(p["eligibility"], str(evidence_url).strip())
        p["log"].append({"by": sender, "eligible": res["eligible"], "reason": res["reason"]})
        p["log"] = p["log"][-20:]
        counted = False
        if res["eligible"]:
            p["endorsers"].append(sender)
            self.endorsement_count += u256(1)
            counted = True
            if len(p["endorsers"]) >= int(p["threshold"]):
                p["state"] = "passed"
                self.passed_count += u256(1)
        self.petitions[petition_id] = json.dumps(p)
        return {"petition": petition_id, "eligible": res["eligible"], "counted": counted, "verified": len(p["endorsers"]), "state": p["state"]}

    def _check(self, eligibility: str, evidence_url: str) -> dict:
        def fetch_and_judge() -> str:
            live = "(no evidence)"
            if evidence_url.startswith("http"):
                try:
                    live = gl.nondet.web.get(evidence_url).body.decode("utf-8")[:4000]
                except Exception:
                    try:
                        live = gl.nondet.web.render(evidence_url, mode="text")[:4000]
                    except Exception:
                        live = "(fetch failed)"
            prompt = f"""You verify whether an endorser meets an eligibility criterion, from their evidence.

ELIGIBILITY CRITERION: {eligibility}

ENDORSER'S EVIDENCE (fetched if a URL):
{live}

Does the evidence prove the endorser meets the criterion?
Reply ONLY JSON: {{"eligible": true/false, "reason": "<short>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_elig(raw))

        result = gl.eq_principle.prompt_comparative(
            fetch_and_judge,
            principle="The 'eligible' boolean must match across validators. The reason wording may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_elig(data):
            data = normalize_elig(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def get_petition(self, petition_id: str) -> dict:
        petition_id = str(petition_id)
        if petition_id not in self.petitions:
            return {"exists": False}
        p = json.loads(self.petitions[petition_id])
        p["exists"] = True
        p["verified"] = len(p["endorsers"])
        return p

    @gl.public.view
    def stats(self) -> dict:
        return {"total_petitions": int(self.petition_count), "passed": int(self.passed_count), "endorsements": int(self.endorsement_count)}
