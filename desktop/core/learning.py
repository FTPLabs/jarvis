"""
JARVIS Self-Learning Engine
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

DEFAULT_MEMORY = {
    "user_name": "ХОЗЯИН",
    "facts": {},
    "preferences": {},
    "goals": [],
}
DEFAULT_LEARN = {
    "conversations": [],
    "command_frequency": {},
    "app_usage": {},
    "topic_frequency": {},
    "hourly_activity": {str(h): 0 for h in range(24)},
    "last_updated": "",
}
DEFAULT_ACTIVITY = {
    "screen_events": [],
    "focused_apps": {},
    "total_commands": 0,
}


def _load(path, default):
    try:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return dict(default)


def _save(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


class LearningEngine:
    """Core self-learning engine."""

    def __init__(self):
        self._lock = threading.Lock()
        self.memory = _load(MEMORY_FILE, DEFAULT_MEMORY)
        self.learning = _load(LEARN_FILE, DEFAULT_LEARN)
        self.activity = _load(ACTIVITY_FILE, DEFAULT_ACTIVITY)
        # Миграция: исправить опечатку в существующих данных
        if self.memory.get("user_name") == "\u0425\u041e\u0417\u042f\u0419\u041d":
            self.memory["user_name"] = "\u0425\u041e\u0417\u042f\u0418\u041d"
        self._dirty = False
        self._start_autosave()

    def record_conversation(self, user_text, jarvis_response):
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

    def record_screen_event(self, event_type, data):
        with self._lock:
            events = self.activity.get("screen_events", [])
            events.append({"ts": datetime.now().isoformat(), "type": event_type, "data": data[:100]})
            if len(events) > 200:
                events[:] = events[-200:]
            self.activity["screen_events"] = events
            self._dirty = True

    def record_app_usage(self, app_name):
        with self._lock:
            usage = self.activity.get("focused_apps", {})
            usage[app_name] = usage.get(app_name, 0) + 1
            self.activity["focused_apps"] = usage
            self._dirty = True

    def learn_fact(self, key, value):
        with self._lock:
            self.memory["facts"][key] = value
            self._dirty = True

    def update_preference(self, key, value):
        with self._lock:
            self.memory["preferences"][key] = value
            self._dirty = True

    def get_user_name(self):
        return self.memory.get("user_name", "\u0425\u041e\u0417\u042f\u0418\u041d")

    def set_user_name(self, name):
        with self._lock:
            self.memory["user_name"] = name
            self.memory["facts"]["\u0438\u043c\u044f_\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f"] = name
            self._dirty = True

    def get_facts(self):
        return dict(self.memory.get("facts", {}))

    def get_stats(self):
        return {
            "total_commands": self.activity.get("total_commands", 0),
            "conversations": len(self.learning.get("conversations", [])),
            "known_facts": len(self.memory.get("facts", {})),
            "user_name": self.get_user_name(),
        }

    def get_top_commands(self, n=10):
        freq = self.learning.get("command_frequency", {})
        sorted_cmds = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        return [{"command": cmd, "count": cnt} for cmd, cnt in sorted_cmds[:n]]

    def build_context(self):
        lines = []
        name = self.get_user_name()
        if name != "\u0425\u041e\u0417\u042f\u0418\u041d":
            lines.append(f"\u0418\u043c\u044f: {name}")
        facts = self.memory.get("facts", {})
        if facts:
            lines.append("\u0424\u0430\u043a\u0442\u044b:")
            for k, v in list(facts.items())[:8]:
                lines.append(f"  {k}: {v}")
        return "\n".join(lines)

    def _extract_facts(self, text):
        t = text.lower()
        name_match = re.search(r"\u043c\u0435\u043d\u044f \u0437\u043e\u0432\u0443\u0442\s+(\w+)", t)
        if name_match:
            self.set_user_name(name_match.group(1).capitalize())
        like_match = re.search(r"\u044f (\u043b\u044e\u0431\u043b\u044e|\u043f\u0440\u0435\u0434\u043f\u043e\u0447\u0438\u0442\u0430\u044e)\s+(.+)", t)
        if like_match:
            pref = like_match.group(2)[:60]
            key = f"\u043f\u0440\u0435\u0434\u043f\u043e\u0447\u0442\u0435\u043d\u0438\u0435_{len(self.memory['facts'])}"
            self.memory["facts"][key] = pref

    def _track_topic(self, text):
        keywords = {
            "\u043c\u0443\u0437\u044b\u043a\u0430": ["\u043c\u0443\u0437\u044b\u043a\u0430", "spotify"],
            "\u043f\u043e\u0433\u043e\u0434\u0430": ["\u043f\u043e\u0433\u043e\u0434\u0430"],
            "\u0440\u0430\u0431\u043e\u0442\u0430": ["\u0437\u0430\u0434\u0430\u0447\u0430", "\u043f\u0440\u043e\u0435\u043a\u0442"],
        }
        t = text.lower()
        topic_freq = self.learning.get("topic_frequency", {})
        for topic, words in keywords.items():
            if any(w in t for w in words):
                topic_freq[topic] = topic_freq.get(topic, 0) + 1
        self.learning["topic_frequency"] = topic_freq

    def _start_autosave(self):
        def _loop():
            while True:
                time.sleep(30)
                if self._dirty:
                    with self._lock:
                        _save(MEMORY_FILE, self.memory)
                        _save(LEARN_FILE, self.learning)
                        _save(ACTIVITY_FILE, self.activity)
                        self.learning["last_updated"] = datetime.now().isoformat()
                        self._dirty = False
        t = threading.Thread(target=_loop, daemon=True)
        t.start()
