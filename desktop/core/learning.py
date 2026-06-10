"""
JARVIS Self-Learning Module (Модуль самообучения)
Stores conversation history, learns user habits, preferences, patterns.
All data stored locally in ~/.jarvis/
"""

import json
import time
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from collections import Counter

log = logging.getLogger("jarvis.learning")

JARVIS_DIR = Path.home() / ".jarvis"
MEMORY_FILE = JARVIS_DIR / "memory.json"
HABITS_FILE = JARVIS_DIR / "habits.json"
PREFS_FILE = JARVIS_DIR / "preferences.json"


def _load(path: Path, default=None):
    if default is None:
        default = {}
    try:
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return default


def _save(path: Path, data):
    JARVIS_DIR.mkdir(exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class LearningEngine:
    """Accumulates usage patterns and improves JARVIS responses over time."""

    def __init__(self):
        self.memory = _load(MEMORY_FILE, {"conversations": [], "facts": {}})
        self.habits = _load(HABITS_FILE, {"commands": [], "hourly": {}, "top_apps": []})
        self.prefs = _load(PREFS_FILE, {
            "language": "ru",
            "name": "Хозяин",
            "response_style": "concise",
            "topics": [],
        })
        log.info(f"Learning engine loaded: {len(self.memory['conversations'])} conversations")

    # ─── Conversation Memory ───────────────────────────────────────────
    def record_exchange(self, user_text: str, jarvis_response: str, action: Optional[str] = None):
        """Save a conversation turn to long-term memory."""
        entry = {
            "ts": datetime.now().isoformat(),
            "user": user_text,
            "jarvis": jarvis_response,
            "action": action,
        }
        self.memory["conversations"].append(entry)
        # Keep last 500 conversations
        if len(self.memory["conversations"]) > 500:
            self.memory["conversations"] = self.memory["conversations"][-500:]
        _save(MEMORY_FILE, self.memory)

        # Learn command habits
        self._learn_habit(user_text)

    def _learn_habit(self, text: str):
        """Track command frequency and time-of-day patterns."""
        now = datetime.now()
        hour = str(now.hour)

        self.habits["commands"].append({"text": text, "ts": now.isoformat()})
        # Keep last 1000
        if len(self.habits["commands"]) > 1000:
            self.habits["commands"] = self.habits["commands"][-1000:]

        # Hourly usage
        self.habits["hourly"][hour] = self.habits["hourly"].get(hour, 0) + 1
        _save(HABITS_FILE, self.habits)

    # ─── Fact Learning ─────────────────────────────────────────────────
    def learn_fact(self, key: str, value: str):
        """Store a named fact about the user or environment."""
        self.memory["facts"][key] = {"value": value, "learned": datetime.now().isoformat()}
        _save(MEMORY_FILE, self.memory)
        log.info(f"Learned fact: {key} = {value}")

    def recall_fact(self, key: str) -> Optional[str]:
        """Retrieve a stored fact."""
        fact = self.memory["facts"].get(key)
        return fact["value"] if fact else None

    # ─── Context for AI ───────────────────────────────────────────────
    def build_context(self) -> str:
        """
        Build a context string to inject into the AI prompt.
        This makes responses more personalized over time.
        """
        lines = []

        # User name
        name = self.prefs.get("name", "Хозяин")
        lines.append(f"Имя пользователя: {name}")

        # Stored facts
        facts = self.memory.get("facts", {})
        if facts:
            lines.append("Известные факты о пользователе:")
            for k, v in list(facts.items())[:10]:
                lines.append(f"  - {k}: {v['value']}")

        # Recent commands (last 5)
        recent = self.memory["conversations"][-5:] if self.memory["conversations"] else []
        if recent:
            lines.append("Последние 5 запросов:")
            for conv in recent:
                lines.append(f"  Пользователь: {conv['user']}")
                lines.append(f"  JARVIS: {conv['jarvis']}")

        # Peak usage time
        hourly = self.habits.get("hourly", {})
        if hourly:
            peak = max(hourly, key=hourly.get)
            lines.append(f"Пиковое время использования: {peak}:00")

        return "\n".join(lines)

    # ─── Top Commands ─────────────────────────────────────────────────
    def get_top_commands(self, n: int = 5) -> list:
        commands = [c["text"] for c in self.habits.get("commands", [])]
        if not commands:
            return []
        counter = Counter(commands)
        return [{"command": cmd, "count": cnt} for cmd, cnt in counter.most_common(n)]

    # ─── Preference Update ────────────────────────────────────────────
    def update_preference(self, key: str, value):
        self.prefs[key] = value
        _save(PREFS_FILE, self.prefs)

    def get_preference(self, key: str, default=None):
        return self.prefs.get(key, default)

    # ─── Stats ────────────────────────────────────────────────────────
    def get_stats(self) -> dict:
        return {
            "total_conversations": len(self.memory["conversations"]),
            "facts_learned": len(self.memory["facts"]),
            "top_commands": self.get_top_commands(),
            "peak_hour": max(self.habits.get("hourly", {"0": 0}), key=self.habits.get("hourly", {"0": 0}).get) if self.habits.get("hourly") else "N/A",
        }
