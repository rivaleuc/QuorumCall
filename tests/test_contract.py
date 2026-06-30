"""QuorumCall tests: eligibility guards + endorse→verified-threshold→passed flow."""

A = "0xAAa0000000000000000000000000000000000001"
B = "0xBBb0000000000000000000000000000000000002"
C = "0xCCc0000000000000000000000000000000000003"


def test_normalize_elig(contract):
    n = contract.normalize_elig
    assert n({"eligible": True, "reason": "verified resident"})["eligible"] is True
    assert n({"eligible": "no", "reason": "x"})["eligible"] is False
    assert n({})["eligible"] is False
    assert n("junk")["reason"] == "no reason"

def test_validate_elig(contract):
    v = contract.validate_elig
    assert v({"eligible": True, "reason": "membership card valid"})
    assert not v({"eligible": "true", "reason": "x"})
    assert not v({"eligible": True, "reason": "  "})


def _new(contract):
    return contract, contract.QuorumCall()

def test_threshold_requires_one(contract):
    mod, c = _new(contract)
    try:
        c.open_petition("Unlock the grant", "DAO member", 0); assert False, "threshold>=1"
    except Exception:
        pass

def test_endorse_threshold_passes(contract):
    mod, c = _new(contract)
    pid = c.open_petition("Trigger community payout", "Verified DAO member", 2)
    # ineligible (offline default) -> not counted
    mod.gl.message.sender_address = A
    out = c.endorse(pid, "https://e.example/a")
    assert out["counted"] is False and out["verified"] == 0
    # now validators verify eligibility
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"eligible": True, "reason": "member confirmed"})
    mod.gl.message.sender_address = B
    o2 = c.endorse(pid, "https://e.example/b")
    assert o2["counted"] is True and o2["verified"] == 1 and o2["state"] == "gathering"
    # duplicate endorse by B rejected
    try:
        c.endorse(pid, "https://e.example/b2"); assert False, "duplicate endorse should fail"
    except Exception:
        pass
    # C pushes it over the threshold -> passed
    mod.gl.message.sender_address = C
    o3 = c.endorse(pid, "https://e.example/c")
    assert o3["verified"] == 2 and o3["state"] == "passed"
    assert c.stats()["passed"] == 1 and c.stats()["endorsements"] == 2
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
    mod.gl.message.sender_address = "0xa000000000000000000000000000000000000001"
