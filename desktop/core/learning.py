"""
JARVIS Self-Learning Engine (Модуль самообучения)
==================================================
Watches user behaviour and learns from every interaction.
Tracks: conversations, learned facts, app usage patterns,
screen focus events, time-of-day preferences.
All data stored locally in ~/.jarvis/ — no cloud, fully private.
"""
import json
import os
import time
import threading
import re
from datetime import datetime
from pathlib import Path
from typing import Any

JARVIS_DIR = Path.home() / ".jarvis"
JARVIS_DIR.mkdir(exist_ok=True)
MEMORY_FILE = JARVIS_DIR / "memory.json"
LEARN_FILE = JARVIS_DIR / "learning.json"
ACTIVITY_FILE = JARVIS_DIR / "activity.json"

DEFAULT_MEMORY: dict[str, Any] = {
    "user_name": "ХОЗЯЙН",
    "facts": {},
    "preferences": {},
    "goals": [],
}
DEFAULT_LEARN: dict[str, Any] = {
    "conversations": [],
    "command_frequency": {},
    "app_usage": {},
    "topic_frequency": {},
    "hourly_activity": {str(h): 0 for h in range(24)},
    "last_updated": "",
}
DEFAULT_ACTIVITY: dict[str, Any] = {
    "screen_events": [],
    "focused_apps": {},
    "total_commands": 0,
}


def _load(path: Path, default: dict) -> dict:
    try:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return dict(default)


def _save(path: Path, data: dict) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


class LearningEngine:
    """Core self-learning engine. Learns from every user interaction."""

    def __init__(self):
        self._lock = threading.Lock()
        self.memory = _load(MEMORY_FILE, DEFAULT_MEMORY)
        self.learning = _load(LEARN_FILE, DEFAULT_LEARN)
        self.activity = _load(ACTIVITY_FILE, DEFAULT_ACTIVITY)
        self._dirty = False
        self._start_autosave()

    # ── Public API ──────────────────────────────────────────────────────────

    def record_conversation(self, user_text: str, jarvis_response: str) -> None:
        """Record a conversation turn and extract facts automatically."""
        with self._lock:
            ts = datetime.now().isoformat()
            hour = str(datetime.now().hour)

            self.learning["hourly_activity"][hour] = self.learning["hourly_activity"].get(hour, 0) + 1

            conv = self.learning["conversations"]
            conv.append({"ts": ts, "user": user_text[:300], "jarvis": jarvis_response[:300]})
            if len(conv) > 500:
                conv[:] = conv[-500:]

            self.activity["total_commands"] = self.activity.get("total_commands", 0) + 1
            self._extract_facts(user_text)
            self._track_topic(user_text)
            self._dirty = True

    def record_screen_event(self, event_type: str, data: str) -> None:
        """Record screen/system event for behaviour learning."""
        with self._lock:
            events = self.activity.get("screen_events", [])
            events.append({"ts": datetime.now().isoformat(), "type": event_type, "data": data[:200]})
            if len(events) > 300:
                events[:] = events[-300:]
            self.activity["screen_events"] = events

            if event_type == "app_focused":
                apps = self.activity.get("focused_apps", {})
                apps[data] = apps.get(data, 0) + 1
                self.activity["focused_apps"] = apps

            self._dirty = True

    def learn_fact(self, key: str, value: str) -> None:
        with self._lock:
            self.memory["facts"][key] = value
            self._dirty = True

    def set_user_name(self, name: str) -> None:
        with self._lock:
            self.memory["user_name"] = name
            self._dirty = True

    def get_user_name(self) -> str:
        return self.memory.get("user_name", "ХОЗЯЙН")

    def get_context_for_ai(self) -> str:
        """Build rich context string for injecting into AI prompts."""
        lines: list[str] = []
        name = self.memory.get("user_name", "ХОЗЯЙН")
        if name != "ХОЗЯЙН":
            lines.append(f"Имя пользователя: {name}")

        facts = self.memory.get("facts", {})
        if facts:
            lines.append("Запомненные факты:")
            for k, v in list(facts.items())[:10]:
                lines.append(f"  {k}: {v}")

        prefs = self.memory.get("preferences", {})
        if prefs:
            lines.append("Предпочтения:")
            for k, v in list(prefs.items())[:5]:
                lines.append(f"  {k}: {v}")

        freq = self.learning.get("topic_frequency", {})
        top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:5]
        if top:
            lines.append(f"Частые темы: {', '.join(t for t, _ in top)}")

        apps = self.activity.get("focused_apps", {})
        top_apps = sorted(apps.items(), key=lambda x: x[1], reverse=True)[:3]
        if top_apps:
            lines.append(f"Часто используемые приложения: {', '.join(a for a, _ in top_apps)}")

        convs = self.learning.get("conversations", [])
        if convs:
            recent = convs[-3:]
            lines.append("Последние разговоры:")
            for c in recent:
                lines.append(f"  Пользователь: {c['user'][:80]}")
                lines.append(f"  JARVIS: {c['jarvis'][:80]}")

        return "\n".join(lines)

    def get_stats(self) -> dict:
        return {
            "total_commands": self.activity.get("total_commands", 0),
            "facts_learned": len(self.memory.get("facts", {})),
            "conversations": len(self.learning.get("conversations", [])),
            "top_topics": sorted(
                self.learning.get("topic_frequency", {}).items(),
                key=lambda x: x[1], reverse=True
            )[:10],
            "top_apps": sorted(
                self.activity.get("focused_apps", {}).items(),
                key=lambda x: x[1], reverse=True
            )[:5],
            "user_name": self.memory.get("user_name", "ХОЗЯЙН"),
            "peak_hour": self._peak_hour(),
        }

    # ── Internal helpers ────────────────────────────────────────────────────

    def _extract_facts(self, text: str) -> None:
        t = text.lower()

        m = re.search(r"меня зовут\s+(\w+)", t)
        if m:
            name = m.group(1).capitalize()
            self.memory["user_name"] = name
            self.memory["facts"]["имя"] = name

        m = re.search(r"запомни[,\s]+что\s+(.+)", t)
        if m:
            fact = m.group(1).strip()[:150]
            key = f"факт_{len(self.memory.get('facts', {}))}"
            self.memory.setdefault("facts", {})[key] = fact

        m = re.search(r"я (люблю|предпочитаю|обожаю)\s+(.+)", t)
        if m:
            pref_key = f"предпочитает_{m.group(2)[:25]}"
            self.memory.setdefault("preferences", {})[pref_key] = m.group(2)[:100]

        m = re.search(r"(хочу|планирую|собираюсь)\s+(.+)", t)
        if m:
            goal = m.group(2).strip()[:100]
            goals = self.memory.get("goals", [])
            if goal not in goals:
                goals.append(goal)
                self.memory["goals"] = goals[-20:]

    def _track_topic(self, text: str) -> None:
        t = text.lower()
        topics = {
            "время": ["время", "часы", "который час", "сколько времени"],
            "музыка": ["музыка", "спотифай", "spotify", "песн", "трек"],
            "браузер": ["хром", "браузер", "открой сайт", "сайт"],
            "поиск": ["найди", "загугли", "поиск", "поищи"],
            "память": ["запомни", "помни", "заметь"],
            "приложения": ["запусти", "открой", "включи", "запускай"],
            "статистика": ["статистик", "ютуб", "тикток", "аналитик"],
            "разговор": ["привет", "как дела", "помощь", "что умеешь"],
        }
        freq = self.learning.setdefault("topic_frequency", {})
        for topic, keywords in topics.items():
            if any(kw in t for kw in keywords):
                freq[topic] = freq.get(topic, 0) + 1

    def _peak_hour(self) -> int:
        hourly = self.learning.get("hourly_activity", {})
        if not hourly:
            return 12
        return int(max(hourly, key=lambda h: hourly.get(h, 0)))

    def _autosave(self) -> None:
        while True:
            time.sleep(15)
            if self._dirty:
                with self._lock:
                    self.learning["last_updated"] = datetime.now().isoformat()
                    _save(MEMORY_FILE, self.memory)
                    _save(LEARN_FILE, self.learning)
                    _save(ACTIVITY_FILE, self.activity)
                    self._dirty = False

    def _start_autosave(self) -> None:
        t = threading.Thread(target=self._autosave, daemon=True)
        t.start()


_engine: LearningEngine | None = None


def get_engine() -> LearningEngine:
    global _engine
    if _engine is None:
        _engine = LearningEngine()
    return _engine
