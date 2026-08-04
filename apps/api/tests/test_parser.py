"""Unit tests for app.knowledge.parser.

Pure function over a single file on disk: no database, no network, no
event loop. Should run in milliseconds and be fully deterministic.
"""

import hashlib

import pytest

from app.knowledge.parser import MAX_FILE_SIZE_BYTES, UnsafeNotePath, parse_note


def test_parse_note_extracts_fields_and_wikilinks(tmp_path):
    vault_root = tmp_path
    note_path = vault_root / "Project Plan.md"
    content = (
        "# Project Plan\n\n"
        "See [[Roadmap]] for details, and check the [[Team Charter|Charter]] "
        "before the kickoff.\n"
    )
    note_path.write_text(content, encoding="utf-8")

    result = parse_note(note_path, vault_root)

    assert result["vault_path"] == "Project Plan.md"
    assert result["title"] == "Project Plan"
    assert result["content"] == content
    assert result["content_hash"] == hashlib.sha256(content.encode("utf-8")).hexdigest()
    # [[Roadmap]] resolves to itself; [[Team Charter|Charter]] resolves to the
    # target ("Team Charter"), not the display alias ("Charter").
    assert result["wikilinks"] == ["Roadmap", "Team Charter"]


def test_parse_note_nested_path_is_posix_relative(tmp_path):
    vault_root = tmp_path
    nested_dir = vault_root / "areas" / "work"
    nested_dir.mkdir(parents=True)
    note_path = nested_dir / "Notes.md"
    note_path.write_text("no links here", encoding="utf-8")

    result = parse_note(note_path, vault_root)

    assert result["vault_path"] == "areas/work/Notes.md"
    assert result["title"] == "Notes"
    assert result["wikilinks"] == []


def test_parse_note_ignores_blank_and_alias_only_targets(tmp_path):
    vault_root = tmp_path
    note_path = vault_root / "Edge Cases.md"
    note_path.write_text(
        "[[ ]] and [[   |Alias only]] and [[Real Target]]",
        encoding="utf-8",
    )

    result = parse_note(note_path, vault_root)

    assert result["wikilinks"] == ["Real Target"]


def test_parse_note_repeated_wikilink_is_not_deduplicated(tmp_path):
    vault_root = tmp_path
    note_path = vault_root / "Repeats.md"
    note_path.write_text("[[Foo]] mentioned twice: [[Foo]]", encoding="utf-8")

    result = parse_note(note_path, vault_root)

    assert result["wikilinks"] == ["Foo", "Foo"]


def test_parse_note_content_hash_changes_with_content(tmp_path):
    vault_root = tmp_path
    note_path = vault_root / "Hash.md"

    note_path.write_text("version one", encoding="utf-8")
    first = parse_note(note_path, vault_root)

    note_path.write_text("version two", encoding="utf-8")
    second = parse_note(note_path, vault_root)

    assert first["content_hash"] != second["content_hash"]


def test_parse_note_rejects_symlink_escaping_vault(tmp_path):
    vault_root = tmp_path / "vault"
    vault_root.mkdir()
    outside = tmp_path / "outside_secret.md"
    outside.write_text("should never be readable via the vault", encoding="utf-8")
    link = vault_root / "linked.md"
    link.symlink_to(outside)

    with pytest.raises(UnsafeNotePath):
        parse_note(link, vault_root)


def test_parse_note_rejects_oversized_file(tmp_path):
    vault_root = tmp_path
    note_path = vault_root / "Huge.md"
    note_path.write_text("x" * (MAX_FILE_SIZE_BYTES + 1), encoding="utf-8")

    with pytest.raises(UnsafeNotePath):
        parse_note(note_path, vault_root)
