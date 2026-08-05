"""Integration tests for app.knowledge.ingest.scan_vault.

These exercise real Postgres (the docker compose 'db' service / DATABASE_URL
from the repo .env) rather than mocking the database, since scan_vault's
value is largely in its upsert-by-content-hash and wikilink-resolution SQL.
Each test uses randomized vault_path/title values and the cleanup_notes
fixture to avoid leaving data behind in the shared local dev database.
"""

import uuid

from sqlalchemy import select

from app.db import async_session, engine
from app.knowledge.ingest import scan_vault
from app.base import init_models
from app.knowledge.models import Note, NoteLink


async def test_scan_vault_creates_notes_and_resolves_links(vault_root, ensure_db, cleanup_notes):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    note_a_title = f"Alpha {unique}"
    note_b_title = f"Beta {unique}"
    ghost_title = f"Ghost {unique}"

    (vault_root / f"{note_a_title}.md").write_text(
        f"Links to [[{note_b_title}]] and to a missing [[{ghost_title}|elsewhere]].",
        encoding="utf-8",
    )
    (vault_root / f"{note_b_title}.md").write_text("No outgoing links.", encoding="utf-8")

    cleanup_notes.extend([f"{note_a_title}.md", f"{note_b_title}.md"])

    stats = await scan_vault()

    assert stats["notes_scanned"] == 2
    assert stats["notes_created"] == 2
    assert stats["notes_updated"] == 0
    assert stats["links_created"] == 2

    async with async_session() as session:
        result = await session.execute(
            select(Note).where(Note.vault_path.in_(cleanup_notes))
        )
        notes_by_title = {n.title: n for n in result.scalars().all()}

        assert set(notes_by_title) == {note_a_title, note_b_title}
        note_a, note_b = notes_by_title[note_a_title], notes_by_title[note_b_title]
        # scan_vault never touches embeddings -- that's a separate pipeline step.
        assert note_a.embedding is None
        assert note_b.embedding is None

        links_result = await session.execute(
            select(NoteLink).where(NoteLink.source_note_id == note_a.id)
        )
        targets = {link.target_title: link.target_note_id for link in links_result.scalars().all()}

        assert targets == {
            note_b_title: note_b.id,  # resolved: target note exists
            ghost_title: None,  # dangling link: target note doesn't exist
        }


async def test_scan_vault_is_idempotent_and_updates_on_content_change(
    vault_root, ensure_db, cleanup_notes
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    title = f"Stable {unique}"
    vault_path = f"{title}.md"
    note_file = vault_root / vault_path
    note_file.write_text("original content, no links.", encoding="utf-8")
    cleanup_notes.append(vault_path)

    first = await scan_vault()
    assert first["notes_created"] == 1
    assert first["notes_updated"] == 0

    # Re-scanning unchanged content should be a no-op for notes_created/updated.
    second = await scan_vault()
    assert second["notes_created"] == 0
    assert second["notes_updated"] == 0

    # Changing the file's content should be picked up as an update, not a
    # duplicate create (matched by vault_path).
    note_file.write_text("edited content, still no links.", encoding="utf-8")
    third = await scan_vault()
    assert third["notes_created"] == 0
    assert third["notes_updated"] == 1

    async with async_session() as session:
        result = await session.execute(select(Note).where(Note.vault_path == vault_path))
        notes = result.scalars().all()
        assert len(notes) == 1
        assert notes[0].content == "edited content, still no links."
