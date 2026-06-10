"""
JARVIS Voice Engine — Русский голосовой движок
Всегда активен в фоне: Wake word → STT (Whisper, русский) → AI → TTS (русский)
Не требует нажатий — работает полностью голосом.
"""

import os
import time
import wave
import queue
import struct
import logging
import threading
import tempfile
from pathlib import Path
from typing import Optional, Callable

log = logging.getLogger("jarvis.voice")

JARVIS_DIR = Path.home() / ".jarvis"


class VoiceEngine:
    """
    Локальный голосовой пайплайн (полностью офлайн):
    Wake Word → STT → AI → TTS
    Запускается в фоне и всегда слушает.
    """

    def __init__(self, config: dict, on_command: Callable[[str], str]):
        self.config = config
        self.on_command = on_command
        self.listening = False
        self.interrupted = False
        self._thread: Optional[threading.Thread] = None
        self._whisper_model = None  # cached model

    # ─── Wake Word (VAD fallback — без ключа) ─────────────────────────
    def _detect_wake_word_vad(self) -> bool:
        """
        Voice Activity Detection без ключа Porcupine.
        Ждёт звука выше порога — активирует запись.
        """
        try:
            import pyaudio
            import numpy as np

            pa = pyaudio.PyAudio()
            CHUNK = 1024
            RATE = 16000
            THRESHOLD = 800  # RMS энергия для активации

            stream = pa.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK,
            )

            log.info("JARVIS слушает (VAD режим)...")
            silence_count = 0

            while not self.interrupted:
                data = stream.read(CHUNK, exception_on_overflow=False)
                audio_data = np.frombuffer(data, dtype=np.int16)
                rms = np.sqrt(np.mean(audio_data.astype(np.float32)**2))

                if rms > THRESHOLD:
                    silence_count = 0
                    stream.stop_stream()
                    stream.close()
                    pa.terminate()
                    return True

            stream.stop_stream()
            stream.close()
            pa.terminate()
        except ImportError:
            log.warning("pyaudio/numpy не установлены — голосовое управление недоступно")
            time.sleep(5)
        except Exception as e:
            log.error(f"VAD ошибка: {e}")
            time.sleep(1)
        return False

    def _detect_wake_word_porcupine(self) -> bool:
        """Wake word через Porcupine (требует ключ picovoice)."""
        try:
            import pvporcupine
            import pyaudio

            access_key = self.config.get("porcupineKey", "")
            if not access_key:
                return False

            porcupine = pvporcupine.create(access_key=access_key, keywords=["jarvis"])
            pa = pyaudio.PyAudio()
            stream = pa.open(
                rate=porcupine.sample_rate,
                channels=1,
                format=pyaudio.paInt16,
                input=True,
                frames_per_buffer=porcupine.frame_length,
            )

            log.info("Ожидание слова 'Джарвис'...")
            while not self.interrupted:
                pcm = stream.read(porcupine.frame_length, exception_on_overflow=False)
                pcm = struct.unpack_from("h" * porcupine.frame_length, pcm)
                if porcupine.process(pcm) >= 0:
                    log.info("Активационное слово обнаружено!")
                    stream.stop_stream()
                    stream.close()
                    pa.terminate()
                    porcupine.delete()
                    return True

        except ImportError:
            pass
        except Exception as e:
            log.error(f"Porcupine ошибка: {e}")
        return False

    def _detect_wake_word(self) -> bool:
        """Попытка Porcupine → fallback на VAD."""
        if self.config.get("porcupineKey"):
            result = self._detect_wake_word_porcupine()
            if result:
                return True
        return self._detect_wake_word_vad()

    # ─── STT (Whisper, русский) ───────────────────────────────────────
    def transcribe(self, audio_path: str) -> str:
        """Распознавание речи через Whisper (локально, русский язык)."""
        try:
            import whisper

            if self._whisper_model is None:
                model_name = self.config.get("whisperModel", "small")
                log.info(f"Загрузка Whisper модели '{model_name}'...")
                self._whisper_model = whisper.load_model(model_name)

            result = self._whisper_model.transcribe(
                audio_path,
                language="ru",  # Русский язык
                task="transcribe",
                fp16=False,
                initial_prompt="Команды на русском языке для голосового ассистента JARVIS.",
            )
            text = result["text"].strip()
            log.info(f"Распознано: {text}")
            return text
        except ImportError:
            log.error("Whisper не установлен: pip install openai-whisper")
        except Exception as e:
            log.error(f"STT ошибка: {e}")
        return ""

    # ─── Recording ────────────────────────────────────────────────────
    def record_audio(self, duration: float = 6.0) -> Optional[str]:
        """Запись с микрофона с автоопределением конца речи."""
        try:
            import pyaudio
            import numpy as np

            pa = pyaudio.PyAudio()
            sample_rate = 16000
            chunk = 1024
            silence_threshold = 500
            max_silence_chunks = int(sample_rate / chunk * 1.5)  # 1.5 сек тишины

            stream = pa.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=sample_rate,
                input=True,
                frames_per_buffer=chunk,
            )

            log.info("Запись команды...")
            frames = []
            silence_count = 0
            max_chunks = int(sample_rate / chunk * duration)

            for _ in range(max_chunks):
                data = stream.read(chunk, exception_on_overflow=False)
                frames.append(data)
                audio_data = np.frombuffer(data, dtype=np.int16)
                rms = np.sqrt(np.mean(audio_data.astype(np.float32)**2))
                if rms < silence_threshold:
                    silence_count += 1
                    if silence_count > max_silence_chunks:
                        break
                else:
                    silence_count = 0

            stream.stop_stream()
            stream.close()
            pa.terminate()

            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            with wave.open(tmp.name, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
                wf.setframerate(sample_rate)
                wf.writeframes(b"".join(frames))

            return tmp.name
        except ImportError:
            log.error("pyaudio не установлен: pip install pyaudio")
        except Exception as e:
            log.error(f"Ошибка записи: {e}")
        return None

    # ─── TTS (Русский) ────────────────────────────────────────────────
    def speak(self, text: str, emotion_intensity: float = 0.7):
        """Синтез речи на русском языке."""
        # Попытка Piper
        piper_ok = self._speak_piper(text)
        if not piper_ok:
            self._speak_system(text)

    def _speak_piper(self, text: str) -> bool:
        """Piper TTS с русской моделью."""
        try:
            piper_path = self.config.get("piperPath", "piper")
            # Русская модель Piper
            default_model = str(JARVIS_DIR / "voices" / "ru_RU-ruslan-medium.onnx")
            model_path = self.config.get("piperModel", default_model)

            if not Path(model_path).exists():
                return False

            tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            proc = subprocess.run(
                [piper_path, "--model", model_path, "--output_file", tmp_wav.name],
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=30,
            )
            if proc.returncode == 0:
                self._play_audio(tmp_wav.name)
                try:
                    os.unlink(tmp_wav.name)
                except Exception:
                    pass
                return True
        except Exception:
            pass
        return False

    def _speak_system(self, text: str):
        """Системный TTS с русским голосом."""
        try:
            if platform.system() == "Windows":
                import pyttsx3
                engine = pyttsx3.init()
                voices = engine.getProperty("voices")
                # Ищем русский голос
                ru_voice = None
                for v in (voices or []):
                    if "russian" in v.name.lower() or "ru" in v.id.lower():
                        ru_voice = v.id
                        break
                if ru_voice:
                    engine.setProperty("voice", ru_voice)
                engine.setProperty("rate", 165)
                engine.setProperty("volume", 0.9)
                engine.say(text)
                engine.runAndWait()
            elif platform.system() == "Darwin":
                import subprocess as sp
                sp.run(["say", "-v", "Yuri", text])
            else:
                import subprocess as sp
                sp.run(["espeak", "-v", "ru", "-s", "150", text])
        except Exception as e:
            log.error(f"TTS ошибка: {e}")

    def _play_audio(self, path: str):
        import platform as _pl
        try:
            if _pl.system() == "Windows":
                import winsound
                winsound.PlaySound(path, winsound.SND_FILENAME)
            elif _pl.system() == "Darwin":
                import subprocess as sp
                sp.run(["afplay", path])
            else:
                import subprocess as sp
                sp.run(["aplay", path])
        except Exception as e:
            log.error(f"Ошибка воспроизведения: {e}")

    # ─── Voice Cloning (Chatterbox) ───────────────────────────────────
    def clone_voice(self, sample_path: str, text: str) -> Optional[str]:
        """Клонирование голоса из 3-10 секунд аудио."""
        try:
            from chatterbox.tts import ChatterboxTTS
            model = ChatterboxTTS.from_pretrained(device="cpu")
            wav = model.generate(text, audio_prompt_path=sample_path)
            out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            import torchaudio
            torchaudio.save(out.name, wav, model.sr)
            return out.name
        except ImportError:
            log.warning("Клонирование голоса недоступно: pip install chatterbox-tts")
        except Exception as e:
            log.error(f"Ошибка клонирования: {e}")
        return None

    # ─── Main Loop ────────────────────────────────────────────────────
    def run(self):
        """Основной цикл голосового ассистента — всегда активен в фоне."""
        self.listening = True
        log.info("Голосовой движок запущен — JARVIS слушает")

        # Приветствие при запуске
        try:
            self.speak("JARVIS запущен и готов к работе.")
        except Exception:
            pass

        while self.listening:
            try:
                if self.config.get("wakeWordEnabled", True):
                    detected = self._detect_wake_word()
                    if not detected:
                        time.sleep(0.1)
                        continue

                # Сигнал обнаружения
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
                log.error(f"Ошибка голосового цикла: {e}")
                time.sleep(1)

    def start(self):
        """Запуск в фоновом потоке."""
        self._thread = threading.Thread(target=self.run, daemon=True, name="JarvisVoice")
        self._thread.start()
        log.info("Голосовой движок запущен в фоне")

    def stop(self):
        self.listening = False
        self.interrupted = True
        log.info("Голосовой движок остановлен")


import subprocess
import platform
