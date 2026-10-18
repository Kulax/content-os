import io
import re
import wave
from uuid import uuid4

from google.api_core import exceptions as google_exceptions
from google.api_core.retry import Retry, if_exception_type
from google.cloud import storage, texttospeech

from backend.config import settings


# Proxies and flaky networks occasionally drop gRPC connections; retry those briefly.
TRANSIENT_RETRY = Retry(
    predicate=if_exception_type(
        google_exceptions.ServiceUnavailable,
        google_exceptions.DeadlineExceeded,
        google_exceptions.InternalServerError,
    ),
    initial=1.0,
    maximum=8.0,
    multiplier=2.0,
    timeout=60.0,
)


LANGUAGE_CODE_MAP = {
    "english": "en-US",
    "en": "en-US",
    "spanish": "es-ES",
    "es": "es-ES",
    "french": "fr-FR",
    "fr": "fr-FR",
    "german": "de-DE",
    "de": "de-DE",
    "hindi": "hi-IN",
    "hi": "hi-IN",
    "japanese": "ja-JP",
    "ja": "ja-JP",
    "mandarin": "cmn-CN",
    "chinese": "cmn-CN",
    "zh": "cmn-CN",
    "portuguese": "pt-BR",
    "pt": "pt-BR",
    "arabic": "ar-XA",
    "ar": "ar-XA",
    "korean": "ko-KR",
    "ko": "ko-KR",
    "italian": "it-IT",
    "it": "it-IT",
}


def resolve_language_code(lang_input: str) -> str:
    cleaned = (lang_input or "en-US").strip().lower()
    if "-" in cleaned and len(cleaned) <= 10:
        return lang_input.strip()
    return LANGUAGE_CODE_MAP.get(cleaned, "en-US")


def known_language_code(lang_input: str) -> str | None:
    """Like resolve_language_code, but None for unknown languages instead of silently using English."""
    cleaned = (lang_input or "").strip()
    if re.fullmatch(r"[a-zA-Z]{2,3}-[a-zA-Z]{2,4}", cleaned):
        return cleaned
    return LANGUAGE_CODE_MAP.get(cleaned.lower())


GENDER_FEMALE = "female"
GENDER_MALE = "male"

# Higher-quality voice families first.
_VOICE_FAMILY_PREFERENCE = ("Chirp3-HD", "Chirp-HD", "Neural2", "Wavenet", "Standard")
# Within Chirp3-HD, pick well-suited narrator voices first (names are shared across languages).
_PREFERRED_VOICE_NAMES = {
    GENDER_MALE: ("Charon", "Fenrir", "Orus", "Puck", "Iapetus"),
    GENDER_FEMALE: ("Achernar", "Kore", "Aoede", "Leda", "Zephyr"),
}

_FEMALE_WORDS = re.compile(r"\b(female|feminine|woman|women|girl|lady|she|her)\b")
_MALE_WORDS = re.compile(r"\b(male|masculine|man|men|boy|guy|gentleman|baritone|bass|he|his)\b")


def normalize_voice_gender(value: str | None) -> str | None:
    cleaned = (value or "").strip().lower()
    if cleaned in (GENDER_MALE, "masculine", "man"):
        return GENDER_MALE
    if cleaned in (GENDER_FEMALE, "feminine", "woman"):
        return GENDER_FEMALE
    return None


def infer_voice_gender(*descriptions: str | None) -> str | None:
    """Best-effort voice gender from free text like 'Masculine, clear, emphatically angry'."""
    for description in descriptions:
        text = (description or "").lower()
        is_female = bool(_FEMALE_WORDS.search(text))
        is_male = bool(_MALE_WORDS.search(text))
        if is_female != is_male:
            return GENDER_FEMALE if is_female else GENDER_MALE
    return None


class NarrationService:
    """Generates narration audio and stores it in Cloud Storage."""

    def __init__(self):
        self.tts_client = texttospeech.TextToSpeechClient()
        self.storage_client = storage.Client(project=settings.GOOGLE_CLOUD_PROJECT)
        self._voice_cache: dict[str, list[tuple[str, str]]] = {}

    def _voices_for(self, language_code: str) -> list[tuple[str, str]]:
        if language_code not in self._voice_cache:
            voices = self.tts_client.list_voices(language_code=language_code, retry=TRANSIENT_RETRY).voices
            self._voice_cache[language_code] = [
                (voice.name, texttospeech.SsmlVoiceGender(voice.ssml_gender).name.lower())
                for voice in voices
                if language_code in voice.language_codes
            ]
        return self._voice_cache[language_code]

    def select_voice(self, language_code: str, gender: str | None) -> str | None:
        """Pick a voice name for the language, honouring the requested gender when given."""
        default_name = settings.TTS_VOICE_NAME if settings.TTS_VOICE_NAME.startswith(f"{language_code}-") else None
        gender = normalize_voice_gender(gender)
        if gender is None:
            if default_name:
                return default_name
            # Same narrator in another language: e.g. en-US-Chirp3-HD-Achernar -> hi-IN-Chirp3-HD-Achernar.
            candidate = f"{language_code}-{settings.TTS_VOICE_NAME.split('-', 2)[-1]}"
            try:
                return candidate if any(name == candidate for name, _ in self._voices_for(language_code)) else None
            except Exception:
                return None

        try:
            voices = self._voices_for(language_code)
        except Exception:
            return None  # synthesize_speech falls back to ssml_gender selection

        matching = [name for name, voice_gender in voices if voice_gender == gender]
        if not matching:
            return None
        if default_name in matching:
            return default_name

        def rank(name: str) -> tuple[int, int, str]:
            family = next((i for i, f in enumerate(_VOICE_FAMILY_PREFERENCE) if f"-{f}-" in name), len(_VOICE_FAMILY_PREFERENCE))
            preferred = _PREFERRED_VOICE_NAMES[gender]
            short_name = name.rsplit("-", 1)[-1]
            return family, preferred.index(short_name) if short_name in preferred else len(preferred), name

        return min(matching, key=rank)

    def generate_audio(
        self,
        content_id: str,
        text: str,
        language_code: str,
        voice_name: str | None = None,
        speaking_rate: float | None = None,
        scene_number: int = 1,
        voice_gender: str | None = None,
    ) -> str:
        audio_uri, _, _ = self.generate_audio_with_duration(
            content_id=content_id,
            text=text,
            language_code=language_code,
            voice_name=voice_name,
            speaking_rate=speaking_rate,
            scene_number=scene_number,
            voice_gender=voice_gender,
        )
        return audio_uri

    def generate_audio_with_duration(
        self,
        content_id: str,
        text: str,
        language_code: str,
        voice_name: str | None = None,
        speaking_rate: float | None = None,
        scene_number: int = 1,
        voice_gender: str | None = None,
    ) -> tuple[str, float | None, str | None]:
        """Returns (audio gs:// URI, duration in seconds, voice name used)."""
        resolved_code = resolve_language_code(language_code)
        gender = normalize_voice_gender(voice_gender)
        selected_voice_name = voice_name or self.select_voice(resolved_code, gender)
        selected_speaking_rate = speaking_rate or settings.TTS_SPEAKING_RATE

        synthesis_input = texttospeech.SynthesisInput(text=text)

        voice_params = {"language_code": resolved_code}
        if selected_voice_name:
            voice_params["name"] = selected_voice_name
        elif gender:
            voice_params["ssml_gender"] = (
                texttospeech.SsmlVoiceGender.MALE if gender == GENDER_MALE else texttospeech.SsmlVoiceGender.FEMALE
            )

        voice = texttospeech.VoiceSelectionParams(**voice_params)

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,
            speaking_rate=selected_speaking_rate,
        )

        response = self.tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
            retry=TRANSIENT_RETRY,
        )

        if not response.audio_content:
            raise RuntimeError("TTS returned empty audio content.")

        destination_uri = (
            f"{settings.GENERATED_VIDEOS_BUCKET}/"
            f"{content_id}/scene_{scene_number}/"
            f"narration_{uuid4().hex[:8]}.wav"
        )

        self._upload_audio_bytes(
            audio_bytes=response.audio_content,
            gs_uri=destination_uri,
        )

        return destination_uri, self._wav_duration_seconds(response.audio_content), selected_voice_name

    @staticmethod
    def _wav_duration_seconds(audio_bytes: bytes) -> float | None:
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
                frame_rate = wav_file.getframerate()
                if not frame_rate:
                    return None
                return wav_file.getnframes() / float(frame_rate)
        except (wave.Error, EOFError):
            return None

    def _upload_audio_bytes(self, audio_bytes: bytes, gs_uri: str) -> None:
        bucket_name, blob_name = self._parse_gs_uri(gs_uri)
        bucket = self.storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(audio_bytes, content_type="audio/wav")

    def _parse_gs_uri(self, gs_uri: str) -> tuple[str, str]:
        if not gs_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI: {gs_uri}")

        path_without_scheme = gs_uri[len("gs://"):]
        parts = path_without_scheme.split("/", 1)

        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise ValueError(f"Invalid GCS URI: {gs_uri}")

        return parts[0], parts[1]
