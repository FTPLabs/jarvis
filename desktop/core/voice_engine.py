"""
JARVIS Voice Engine — Русский голосовой движок
Wake word → STT (Whisper, русский) → Обработка → TTS (edge-tts, DmitryNeural)
Не требует нажатий — работает полностью голосом.
"""

import os
import time
import wave
import struct
import asyncio
import logging
import threading
import tempfile
import platform
import subprocess
from pathlib import Path
from typing import Optional, Callable

log = logging.getLogger("jarvis.voice")

JARVIS_DIR = Path.home() / ".jarvis"

# edge-tts (ru-RU-DmitryNeural) требует интернет; при отсутствии — fallback на pyttsx3 (офлайн)
TTS_VOICE = "ru-RU-DmitryNeural"
TTS_RATE = "+5%"   # чуть быстрее стандартного — звучит увереннее
TTS_OFFLINE_FALLBACK = True  # автоматический fallback на pyttsx3 при ошибке сети


class VoiceEngine:
  """
  Локальный голосовой пайплайн (офлайн STT + онлайн TTS через edge-tts):
  Wake Word → STT → Команда → TTS
  """

  def __init__(self, config: dict, on_command: Callable[[str], str]):
      self.config = config
      self.on_command = on_command
      self.listening = False
      self.interrupted = False
      self._thread: Optional[threading.Thread] = None
      self._whisper_model = None

  # ─── Wake Word — VAD (без ключа Porcupine) ─────────────────────────
  def _detect_wake_word_vad(self) -> bool:
      try:
          import pyaudio
          import numpy as np

          pa = pyaudio.PyAudio()
          CHUNK = 1024
          RATE = 16000
          THRESHOLD = 800

          stream = pa.open(
              format=pyaudio.paInt16, channels=1, rate=RATE,
              input=True, frames_per_buffer=CHUNK,
          )
          log.info("JARVIS слушает (VAD режим)...")

          while not self.interrupted:
              data = stream.read(CHUNK, exception_on_overflow=False)
              audio_data = np.frombuffer(data, dtype=np.int16)
              rms = np.sqrt(np.mean(audio_data.astype(np.float32) ** 2))
              if rms > THRESHOLD:
                  stream.stop_stream(); stream.close(); pa.terminate()
                  return True

          stream.stop_stream(); stream.close(); pa.terminate()
      except ImportError:
          log.warning("pyaudio/numpy не установлены — голосовое управление недоступно")
          time.sleep(5)
      except Exception as e:
          log.error(f"VAD ошибка: {e}")
          time.sleep(1)
      return False

  def _detect_wake_word_porcupine(self) -> bool:
      try:
          import pvporcupine, pyaudio
          access_key = self.config.get("porcupineKey", "")
          if not access_key:
              return False
          porcupine = pvporcupine.create(access_key=access_key, keywords=["jarvis"])
          pa = pyaudio.PyAudio()
          stream = pa.open(
              rate=porcupine.sample_rate, channels=1, format=pyaudio.paInt16,
              input=True, frames_per_buffer=porcupine.frame_length,
          )
          log.info("Ожидание слова 'Джарвис'...")
          while not self.interrupted:
              pcm = stream.read(porcupine.frame_length, exception_on_overflow=False)
              pcm = struct.unpack_from("h" * porcupine.frame_length, pcm)
              if porcupine.process(pcm) >= 0:
                  log.info("Слово обнаружено!")
                  stream.stop_stream(); stream.close(); pa.terminate(); porcupine.delete()
                  return True
      except ImportError:
          pass
      except Exception as e:
          log.error(f"Porcupine ошибка: {e}")
      return False

  def _detect_wake_word(self) -> bool:
      if self.config.get("porcupineKey"):
          if self._detect_wake_word_porcupine():
              return True
      return self._detect_wake_word_vad()

  # ─── STT — Whisper (русский) ────────────────────────────────────────
  def transcribe(self, audio_path: str) -> str:
      try:
          import whisper
          if self._whisper_model is None:
              model_name = self.config.get("whisperModel", "small")
              log.info(f"Загрузка Whisper '{model_name}'...")
              self._whisper_model = whisper.load_model(model_name)
          result = self._whisper_model.transcribe(
              audio_path, language="ru", task="transcribe", fp16=False,
              initial_prompt="Команды на русском для голосового ассистента.",
          )
          text = result["text"].strip()
          log.info(f"Распознано: {text}")
          return text
      except ImportError:
          log.error("Whisper не установлен: pip install openai-whisper")
      except Exception as e:
          log.error(f"STT ошибка: {e}")
      return ""

  # ─── Запись с микрофона ─────────────────────────────────────────────
  def record_audio(self, duration: float = 6.0) -> Optional[str]:
      try:
          import pyaudio, numpy as np
          pa = pyaudio.PyAudio()
          sample_rate, chunk = 16000, 1024
          silence_threshold = 500
          max_silence_chunks = int(sample_rate / chunk * 1.5)

          stream = pa.open(
              format=pyaudio.paInt16, channels=1, rate=sample_rate,
              input=True, frames_per_buffer=chunk,
          )
          log.info("Запись команды...")
          frames, silence_count = [], 0
          max_chunks = int(sample_rate / chunk * duration)

          for _ in range(max_chunks):
              data = stream.read(chunk, exception_on_overflow=False)
              frames.append(data)
              rms = np.sqrt(np.mean(np.frombuffer(data, dtype=np.int16).astype(np.float32) ** 2))
              silence_count = silence_count + 1 if rms < silence_threshold else 0
              if silence_count > max_silence_chunks:
                  break

          stream.stop_stream(); stream.close(); pa.terminate()

          tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
          with wave.open(tmp.name, "wb") as wf:
              wf.setnchannels(1)
              wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
              wf.setframerate(sample_rate)
              wf.writeframes(b"".join(frames))
          return tmp.name
      except ImportError:
          log.error("pyaudio не установлен")
      except Exception as e:
          log.error(f"Ошибка записи: {e}")
      return None

  # ─── TTS — edge-tts (Microsoft DmitryNeural, человекоподобный) ─────
  def speak(self, text: str) -> None:
      """Синтез речи через Microsoft edge-tts (DmitryNeural — живой мужской голос)."""
      if not text or not text.strip():
          return
      # Запускаем async edge-tts в отдельном event loop
      try:
          loop = asyncio.new_event_loop()
          asyncio.set_event_loop(loop)
          audio_path = loop.run_until_complete(self._speak_edge(text))
          loop.close()
          if audio_path:
              self._play_audio(audio_path)
              try:
                  os.unlink(audio_path)
              except Exception:
                  pass
      except Exception as e:
          log.error(f"edge-tts ошибка: {e}")
          self._speak_fallback(text)

  async def _speak_edge(self, text: str) -> Optional[str]:
      """Async: генерация MP3 через edge-tts."""
      try:
          import edge_tts
          voice = self.config.get("ttsVoice", TTS_VOICE)
          rate = self.config.get("ttsRate", TTS_RATE)
          communicate = edge_tts.Communicate(text, voice, rate=rate)
          tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
          await communicate.save(tmp.name)
          return tmp.name
      except ImportError:
          log.error("edge-tts не установлен: pip install edge-tts")
      except Exception as e:
          log.error(f"edge-tts генерация: {e}")
      return None

  def _speak_fallback(self, text: str) -> None:
      """Запасной TTS: системный голос Windows."""
      try:
          if platform.system() == "Windows":
              # PowerShell SAPI — встроен в Windows, без установки
              ps_cmd = (
                  f"Add-Type -AssemblyName System.Speech; "
                  f"$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                  f"$s.Rate = 2; $s.Speak('{text.replace(chr(39), chr(96))}');"
              )
              subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True, timeout=30)
      except Exception as e:
          log.error(f"Fallback TTS ошибка: {e}")

  def _play_audio(self, path: str) -> None:
      try:
          if platform.system() == "Windows":
              import winsound
              # winsound не поддерживает MP3 — используем PowerShell Media.Player
              ps_cmd = (
                  f"$p = New-Object System.Windows.Media.MediaPlayer; "
                  f"$p.Open([uri]'{path}'); $p.Play(); "
                  f"Start-Sleep -Milliseconds 10000; $p.Close()"
              )
              subprocess.run(["powershell", "-Command", ps_cmd],
                             capture_output=True, timeout=60)
          elif platform.system() == "Darwin":
              subprocess.run(["afplay", path], timeout=60)
          else:
              subprocess.run(["mpg123", "-q", path], timeout=60)
      except Exception as e:
          log.error(f"Воспроизведение: {e}")

  # ─── Основной цикл ───────────────────────────────────────────────────
  def run(self) -> None:
      self.listening = True
      log.info("Голосовой движок запущен")
      try:
          self.speak("ХОЗЯЙН, JARVIS запущен и готов к работе.")
      except Exception:
          pass

      while self.listening:
          try:
              if self.config.get("wakeWordEnabled", True):
                  if not self._detect_wake_word():
                      time.sleep(0.1)
                      continue
              log.info("Слушаю команду...")
              audio_path = self.record_audio(duration=8.0)
              if not audio_path:
                  continue
              text = self.transcribe(audio_path)
              try:
                  os.unlink(audio_path)
              except Exception:
                  pass
              if not text or len(text.strip()) < 2:
                  continue
              log.info(f"Команда: {text}")
              response = self.on_command(text)
              if response:
                  self.speak(response)
          except Exception as e:
              log.error(f"Ошибка цикла: {e}")
              time.sleep(1)

  def start(self) -> None:
      self._thread = threading.Thread(target=self.run, daemon=True)
      self._thread.start()

  def stop(self) -> None:
      self.listening = False
      self.interrupted = True
