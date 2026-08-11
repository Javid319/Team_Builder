"""Centralized skill name normalization.

Normalizes skill names to canonical, case-insensitive keys so the same skill
is always stored identically — e.g. inside candidate_profiles.profile_data
(ability and evidence sections).

Examples:
    Python      -> python
    FastAPI     -> fastapi
    Qdrant      -> qdrant
    Playwright  -> playwright
    Node.js     -> nodejs
    TypeScript  -> typescript
    C++         -> cpp
    C#          -> csharp

Only data stored in candidate_profiles.profile_data is normalized here.
Source tables (skills, skill_evidence, ...) are never modified.
"""
import re
from typing import Any, Dict, Iterable, List

# Exact (already-lowercased) name -> canonical key. Handles names whose
# punctuation would otherwise be stripped away (C++, C#, Node.js, ...).
_ALIASES = {
    "node": "nodejs",
    "nodejs": "nodejs",
    "node.js": "nodejs",
    "ts": "typescript",
    "typescript": "typescript",
    "js": "javascript",
    "javascript": "javascript",
    "c": "c",
    "c++": "cpp",
    "c#": "csharp",
    "c sharp": "csharp",
    "html": "html",
    "html5": "html",
    "postgres": "postgresql",
    "postgresql": "postgresql",
}

# Fallback: strip any character that is not a letter or digit.
_STRIP_RE = re.compile(r"[^\w]")

# The profile_data sections that contain skill-name keys.
SKILL_SECTIONS = {"ability", "evidence"}


def normalize_skill_name(name: Any) -> Any:
    """Return the canonical key for a skill name.

    Non-string values (e.g. None) pass through unchanged.
    """
    if not isinstance(name, str):
        return name
    text = name.strip().lower()
    if text in _ALIASES:
        return _ALIASES[text]
    return _STRIP_RE.sub("", text)


def normalize_skill_map(skills: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``skills`` with every key normalized to its canonical form.

    Later entries win if two keys normalize to the same canonical key.
    """
    normalized: Dict[str, Any] = {}
    for name, value in skills.items():
        normalized[normalize_skill_name(name)] = value
    return normalized


def normalize_skill_names(names: Iterable[Any]) -> List[Any]:
    """Return the given skill names, each normalized to its canonical form."""
    return [normalize_skill_name(name) for name in names]
