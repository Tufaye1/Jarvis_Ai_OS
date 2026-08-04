"""Pure markdown-note parsing: no I/O side effects beyond reading the file."""

import hashlib
import re
from pathlib import Path

# Matches [[Target]] or [[Target|Display Text]]; captures the raw inner text.
_WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")

# Skip anything bigger than this rather than loading it whole into memory.
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


class UnsafeNotePath(ValueError):
    """Raised when a candidate note path resolves outside the vault root
    (e.g. a symlink pointing out of the vault) or is otherwise unreadable."""


def _extract_wikilinks(content: str) -> list[str]:
    targets = []
    for match in _WIKILINK_RE.finditer(content):
        inner = match.group(1)
        target = inner.split("|", 1)[0].strip()
        if target:
            targets.append(target)
    return targets


def parse_note(path: Path, vault_root: Path) -> dict:
    """Read a markdown file and extract its note fields + wikilinks.

    Returns a dict with keys: vault_path, title, content, content_hash,
    wikilinks.

    Raises UnsafeNotePath if the file resolves outside vault_root (symlink
    escape) or exceeds MAX_FILE_SIZE_BYTES; raises UnicodeDecodeError for
    non-UTF-8 files. Callers should catch both and skip the file rather than
    aborting the whole scan.
    """
    resolved_root = vault_root.resolve()
    resolved_path = path.resolve()
    if not resolved_path.is_relative_to(resolved_root):
        raise UnsafeNotePath(f"path escapes vault root (symlink?): {path}")

    size = resolved_path.stat().st_size
    if size > MAX_FILE_SIZE_BYTES:
        raise UnsafeNotePath(f"file too large ({size} bytes): {path}")

    content = path.read_text(encoding="utf-8")
    vault_path = path.relative_to(vault_root).as_posix()
    title = path.stem
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    wikilinks = _extract_wikilinks(content)

    return {
        "vault_path": vault_path,
        "title": title,
        "content": content,
        "content_hash": content_hash,
        "wikilinks": wikilinks,
    }
