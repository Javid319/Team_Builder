import io, uuid, os, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User

client = TestClient(app)

email = f"avatar_test_{uuid.uuid4().hex[:8]}@example.com"
r = client.post("/api/v1/auth/register", json={"email": email, "password": "Test@12345", "full_name": "Avatar Test User"})
assert r.status_code == 201, r.text
r = client.post("/api/v1/auth/login", json={"email": email, "password": "Test@12345"})
assert r.status_code == 200, r.text
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

png = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"
)

try:
    # 1. Upload avatar before profile exists -> auto-creates profile
    r = client.post("/api/v1/profile/avatar", files={"file": ("a.png", io.BytesIO(png), "image/png")}, headers=headers)
    assert r.status_code == 200, r.text
    av = r.json()["avatar_url"]
    assert av and av.startswith("/uploads/avatars/"), av
    print("upload OK:", av)

    # 2. Avatar is served publicly by the static mount
    r = client.get(av)
    assert r.status_code == 200, (av, r.status_code)
    assert r.headers["content-type"].startswith("image/png"), r.headers["content-type"]
    print("static serve OK")

    # 3. Replace avatar -> old file removed
    r = client.post("/api/v1/profile/avatar", files={"file": ("b.png", io.BytesIO(png), "image/png")}, headers=headers)
    assert r.status_code == 200, r.text
    av2 = r.json()["avatar_url"]
    assert av2 != av, (av, av2)
    old_path = Path(av.lstrip("/"))
    assert not old_path.exists(), "old avatar file should be removed"
    print("replace OK:", av2)

    # 4. Profile now exists with name default
    r = client.get("/api/v1/profile/", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["avatar_url"] == av2
    print("profile avatar_url OK")

    # 5. Remove avatar
    r = client.delete("/api/v1/profile/avatar", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["avatar_url"] is None
    new_path = Path(av2.lstrip("/"))
    assert not new_path.exists(), "removed avatar file should not exist"
    print("remove OK")

    # 6. Reject non-image upload
    r = client.post("/api/v1/profile/avatar", files={"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}, headers=headers)
    assert r.status_code == 400, r.text
    print("reject non-image OK")

    print("ALL AVATAR TESTS PASSED")
finally:
    # Cleanup
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.delete(user)
            db.commit()
    finally:
        db.close()
    for d in Path("uploads/avatars").glob("*.png"):
        d.unlink(missing_ok=True)
