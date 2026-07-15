"""Tests for the fork-added per-page settings API."""

import pytest


@pytest.mark.asyncio
async def test_get_missing_setting_returns_empty(client, auth_headers):
    resp = await client.get("/api/page-settings/transactions", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["page_key"] == "transactions"
    assert body["settings"] == {}


@pytest.mark.asyncio
async def test_put_then_get_roundtrip(client, auth_headers):
    payload = {"settings": {"dateFilter": {"mode": "rolling", "unit": "days", "count": 30}}}
    resp = await client.put("/api/page-settings/transactions", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["settings"] == payload["settings"]

    resp = await client.get("/api/page-settings/transactions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["settings"] == payload["settings"]


@pytest.mark.asyncio
async def test_put_overwrites_existing(client, auth_headers):
    first = {"settings": {"dateFilter": {"mode": "month", "month": "2026-06"}}}
    second = {"settings": {"dateFilter": {"mode": "ytd"}}}
    await client.put("/api/page-settings/dashboard", json=first, headers=auth_headers)
    resp = await client.put("/api/page-settings/dashboard", json=second, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["settings"] == second["settings"]

    resp = await client.get("/api/page-settings/dashboard", headers=auth_headers)
    assert resp.json()["settings"] == second["settings"]


@pytest.mark.asyncio
async def test_page_keys_are_independent(client, auth_headers):
    await client.put(
        "/api/page-settings/reports.net_worth",
        json={"settings": {"a": 1}},
        headers=auth_headers,
    )
    await client.put(
        "/api/page-settings/reports.income_expenses",
        json={"settings": {"b": 2}},
        headers=auth_headers,
    )
    resp = await client.get("/api/page-settings/reports.net_worth", headers=auth_headers)
    assert resp.json()["settings"] == {"a": 1}
    resp = await client.get("/api/page-settings/reports.income_expenses", headers=auth_headers)
    assert resp.json()["settings"] == {"b": 2}


@pytest.mark.asyncio
async def test_invalid_page_key_rejected(client, auth_headers):
    resp = await client.put(
        "/api/page-settings/Bad%20Key!", json={"settings": {}}, headers=auth_headers
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_oversized_settings_rejected(client, auth_headers):
    resp = await client.put(
        "/api/page-settings/transactions",
        json={"settings": {"blob": "x" * 20_000}},
        headers=auth_headers,
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_requires_auth(client):
    resp = await client.get("/api/page-settings/transactions")
    assert resp.status_code == 401
