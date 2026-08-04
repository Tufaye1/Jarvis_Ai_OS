"""Vault scanning: walk markdown files, upsert notes, resolve wikilinks."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings
from app.db import async_session as default_session_factory
from app.knowledge.models import Note, NoteLink
from app.knowledge.parser import UnsafeNotePath, parse_note


async def scan_vault(session_factory: async_sessionmaker = default_session_factory) -> dict:
    """Scan settings.vault_path for *.md files and sync them into Postgres.

    - Notes are matched by vault_path; unchanged content (same content_hash)
      is skipped entirely. Changed/new notes get content/title/content_hash
      (and updated_at, via the model's onupdate) written; embedding is left
      untouched so a separate embeddings task can fill it in later.
    - Wikilinks are re-resolved for every note on every scan: existing
      note_links rows for that source note are deleted and replaced.

    Files that resolve outside the vault root (symlink escape), exceed the
    size cap, or aren't valid UTF-8 are skipped rather than aborting the scan;
    they're reported back under `skipped`.

    Returns {notes_scanned, notes_created, notes_updated, links_created, skipped}.
    """
    vault_root = settings.vault_path
    md_paths = sorted(p for p in vault_root.rglob("*.md") if p.is_file())

    notes_scanned = 0
    notes_created = 0
    notes_updated = 0
    links_created = 0
    skipped: list[dict] = []

    async with session_factory() as session:
        existing_result = await session.execute(select(Note))
        existing_by_path = {n.vault_path: n for n in existing_result.scalars().all()}

        # (note, wikilink targets) pairs to resolve into note_links after
        # all notes have been upserted and assigned ids.
        parsed_notes: list[tuple[Note, list[str]]] = []

        for path in md_paths:
            try:
                parsed = parse_note(path, vault_root)
            except UnsafeNotePath as exc:
                skipped.append({"path": str(path), "reason": str(exc)})
                continue
            except UnicodeDecodeError:
                skipped.append({"path": str(path), "reason": "not valid UTF-8"})
                continue
            notes_scanned += 1

            existing = existing_by_path.get(parsed["vault_path"])
            if existing is not None:
                if existing.content_hash != parsed["content_hash"]:
                    existing.title = parsed["title"]
                    existing.content = parsed["content"]
                    existing.content_hash = parsed["content_hash"]
                    notes_updated += 1
                note = existing
            else:
                note = Note(
                    vault_path=parsed["vault_path"],
                    title=parsed["title"],
                    content=parsed["content"],
                    content_hash=parsed["content_hash"],
                )
                session.add(note)
                notes_created += 1

            parsed_notes.append((note, parsed["wikilinks"]))

        # Flush so newly-created notes get ids assigned before link resolution.
        await session.flush()

        # Case-insensitive title -> note id map, built after upserts so newly
        # created notes are resolvable as link targets too.
        all_notes_result = await session.execute(select(Note.id, Note.title))
        title_to_id: dict[str, int] = {}
        for note_id, title in all_notes_result.all():
            title_to_id.setdefault(title.lower(), note_id)

        for note, wikilinks in parsed_notes:
            await session.execute(
                delete(NoteLink).where(NoteLink.source_note_id == note.id)
            )
            for target in wikilinks:
                target_note_id = title_to_id.get(target.lower())
                session.add(
                    NoteLink(
                        source_note_id=note.id,
                        target_title=target,
                        target_note_id=target_note_id,
                    )
                )
                links_created += 1

        await session.commit()

    return {
        "notes_scanned": notes_scanned,
        "notes_created": notes_created,
        "notes_updated": notes_updated,
        "links_created": links_created,
        "skipped": skipped,
    }
