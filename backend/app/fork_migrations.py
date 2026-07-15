"""Fork-owned schema migrations, separate from upstream alembic.

Upstream Securo numbers its alembic revisions sequentially ("065", "066", ...),
so any revision this fork added to alembic/versions would collide with the
next upstream release. Instead, fork-added tables are managed here: a tiny
ordered list of idempotent SQL steps tracked in their own
fork_schema_migrations table.

Runs via `python -m app.fork_migrations` (see docker-compose.prod.yml, after
`alembic upgrade head`). Safe to run repeatedly and concurrently-ish: steps
are idempotent (IF NOT EXISTS) and applied inside a transaction with an
advisory lock.

To add a migration: append (version, [sql, ...]) to MIGRATIONS. Never edit or
reorder existing entries.
"""

import asyncio

from sqlalchemy import text

from app.core.database import engine

# Arbitrary constant identifying this app's fork-migration lock.
_ADVISORY_LOCK_KEY = 0x5EC0_F0CC

MIGRATIONS: list[tuple[int, list[str]]] = [
    (
        1,
        [
            """
            CREATE TABLE IF NOT EXISTS page_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                page_key VARCHAR(100) NOT NULL,
                settings JSON NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_page_settings_user_ws_page UNIQUE (user_id, workspace_id, page_key)
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_page_settings_workspace_id ON page_settings (workspace_id)",
        ],
    ),
]


async def run() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _ADVISORY_LOCK_KEY})
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS fork_schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        applied = {
            row[0]
            for row in (await conn.execute(text("SELECT version FROM fork_schema_migrations"))).all()
        }
        for version, statements in MIGRATIONS:
            if version in applied:
                continue
            for statement in statements:
                await conn.execute(text(statement))
            await conn.execute(
                text("INSERT INTO fork_schema_migrations (version) VALUES (:v)"), {"v": version}
            )
            print(f"fork_migrations: applied version {version}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
