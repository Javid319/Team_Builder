"""
End-to-end test: Looking for Members workflow.

Covers:
  GET  /recommendations/members   (scoring + exclusions)
  POST /teams/{team_id}/invite    (validations)
  GET  /my-invitations
  POST /invitations/{id}/accept   + reject

Creates throwaway users and deletes them (and their team data) at the end.
Run from platform_backend:  python -m tests.test_team_workflow
"""
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.profile import Profile
from app.models.candidate_profile import CandidateProfile

client = TestClient(app)

PREFIX = f"workflow_{uuid.uuid4().hex[:6]}"
PASSWORD = "Test@12345"

registered_ids = []


def make_user(name: str):
    email = f"{PREFIX}_{name.lower()}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": name},
    )
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    user_id = me.json()["id"]
    registered_ids.append(user_id)
    return headers, user_id


def add_candidate_signal(user_id: str, name: str, role: str = "ml_engineer"):
    """Give a registered user a discoverable candidate profile."""
    db = SessionLocal()
    db.add(Profile(user_id=uuid.UUID(user_id), name=name, role=role))
    db.flush()
    db.add(
        CandidateProfile(
            user_id=uuid.UUID(user_id),
            profile_data={
                "ability": {"skills": [{"name": "python"}, {"name": "pytorch"}]},
                "behavior": {
                    "big_five": {
                        "openness": 80, "conscientiousness": 70,
                        "extraversion": 60, "agreeableness": 75,
                        "neuroticism": 40,
                    },
                    "strengths": ["Analytical"],
                },
                "teamwork": {
                    "dimension_scores": [
                        {"dimension": "Communication", "percentage": 80.0}
                    ]
                },
                "experience": {"level": "intermediate"},
                "role": {"role": role},
                "availability": {"commitment_level": "full_time"},
                "evidence": {},
            },
            profile_strength=70,
        )
    )
    db.commit()
    db.close()


def cleanup():
    db = SessionLocal()
    users = db.query(User).filter(User.id.in_([uuid.UUID(uid) for uid in registered_ids])).all()
    for user in users:
        db.delete(user)
    db.commit()
    db.close()
    print(f"cleaned up {len(users)} test users")


def main():
    owner_h, owner_id = make_user("Owner")
    alice_h, alice_id = make_user("Alice")
    bob_h, bob_id = make_user("Bob")
    carol_h, carol_id = make_user("Carol")
    dave_h, dave_id = make_user("Dave")
    frank_h, frank_id = make_user("Frank")
    gina_h, gina_id = make_user("Gina")

    try:
        # ── Create team (with domains) ──────────────────────────
        r = client.post(
            "/api/v1/teams",
            json={
                "name": "ML Squad",
                "description": "AI crop advisory",
                "domains": ["AI/ML", "Web Development"],
                "max_members": 3,
            },
            headers=owner_h,
        )
        assert r.status_code == 201, r.text
        team = r.json()
        team_id = team["id"]
        assert set(team["domains"]) == {"AI/ML", "Web Development"}, team
        assert team["status"] == "OPEN"
        print("team created with domains OK")

        # ── Recommendations: baseline ───────────────────────────
        r = client.get(
            "/api/v1/recommendations/members",
            params={"team_id": team_id, "limit": 50},
            headers=owner_h,
        )
        assert r.status_code == 200, r.text
        recs = r.json()
        assert len(recs) > 0, "expected candidates"
        scores = [rec["compatibility_score"] for rec in recs]
        assert scores == sorted(scores, reverse=True), "must be sorted desc"
        member_ids = {m["user_id"] for m in team["members"]}
        assert not ({rec["user_id"] for rec in recs} & member_ids), "no team members"
        # AI/ML candidates must carry a domain match.
        ml = [rec for rec in recs if rec["role"] == "ml_engineer"]
        assert ml and "AI/ML" in ml[0]["domain_match"], "AI/ML candidate should match"
        for rec in recs:
            assert 0 <= rec["compatibility_score"] <= 100
        print(f"recommendations OK ({len(recs)} candidates, top {scores[0]})")

        # Non-member cannot discover for someone else's team.
        r = client.get(
            "/api/v1/recommendations/members",
            params={"team_id": team_id},
            headers=alice_h,
        )
        assert r.status_code == 403, r.text
        print("non-member recommendations -> 403 OK")

        # ── Make alice discoverable ─────────────────────────────
        add_candidate_signal(alice_id, "Alice")
        r = client.get(
            "/api/v1/recommendations/members",
            params={"team_id": team_id},
            headers=owner_h,
        )
        rec_users = {rec["user_id"] for rec in r.json()}
        assert alice_id in rec_users, "alice should be discoverable pre-invite"
        alice_rec = next(rec for rec in r.json() if rec["user_id"] == alice_id)
        assert alice_rec["domain_match"] == ["AI/ML"], alice_rec
        assert alice_rec["assessment_compatibility"] == 30, alice_rec
        print(f"alice discoverable pre-invite (score {alice_rec['compatibility_score']}) OK")

        # ── Invite validations ──────────────────────────────────
        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": alice_id},
            headers=alice_h,  # non-owner
        )
        assert r.status_code == 403, r.text
        print("non-owner invite -> 403 OK")

        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": str(uuid.uuid4())},
            headers=owner_h,
        )
        assert r.status_code == 404, r.text
        print("invite unknown user -> 404 OK")

        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": owner_id},
            headers=owner_h,
        )
        assert r.status_code == 409, r.text
        print("invite existing member -> 409 OK")

        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": alice_id},
            headers=owner_h,
        )
        assert r.status_code == 201, r.text
        invite = r.json()
        invite_id = invite["id"]
        assert invite["status"] == "PENDING"
        assert invite["team"]["name"] == "ML Squad"
        print("invite alice -> 201 OK")

        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": alice_id},
            headers=owner_h,
        )
        assert r.status_code == 409, r.text
        print("duplicate invite -> 409 OK")

        # Alice disappears from recommendations while PENDING.
        r = client.get(
            "/api/v1/recommendations/members",
            params={"team_id": team_id},
            headers=owner_h,
        )
        assert alice_id not in {rec["user_id"] for rec in r.json()}
        print("pending-invite exclusion in recommendations OK")

        # ── my-invitations ──────────────────────────────────────
        r = client.get("/api/v1/my-invitations", headers=alice_h)
        assert r.status_code == 200, r.text
        invs = r.json()
        assert any(i["id"] == invite_id for i in invs), invs
        assert invs[0]["team"]["id"] == team_id
        print("my-invitations OK")

        # ── Accept ──────────────────────────────────────────────
        r = client.post(f"/api/v1/invitations/{invite_id}/accept", headers=alice_h)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ACCEPTED"
        print("accept OK")

        r = client.post(f"/api/v1/invitations/{invite_id}/accept", headers=alice_h)
        assert r.status_code == 409, r.text
        print("re-accept -> 409 OK")

        r = client.post(
            f"/api/v1/invitations/{str(uuid.uuid4())}/accept", headers=alice_h
        )
        assert r.status_code == 404, r.text
        print("accept unknown -> 404 OK")

        # ── Reject flow (bob) ───────────────────────────────────
        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": bob_id},
            headers=owner_h,
        )
        assert r.status_code == 201, r.text
        bob_invite_id = r.json()["id"]

        r = client.post(f"/api/v1/invitations/{invite_id}/accept", headers=bob_h)
        assert r.status_code == 403, r.text
        print("cross-user accept -> 403 OK")

        r = client.post(f"/api/v1/invitations/{bob_invite_id}/reject", headers=bob_h)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "REJECTED"
        print("reject OK")

        r = client.post(f"/api/v1/invitations/{bob_invite_id}/reject", headers=bob_h)
        assert r.status_code == 409, r.text
        print("re-reject -> 409 OK")

        # Bob can be re-invited after rejecting; accept -> team FULL (3/3).
        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": bob_id},
            headers=owner_h,
        )
        assert r.status_code == 201, r.text
        bob_invite2 = r.json()["id"]
        r = client.post(f"/api/v1/invitations/{bob_invite2}/accept", headers=bob_h)
        assert r.status_code == 200, r.text

        r = client.get(f"/api/v1/teams/{team_id}", headers=owner_h)
        assert r.status_code == 200, r.text
        assert r.json()["member_count"] == 3
        assert r.json()["status"] == "FULL"
        print("team full (3/3) -> FULL OK")

        r = client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"receiver_id": dave_id},
            headers=owner_h,
        )
        assert r.status_code == 409, r.text
        print("invite when full -> 409 OK")

        # ── Receiver already in another active team ─────────────
        r = client.post(
            "/api/v1/teams",
            json={"name": "Frank Team", "max_members": 3},
            headers=frank_h,
        )
        assert r.status_code == 201, r.text
        frank_team_id = r.json()["id"]

        # gina creates her own active team.
        r = client.post(
            "/api/v1/teams",
            json={"name": "Gina Team", "max_members": 3},
            headers=gina_h,
        )
        assert r.status_code == 201, r.text

        r = client.post(
            f"/api/v1/teams/{frank_team_id}/invite",
            json={"receiver_id": gina_id},
            headers=frank_h,
        )
        assert r.status_code == 409, r.text
        print("invite user in another active team -> 409 OK")

        # gina cannot accept a pending invite either (not tested here).

        print("\nALL WORKFLOW CHECKS PASSED")
    finally:
        cleanup()


if __name__ == "__main__":
    main()
