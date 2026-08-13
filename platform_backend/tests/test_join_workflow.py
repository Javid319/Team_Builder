"""
End-to-end test: Looking to Join Team workflow.

Covers:
  GET  /teams                             (OPEN-only listing, pagination, filters)
  POST /teams/{team_id}/join-request      (validations)
  GET  /teams/{team_id}/join-requests     (owner only)
  POST /join-requests/{id}/accept  + reject

Creates throwaway users and deletes them (and their team data) at the end.
Run from platform_backend:  python -m tests.test_join_workflow
"""
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.team import Team, TeamInvitation, TeamJoinRequest, TeamMember

client = TestClient(app)

PREFIX = f"join_{uuid.uuid4().hex[:6]}"
PASSWORD = "Test@12345"

registered_ids = []


def make_user(name: str):
    email = f"{PREFIX}_{name.lower()}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": name},
    )
    assert r.status_code == 201, r.text
    r = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    user_id = me.json()["id"]
    registered_ids.append(user_id)
    return headers, user_id


def cleanup():
    db = SessionLocal()
    ids = [uuid.UUID(uid) for uid in registered_ids]
    db.query(TeamJoinRequest).filter(TeamJoinRequest.user_id.in_(ids)).delete(
        synchronize_session=False
    )
    db.query(TeamInvitation).filter(
        TeamInvitation.sender_id.in_(ids) | TeamInvitation.receiver_id.in_(ids)
    ).delete(synchronize_session=False)
    db.query(TeamMember).filter(TeamMember.user_id.in_(ids)).delete(
        synchronize_session=False
    )
    db.query(Team).filter(Team.owner_id.in_(ids)).delete(synchronize_session=False)
    users = db.query(User).filter(User.id.in_(ids)).all()
    for user in users:
        db.delete(user)
    db.commit()
    db.close()
    print(f"cleaned up {len(users)} test users")


def create_team(headers, name, domains=None, max_members=3):
    r = client.post(
        "/api/v1/teams",
        json={
            "name": f"{PREFIX} {name}",
            "description": f"{PREFIX} {name} description",
            "domains": domains or [],
            "max_members": max_members,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def list_teams(headers, **params):
    params.setdefault("search", PREFIX)
    r = client.get("/api/v1/teams", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def main():
    owner_h, owner_id = make_user("Owner")
    alice_h, alice_id = make_user("Alice")
    bob_h, bob_id = make_user("Bob")
    carol_h, carol_id = make_user("Carol")
    dave_h, dave_id = make_user("Dave")
    eve_h, eve_id = make_user("Eve")

    try:
        # ── Set up teams ───────────────────────────────────────
        alpha_id = create_team(owner_h, "Alpha Squad", domains=["AI/ML"])
        beta_id = create_team(bob_h, "Beta Crew", domains=["Web Development"])
        print("teams created OK")

        # ── GET /teams requires auth ───────────────────────────
        r = client.get("/api/v1/teams")
        assert r.status_code == 403, r.text
        print("teams unauth -> 403 OK")

        # ── GET /teams: only OPEN, correct fields ──────────────
        r = client.get("/api/v1/teams", headers=owner_h)
        assert r.status_code == 200, r.text
        print("teams listing endpoint reachable OK")

        body = list_teams(owner_h)
        assert body["total"] == 2, body
        assert body["page"] == 1 and body["page_size"] == 20
        ids = {t["id"] for t in body["items"]}
        assert ids == {alpha_id, beta_id}, ids
        for t in body["items"]:
            assert t["status"] == "OPEN"
            assert t["current_size"] == 1
            assert t["open_slots"] == 2
            assert t["owner"]["id"] in (owner_id, bob_id)
        print("teams listing OK (2 OPEN teams)")

        # ── Pagination ─────────────────────────────────────────
        body = list_teams(owner_h, page=1, page_size=1)
        assert body["total"] == 2 and len(body["items"]) == 1
        print("teams pagination OK")

        # ── Filtering: domain + search ─────────────────────────
        body = list_teams(owner_h, domain="AI/ML")
        assert [t["id"] for t in body["items"]] == [alpha_id], body
        body = list_teams(owner_h, search=f"{PREFIX} Beta")
        assert [t["id"] for t in body["items"]] == [beta_id], body
        body = list_teams(owner_h, search=f"{PREFIX} nomatch")
        assert body["total"] == 0, body
        print("teams filtering OK")

        # ── Join request: success + duplicate ──────────────────
        r = client.post(f"/api/v1/teams/{alpha_id}/join-request", headers=alice_h)
        assert r.status_code == 201, r.text
        alice_req = r.json()
        assert alice_req["status"] == "PENDING"
        assert alice_req["team"]["name"] == f"{PREFIX} Alpha Squad"
        assert alice_req["user"]["id"] == alice_id
        print("alice join request -> 201 OK")

        r = client.post(f"/api/v1/teams/{alpha_id}/join-request", headers=alice_h)
        assert r.status_code == 409, r.text
        print("duplicate join request -> 409 OK")

        # ── Join request validations ───────────────────────────
        r = client.post(f"/api/v1/teams/{alpha_id}/join-request", headers=owner_h)
        assert r.status_code == 409, r.text
        print("owner join own team -> 409 OK")

        r = client.post(f"/api/v1/teams/{alpha_id}/join-request", headers=bob_h)
        assert r.status_code == 409, r.text
        print("join while in another active team -> 409 OK")

        r = client.post(
            f"/api/v1/teams/{str(uuid.uuid4())}/join-request", headers=alice_h
        )
        assert r.status_code == 404, r.text
        print("join unknown team -> 404 OK")

        r = client.post(f"/api/v1/teams/{alpha_id}/join-request", headers=carol_h)
        assert r.status_code == 201, r.text
        print("carol join request -> 201 OK")

        # ── GET join-requests: owner only ──────────────────────
        r = client.get(f"/api/v1/teams/{alpha_id}/join-requests", headers=bob_h)
        assert r.status_code == 403, r.text
        print("non-owner join-requests -> 403 OK")

        r = client.get(
            f"/api/v1/teams/{str(uuid.uuid4())}/join-requests", headers=owner_h
        )
        assert r.status_code == 404, r.text
        print("join-requests unknown team -> 404 OK")

        r = client.get(f"/api/v1/teams/{alpha_id}/join-requests", headers=owner_h)
        assert r.status_code == 200, r.text
        reqs = r.json()
        assert len(reqs) == 2, reqs
        assert {q["user_id"] for q in reqs} == {alice_id, carol_id}
        carol_req_id = next(q["id"] for q in reqs if q["user_id"] == carol_id)
        print("owner join-requests list OK")

        # ── Accept validations ─────────────────────────────────
        r = client.post(f"/api/v1/join-requests/{alice_req['id']}/accept", headers=alice_h)
        assert r.status_code == 403, r.text
        print("requester accept own request -> 403 OK")

        r = client.post(
            f"/api/v1/join-requests/{str(uuid.uuid4())}/accept", headers=owner_h
        )
        assert r.status_code == 404, r.text
        print("accept unknown -> 404 OK")

        # ── Accept alice -> 2/3, still OPEN ────────────────────
        r = client.post(f"/api/v1/join-requests/{alice_req['id']}/accept", headers=owner_h)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ACCEPTED"
        print("accept alice OK")

        r = client.post(f"/api/v1/join-requests/{alice_req['id']}/accept", headers=owner_h)
        assert r.status_code == 409, r.text
        print("re-accept -> 409 OK")

        # ── Accept carol -> 3/3 FULL ───────────────────────────
        r = client.post(f"/api/v1/join-requests/{carol_req_id}/accept", headers=owner_h)
        assert r.status_code == 200, r.text
        print("accept carol OK")

        r = client.get(f"/api/v1/teams/{alpha_id}", headers=owner_h)
        assert r.status_code == 200, r.text
        assert r.json()["member_count"] == 3
        assert r.json()["status"] == "FULL"
        print("team full (3/3) -> FULL OK")

        # ── Full team: no new requests, hidden from listing ────
        r = client.post(f"/api/v1/teams/{alpha_id}/join-request", headers=dave_h)
        assert r.status_code == 409, r.text
        print("join full team -> 409 OK")

        body = list_teams(owner_h)
        assert {t["id"] for t in body["items"]} == {beta_id}, body
        print("FULL team excluded from listing OK")

        # ── Reject flow (eve + beta) ───────────────────────────
        r = client.post(f"/api/v1/teams/{beta_id}/join-request", headers=eve_h)
        assert r.status_code == 201, r.text
        eve_req_id = r.json()["id"]

        r = client.post(f"/api/v1/join-requests/{eve_req_id}/reject", headers=owner_h)
        assert r.status_code == 403, r.text
        print("non-owner reject -> 403 OK")

        r = client.post(
            f"/api/v1/join-requests/{str(uuid.uuid4())}/reject", headers=bob_h
        )
        assert r.status_code == 404, r.text
        print("reject unknown -> 404 OK")

        r = client.post(f"/api/v1/join-requests/{eve_req_id}/reject", headers=bob_h)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "REJECTED"
        print("reject OK")

        r = client.post(f"/api/v1/join-requests/{eve_req_id}/reject", headers=bob_h)
        assert r.status_code == 409, r.text
        print("re-reject -> 409 OK")

        # Eve can request again after rejection.
        r = client.post(f"/api/v1/teams/{beta_id}/join-request", headers=eve_h)
        assert r.status_code == 201, r.text
        print("re-request after reject -> 201 OK")

        print("\nALL JOIN WORKFLOW CHECKS PASSED")
    finally:
        cleanup()


if __name__ == "__main__":
    main()
