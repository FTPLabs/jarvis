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
      "user_name": "ХОЗЯИН",  # Исправлено: было ХОЗЯЙН (опечатка)
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
          # Миграция: исправить сохранённую опечатку в существующих данных
          if self.memory.get("user_name") == "ХОЗЯЙН":
              self.memory["user_name"] = "ХОЗЯИН"
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
              events.append({"ts": datetime.now().isoformat(), "type": event_type, "data": data[:100]})
              if len(events) > 200:
                  events[:] = events[-200:]
              self.activity["screen_events"] = events
              self._dirty = True

      def record_app_usage(self, app_name: str) -> None:
          """Track which apps the user opens most."""
          with self._lock:
              usage = self.activity.get("focused_apps", {})
              usage[app_name] = usage.get(app_name, 0) + 1
              self.activity["focused_apps"] = usage
              self._dirty = True

      def learn_fact(self, key: str, value: str) -> None:
          """Store a specific fact about the user."""
          with self._lock:
              self.memory["facts"][key] = value
              self._dirty = True

      def update_preference(self, key: str, value: str) -> None:
          """Store a user preference."""
          with self._lock:
              self.memory["preferences"][key] = value
              self._dirty = True

      def get_user_name(self) -> str:
          return self.memory.get("user_name", "ХОЗЯИН")

      def set_user_name(self, name: str) -> None:
          with self._lock:
              self.memory["user_name"] = name
              self.memory["facts"]["имя_пользователя"] = name
              self._dirty = True

      def get_facts(self) -> dict:
          return dict(self.memory.get("facts", {}))

      def get_stats(self) -> dict:
          return {
              "total_commands": self.activity.get("total_commands", 0),
              "conversations": len(self.learning.get("conversations", [])),
              "known_facts": len(self.memory.get("facts", {})),
              "user_name": self.get_user_name(),
          }

      def get_top_commands(self, n: int = 10) -> list:
          freq = self.learning.get("command_frequency", {})
          sorted_cmds = sorted(freq.items(), key=lambda x: x[1], reverse=True)
          return [{"command": cmd, "count": cnt} for cmd, cnt in sorted_cmds[:n]]

      def build_context(self) -> str:
          """Build a context string for LLM prompts."""
          lines = []
          name = self.get_user_name()
          if name != "ХОЗЯИН":
              lines.append(f"Имя пользователя: {name}")
          facts = self.memory.get("facts", {})
          if facts:
              lines.append("Известные факты:")
              for k, v in list(facts.items())[:8]:
                  lines.append(f"  {k}: {v}")
          prefs = self.memory.get("preferences", {})
          if prefs:
              lines.append("Предпочтения:")
              for k, v in list(prefs.items())[:5]:
                  lines.append(f"  {k}: {v}")
          return "\n".join(lines)

      # ── Private ─────────────────────────────────────────────────────────────

      def _extract_facts(self, text: str) -> None:
          """Extract user facts from natural language."""
          t = text.lower()

          name_match = re.search(r"меня зовут\s+(\w+)", t)
          if name_match:
              self.set_user_name(name_match.group(1).capitalize())

          like_match = re.search(r"я (люблю|обожаю|предпочитаю)\s+(.+)", t)
          if like_match:
              self.memory["facts"][f"любит_{like_match.group(2)[:30]}"] = like_match.group(2)[:60]

          remember_match = re.search(r"запомни (что|:)?\s*(.+)", t)
          if remember_match:
              fact = remember_match.group(2)[:100]
              self.memory["facts"][f"заметка_{len(self.memory['facts'])}"] = fact

      def _track_topic(self, text: str) -> None:
          """Track topics discussed."""
          keywords = {
              "музыка": ["музыка", "песня", "плейлист", "spotify"],
              "погода": ["погода", "температура", "дождь", "снег"],
              "спорт": ["спорт", "тренировка", "фитнес"],
              "работа": ["работа", "задача", "проект", "встреча"],
              "игры": ["игра", "steam", "discord"],
          }
          t = text.lower()
          topic_freq = self.learning.get("topic_frequency", {})
          for topic, words in keywords.items():
              if any(w in t for w in words):
                  topic_freq[topic] = topic_freq.get(topic, 0) + 1
          self.learning["topic_frequency"] = topic_freq

      def _start_autosave(self) -> None:
          """Auto-save every 30 seconds if data changed."""
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
  