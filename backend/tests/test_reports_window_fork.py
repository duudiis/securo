"""Fork-added tests: explicit from/to window on the report endpoints."""

from datetime import date

import pytest

from app.schemas.report import ReportMeta, ReportResponse, ReportSummary
from app.services import report_service
from app.api import reports as reports_api


def _empty_response(currency: str, interval: str, report_type: str) -> ReportResponse:
    return ReportResponse(
        summary=ReportSummary(primary_value=0, change_amount=0, change_percent=None, breakdowns=[]),
        trend=[],
        meta=ReportMeta(type=report_type, series_keys=[], currency=currency, interval=interval),
        composition=[],
        category_trend=[],
    )


@pytest.mark.asyncio
async def test_income_expenses_api_forwards_window(client, auth_headers, monkeypatch):
    seen: dict = {}

    async def fake_report(
        session, workspace_id, user_id, months, interval, currency,
        account_ids=None, period=None, days=None, from_date=None, to_date=None,
    ):
        seen["from_date"] = from_date
        seen["to_date"] = to_date
        return _empty_response(currency, interval, "income_expenses")

    monkeypatch.setattr(report_service, "get_income_expenses_report", fake_report)

    resp = await client.get(
        "/api/reports/income-expenses",
        params={"from": "2026-01-05", "to": "2026-03-02"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert seen == {"from_date": date(2026, 1, 5), "to_date": date(2026, 3, 2)}


@pytest.mark.asyncio
async def test_net_worth_api_forwards_window(client, auth_headers, monkeypatch):
    seen: dict = {}

    async def fake_report(
        session, workspace_id, user_id, months, interval, currency,
        account_ids=None, asset_group_ids=None, period=None, from_date=None, to_date=None,
    ):
        seen["from_date"] = from_date
        seen["to_date"] = to_date
        return _empty_response(currency, interval, "net_worth")

    monkeypatch.setattr(report_service, "get_net_worth_report", fake_report)

    resp = await client.get(
        "/api/reports/net-worth",
        params={"from": "2025-11-01", "to": "2025-12-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert seen == {"from_date": date(2025, 11, 1), "to_date": date(2025, 12, 31)}


@pytest.mark.asyncio
async def test_api_without_window_omits_kwargs(client, auth_headers, monkeypatch):
    """No from/to params → service called with its original signature."""

    async def fake_report(
        session, workspace_id, user_id, months, interval, currency,
        account_ids=None, period=None, days=None,
    ):
        return _empty_response(currency, interval, "income_expenses")

    monkeypatch.setattr(report_service, "get_income_expenses_report", fake_report)

    resp = await client.get("/api/reports/income-expenses", headers=auth_headers)
    assert resp.status_code == 200


# NOTE: the service-level window behavior is intentionally untested here —
# get_income_expenses_report uses PostgreSQL to_char(), which the SQLite test
# database cannot run (upstream tests hit the same wall and monkeypatch the
# service at the API layer, as done above).

# reports_api imported to make the router availability explicit in this module.
assert reports_api.router is not None
