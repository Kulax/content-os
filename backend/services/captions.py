import re
from typing import List

from backend.models import SubtitleCue


MAX_CHARS_PER_CAPTION = 42
MIN_CAPTION_SECONDS = 0.8

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?\u3002\uff01\uff1f\u0964])\s+")


def _chunk_sentence(sentence: str, max_chars: int) -> List[str]:
    words = sentence.split()
    chunks: List[str] = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = word
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


def split_caption_text(text: str, max_chars: int = MAX_CHARS_PER_CAPTION) -> List[str]:
    normalized = " ".join((text or "").split())
    if not normalized:
        return []

    chunks: List[str] = []
    for sentence in _SENTENCE_SPLIT.split(normalized):
        chunks.extend(_chunk_sentence(sentence, max_chars))

    return chunks


def build_caption_cues(
    text: str,
    duration_seconds: float,
    max_chars: int = MAX_CHARS_PER_CAPTION,
) -> List[SubtitleCue]:
    """Spread caption chunks across the narration duration, weighted by text length."""
    chunks = split_caption_text(text, max_chars=max_chars)
    if not chunks or not duration_seconds or duration_seconds <= 0:
        return []

    # Never show captions faster than a readable minimum; drop the tail into fewer cues if needed.
    max_cues = max(1, int(duration_seconds // MIN_CAPTION_SECONDS))
    if len(chunks) > max_cues:
        merged: List[str] = []
        per_cue = -(-len(chunks) // max_cues)
        for i in range(0, len(chunks), per_cue):
            merged.append(" ".join(chunks[i:i + per_cue]))
        chunks = merged

    weights = [max(len(chunk), 1) for chunk in chunks]
    total_weight = sum(weights)

    cues: List[SubtitleCue] = []
    cursor = 0.0
    for index, (chunk, weight) in enumerate(zip(chunks, weights)):
        end = duration_seconds if index == len(chunks) - 1 else cursor + duration_seconds * weight / total_weight
        end = round(end, 3)
        if end <= cursor:
            continue
        cues.append(SubtitleCue(start_seconds=round(cursor, 3), end_seconds=end, text=chunk))
        cursor = end

    return cues
