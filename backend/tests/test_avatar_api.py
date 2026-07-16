"""Fork-added tests: profile picture upload/serve/delete."""

import io

import pytest

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.mark.asyncio
async def test_avatar_lifecycle(client, auth_headers):
    # No avatar yet
    resp = await client.get("/api/users/me/avatar", headers=auth_headers)
    assert resp.status_code == 404

    # Upload
    resp = await client.put(
        "/api/users/me/avatar",
        files={"file": ("me.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"has_avatar": True}

    # Served back with the right content type; user flag flips
    resp = await client.get("/api/users/me/avatar", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/png")
    assert resp.content == PNG_BYTES

    resp = await client.get("/api/users/me", headers=auth_headers)
    assert resp.json()["has_avatar"] is True

    # Delete
    resp = await client.delete("/api/users/me/avatar", headers=auth_headers)
    assert resp.status_code == 200
    resp = await client.get("/api/users/me/avatar", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_avatar_rejects_bad_type_and_size(client, auth_headers):
    resp = await client.put(
        "/api/users/me/avatar",
        files={"file": ("evil.svg", io.BytesIO(b"<svg/>"), "image/svg+xml")},
        headers=auth_headers,
    )
    assert resp.status_code == 422

    big = b"0" * (2 * 1024 * 1024 + 1)
    resp = await client.put(
        "/api/users/me/avatar",
        files={"file": ("big.png", io.BytesIO(big), "image/png")},
        headers=auth_headers,
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_avatar_requires_auth(client):
    resp = await client.get("/api/users/me/avatar")
    assert resp.status_code == 401
