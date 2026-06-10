"""
JARVIS Desktop Core — Python backend engine (Russian Edition)
Handles: голосовой пайплайн, управление ПК, HWID, Ollama, STT/TTS, самообучение
"""

import os
import sys
import json
import time
import hashlib
import platform
import subprocess
import threading
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Logging ────────────────────────────────────────────────────────────────
JARVIS_DIR = Path.home() / ".jarvis"
JARVIS_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(JARVIS_DIR / "jarvis.log", mode="a", encoding="utf-8"),
    ],
)
log = logging.getLogger("jarvis.core")

CONFIG_PATH = JARVIS_DIR / "config.json"
LICENSE_PATH = JARVIS_DIR / "license.json"

app = FastAPI(title="JARVIS Core", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:8081", "http://127.0.0.1:8080", "http://127.0.0.1:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Self-Learning Engine ────────────────────────────────────────────────────
try:
    from learning import LearningEngine
    learning = LearningEngine()
    log.info("Модуль самообучения загружен")
except Exception as e:
    log.warning(f"Модуль обучения недоступен: {e}")
    learning = None

# ─── HWID ────────────────────────────────────────────────────────────────────
def get_hwid() -> str:
    try:
        if platform.system() == "Windows":
            result = subprocess.check_output(
                "wmic csproduct get uuid", shell=True
            ).decode().strip().split("\n")[-1].strip()
            raw = result + platform.node()
        elif platform.system() == "Darwin":
            result = subprocess.check_output(
                ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"]
            ).decode()
            import re
            match = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', result)
            raw = match.group(1) if match else platform.node()
        else:
            raw = open("/etc/machine-id").read().strip()
    except Exception:
        raw = platform.node() + str(os.getpid())
    return hashlib.sha256(raw.encode()).hexdigest()[:32].upper()

HWID = get_hwid()

# ─── License ─────────────────────────────────────────────────────────────────
def load_license() -> Dict[str, Any]:
    if LICENSE_PATH.exists():
        with open(LICENSE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_license(data: Dict[str, Any]):
    with open(LICENSE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

class LicenseActivateRequest(BaseModel):
    licenseKey: str
    email: Optional[str] = None

@app.get("/native/license/status")
def license_status():
    data = load_license()
    activated = bool(data.get("licenseKey") and data.get("hwid") == HWID)
    days_remaining = None
    if data.get("expiresAt"):
        expires = datetime.fromisoformat(data["expiresAt"])
        days_remaining = max(0, (expires - datetime.now()).days)
        if days_remaining == 0:
            activated = False
    return {
        "hwid": HWID,
        "activated": activated,
        "licenseType": data.get("licenseType"),
        "expiresAt": data.get("expiresAt"),
        "daysRemaining": days_remaining,
        "email": data.get("email"),
    }

@app.post("/native/license/activate")
def license_activate(req: LicenseActivateRequest):
    key = req.licenseKey.strip().upper()
    is_perm = "PERM" in key or key.startswith("JARVIS-PERM")
    is_trial = key.startswith("JARVIS-") and not is_perm
    is_demo = key == "JARVIS-DEMO-TEST-2024"

    if not (is_perm or is_trial or is_demo):
        raise HTTPException(400, "Неверный формат лицензионного ключа")

    license_type = "permanent" if is_perm else "trial"
    expires_at = None if is_perm else (datetime.now() + timedelta(days=30)).isoformat()

    data = {
        "hwid": HWID,
        "licenseKey": key,
        "licenseType": license_type,
        "email": req.email,
        "activatedAt": datetime.now().isoformat(),
        "expiresAt": expires_at,
    }
    save_license(data)
    return license_status()

# ─── Voice State ─────────────────────────────────────────────────────────────
voice_state = {
    "listening": True,
    "sttEngine": "whisper",
    "ttsEngine": "piper",
    "wakeWordEnabled": True,
    "wakeWord": "Джарвис",
    "ollamaConnected": False,
    "ollamaModel": "llama3:8b",
    "language": "ru",
}

session_command_count = 0

def check_ollama() -> bool:
    try:
        import urllib.request
        req = urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2)
        return req.status == 200
    except Exception:
        return False

@app.get("/native/voice/status")
def voice_status():
    voice_state["ollamaConnected"] = check_ollama()
    return voice_state

class ListenToggle(BaseModel):
    enabled: bool

@app.post("/native/voice/listen")
def toggle_listening(req: ListenToggle):
    voice_state["listening"] = req.enabled
    log.info(f"Прослушивание: {req.enabled}")
    return voice_status()

class CommandRequest(BaseModel):
    text: str
    source: str = "text"

@app.post("/native/voice/command")
async def process_command(req: CommandRequest):
    import uuid
    global session_command_count
    text = req.text.strip()
    log.info(f"Команда: {text}")
    session_command_count += 1

    # Build enriched prompt with learning context
    context = ""
    if learning:
        context = learning.build_context()

    # System prompt in Russian
    system_prompt = f"""Ты JARVIS — персональный голосовой ассистент на русском языке, как в фильме Железный человек.
Отвечай ТОЛЬКО по-русски. Кратко и чётко — максимум 2 предложения.
Обращайся к пользователю уважительно. Ты умный, быстрый и всегда полезный.

{context}"""

    # Route to Ollama if connected
    answer = None
    if voice_state["ollamaConnected"]:
        try:
            import urllib.request, json as _json
            payload = _json.dumps({
                "model": voice_state["ollamaModel"],
                "prompt": f"{system_prompt}\n\nПользователь: {text}\nJARVIS:",
                "stream": False,
                "options": {"temperature": 0.7, "num_predict": 100},
            }).encode()
            request = urllib.request.Request(
                "http://127.0.0.1:11434/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            response = urllib.request.urlopen(request, timeout=30)
            result = _json.loads(response.read())
            answer = result.get("response", "").strip()
        except Exception as e:
            log.warning(f"Ошибка Ollama: {e}")

    # Fallback: smart command routing
    if not answer:
        answer = _route_command(text)

    # Save to learning memory
    if learning:
        learning.record_exchange(text, answer)

    # Log activity
    _log_activity("голос" if req.source == "voice" else "текст", text)

    return {
        "id": str(uuid.uuid4()),
        "text": answer,
        "action": None,
        "actionResult": None,
        "ttsUrl": None,
        "timestamp": datetime.now().isoformat(),
    }

def _route_command(text: str) -> str:
    """Smart command routing without Ollama (fallback)."""
    t = text.lower()

    # Time/Date
    if any(w in t for w in ["время", "часы", "который час"]):
        return f"Сейчас {datetime.now().strftime('%H:%M')}, {_ru_date()}."
    if any(w in t for w in ["дата", "какой день", "число"]):
        return f"Сегодня {_ru_date()}."

    # Apps
    for app_ru, app_en in [
        ("хром", "chrome"), ("браузер", "chrome"), ("хромиум", "chrome"),
        ("спотифай", "spotify"), ("музыка", "spotify"),
        ("телеграм", "telegram"), ("дискорд", "discord"),
        ("блокнот", "notepad"), ("калькулятор", "calculator"),
        ("проводник", "explorer"), ("файлы", "explorer"),
    ]:
        if app_ru in t:
            _launch_app_internal(app_en)
            return f"Запускаю {app_ru.capitalize()}."

    # Search
    if "найди" in t or "поиск" in t or "загугли" in t:
        query = t.replace("найди", "").replace("поиск", "").replace("загугли", "").strip()
        _open_url(f"https://www.google.com/search?q={query}")
        return f"Ищу: {query}."

    # YouTube
    if "ютуб" in t or "youtube" in t:
        query = t.replace("ютуб", "").replace("youtube", "").replace("включи", "").strip()
        if query:
            _open_url(f"https://www.youtube.com/results?search_query={query}")
            return f"Открываю YouTube: {query}."
        _open_url("https://www.youtube.com")
        return "Открываю YouTube."

    # System
    if "выключи" in t and ("компьютер" in t or "пк" in t):
        return "Для выключения компьютера используйте меню Пуск."
    if "перезагрузи" in t:
        return "Перезагрузка доступна через меню Пуск → Питание."
    if "память" in t or "озу" in t:
        return _get_memory_info()
    if "процессор" in t or "цпу" in t or "нагрузка" in t:
        return _get_cpu_info()

    # Greeting
    if any(w in t for w in ["привет", "здравствуй", "добрый"]):
        hour = datetime.now().hour
        greeting = "Доброе утро" if 5 <= hour < 12 else "Добрый день" if 12 <= hour < 17 else "Добрый вечер"
        name = learning.get_preference("name", "ХОЗЯЙН") if learning else "ХОЗЯЙН"
        return f"{greeting}, {name}! Готов к работе."

    # Learning: remember name
    if "меня зовут" in t:
        name = t.replace("меня зовут", "").strip().capitalize()
        if learning and name:
            learning.update_preference("name", name)
            learning.learn_fact("имя_пользователя", name)
        return f"Запомнил. Рад познакомиться, {name}!"

    # Help
    if "что ты умеешь" in t or "помощь" in t or "команды" in t:
        return "Я умею: открывать приложения, искать в интернете, отвечать на вопросы, показывать время и дату, управлять системой."

    return "Я вас слышу. Уточните команду или задайте вопрос."

def _ru_date() -> str:
    months = ["января","февраля","марта","апреля","мая","июня",
              "июля","августа","сентября","октября","ноября","декабря"]
    days = ["понедельник","вторник","среда","четверг","пятница","суббота","воскресенье"]
    now = datetime.now()
    return f"{days[now.weekday()]}, {now.day} {months[now.month-1]} {now.year}"

def _get_memory_info() -> str:
    try:
        import psutil
        m = psutil.virtual_memory()
        return f"ОЗУ: {m.used//1024**3}ГБ из {m.total//1024**3}ГБ используется ({m.percent:.0f}%)."
    except Exception:
        return "Информация об ОЗУ недоступна."

def _get_cpu_info() -> str:
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.5)
        return f"Процессор загружен на {cpu:.0f}%."
    except Exception:
        return "Информация о процессоре недоступна."

def _launch_app_internal(name: str):
    APP_MAP = {
        "chrome": ("chrome", "google-chrome", "chromium"),
        "firefox": ("firefox",),
        "spotify": ("spotify",),
        "discord": ("discord",),
        "telegram": ("telegram",),
        "notepad": ("notepad",),
        "calculator": ("calc",),
        "explorer": ("explorer",),
    }
    cmds = APP_MAP.get(name, (name,))
    for cmd in cmds:
        try:
            if platform.system() == "Windows":
                os.startfile(cmd)
            elif platform.system() == "Darwin":
                subprocess.Popen(["open", "-a", cmd])
            else:
                subprocess.Popen([cmd], start_new_session=True)
            return
        except Exception:
            continue

def _open_url(url: str):
    try:
        import webbrowser
        webbrowser.open(url)
    except Exception:
        pass

def _log_activity(kind: str, message: str):
    log_file = JARVIS_DIR / "activity.json"
    try:
        entries = json.loads(log_file.read_text(encoding="utf-8")) if log_file.exists() else []
    except Exception:
        entries = []
    entries.append({"type": kind, "message": message[:200], "ts": datetime.now().isoformat()})
    entries = entries[-200:]
    log_file.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")

# ─── System Stats ─────────────────────────────────────────────────────────────
START_TIME = time.time()

@app.get("/native/stats/system")
def system_stats():
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        uptime = time.time() - psutil.boot_time()
        return {
            "cpuPercent": round(cpu, 1),
            "ramPercent": round(mem.percent, 1),
            "ramUsedGb": round(mem.used / 1024**3, 2),
            "ramTotalGb": round(mem.total / 1024**3, 2),
            "uptimeHours": round(uptime / 3600, 1),
            "sessionCommands": session_command_count,
            "jarvisUptime": round((time.time() - START_TIME) / 3600, 2),
            "diskPercent": round(disk.percent, 1),
        }
    except ImportError:
        return {"cpuPercent": 0.0, "ramPercent": 0.0, "ramUsedGb": 0.0,
                "ramTotalGb": 0.0, "uptimeHours": 0.0, "sessionCommands": session_command_count,
                "jarvisUptime": 0.0, "diskPercent": 0.0}

@app.get("/native/apps/running")
def running_apps():
    try:
        import psutil
        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info"]):
            try:
                info = p.info
                procs.append({
                    "pid": info["pid"],
                    "name": info["name"],
                    "cpu": round(info["cpu_percent"] or 0, 1),
                    "memory": round((info["memory_info"].rss if info["memory_info"] else 0) / 1024**2, 1),
                })
            except Exception:
                pass
        return sorted(procs, key=lambda x: x["cpu"], reverse=True)[:20]
    except ImportError:
        return []

# ─── Learning API ─────────────────────────────────────────────────────────────
@app.get("/native/learning/stats")
def learning_stats():
    if not learning:
        return {"error": "Модуль обучения не загружен"}
    return learning.get_stats()

@app.get("/native/learning/top-commands")
def top_commands():
    if not learning:
        return []
    return learning.get_top_commands(10)

class FactRequest(BaseModel):
    key: str
    value: str

@app.post("/native/learning/fact")
def save_fact(req: FactRequest):
    if learning:
        learning.learn_fact(req.key, req.value)
    return {"ok": True}

# ─── App Launcher ─────────────────────────────────────────────────────────────
class LaunchRequest(BaseModel):
    appId: Optional[str] = None
    name: Optional[str] = None

@app.post("/native/apps/launch")
def launch_app(req: LaunchRequest):
    name = req.appId or req.name or ""
    _launch_app_internal(name.lower())
    return {"success": True, "message": f"Запуск {name}", "appName": name}

# ─── Auto-Start on Windows ────────────────────────────────────────────────────
def setup_autostart():
    """Register JARVIS to start with Windows."""
    if platform.system() != "Windows":
        return
    try:
        import winreg
        exe_path = sys.executable if getattr(sys, "frozen", False) else None
        if not exe_path:
            return
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE
        )
        winreg.SetValueEx(key, "JARVIS", 0, winreg.REG_SZ, f'"{exe_path}"')
        winreg.CloseKey(key)
        log.info("Автозапуск с Windows настроен")
    except Exception as e:
        log.warning(f"Не удалось настроить автозапуск: {e}")

# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info(f"JARVIS запускается | HWID: {HWID}")
    setup_autostart()
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
