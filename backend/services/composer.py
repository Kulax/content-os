import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from google.cloud import storage

from backend.config import settings


# Guard against ffmpeg hangs blocking a request forever.
FFMPEG_TIMEOUT_SECONDS = 600

# Burned-in caption style: white bold text, black outline, bottom-centre. Fonts without the needed
# glyphs (e.g. Devanagari, CJK) fall back through fontconfig to an installed font that has them.
CAPTION_PLAY_RES = (384, 288)
CAPTION_ASS_STYLE = (
    "Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,"
    "-1,0,0,0,100,100,0,0,1,1.5,0.5,2,10,10,22,1"
)


class CompositionService:
    """Composes shot-level video assets into scene-level outputs."""

    def __init__(self):
        self.storage_client = storage.Client(project=settings.GOOGLE_CLOUD_PROJECT)
        self.ffmpeg_bin = self._resolve_ffmpeg_binary()

    @staticmethod
    def _resolve_ffmpeg_binary() -> Optional[str]:
        # 1. Check if configured binary exists in system PATH
        configured = settings.FFMPEG_BINARY
        if configured and shutil.which(configured):
            return shutil.which(configured)

        # 2. Check if default 'ffmpeg' is in PATH
        if shutil.which("ffmpeg"):
            return shutil.which("ffmpeg")

        # 3. Automatic fallback to Python-managed static binary
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if exe and Path(exe).exists():
                return exe
        except Exception:
            pass

        return None

    def compose_scene(
        self,
        content_id: str,
        scene_number: int,
        shot_uris: List[str],
    ) -> Optional[str]:
        if not shot_uris:
            return None

        if not self.ffmpeg_bin or not Path(self.ffmpeg_bin).exists():
            return None

        with tempfile.TemporaryDirectory(prefix="content-os-compose-") as temp_dir:
            temp_path = Path(temp_dir)
            local_shots: List[Path] = []

            for index, shot_uri in enumerate(shot_uris, start=1):
                shot_path = temp_path / f"shot_{index}.mp4"
                self._download_gcs_file(shot_uri, shot_path)
                local_shots.append(shot_path)

            concat_file = temp_path / "concat.txt"
            concat_lines = [f"file '{path.as_posix()}'" for path in local_shots]
            concat_file.write_text("\n".join(concat_lines), encoding="utf-8")

            composed_local_path = temp_path / "scene_composed.mp4"
            self._concat_videos(concat_file=concat_file, output_path=composed_local_path)

            destination_uri = (
                f"{settings.GENERATED_VIDEOS_BUCKET}/"
                f"{content_id}/scene_{scene_number}/"
                f"scene_{scene_number}_composed_{uuid4().hex[:8]}.mp4"
            )

            self._upload_gcs_file(composed_local_path, destination_uri)
            return destination_uri

    def compose_experience(
        self,
        content_id: str,
        scene_uris: List[str],
    ) -> Optional[str]:
        if not scene_uris:
            return None

        if not self.ffmpeg_bin:
            return None

        with tempfile.TemporaryDirectory(prefix="content-os-render-") as temp_dir:
            temp_path = Path(temp_dir)
            local_scenes: List[Path] = []

            for index, scene_uri in enumerate(scene_uris, start=1):
                scene_path = temp_path / f"scene_{index}.mp4"
                self._download_gcs_file(scene_uri, scene_path)
                local_scenes.append(scene_path)

            concat_file = temp_path / "scenes_concat.txt"
            concat_lines = [f"file '{path.as_posix()}'" for path in local_scenes]
            concat_file.write_text("\n".join(concat_lines), encoding="utf-8")

            final_local_path = temp_path / "final_experience.mp4"
            self._concat_videos(concat_file=concat_file, output_path=final_local_path)

            destination_uri = (
                f"{settings.GENERATED_VIDEOS_BUCKET}/"
                f"{content_id}/final/"
                f"final_experience_{uuid4().hex[:8]}.mp4"
            )

            self._upload_gcs_file(final_local_path, destination_uri)
            return destination_uri

    def merge_narration_audio(
        self,
        content_id: str,
        video_uri: str,
        audio_uri: str,
    ) -> Optional[str]:
        if not self.ffmpeg_bin:
            return None

        with tempfile.TemporaryDirectory(prefix="content-os-mux-") as temp_dir:
            temp_path = Path(temp_dir)
            local_video = temp_path / "video.mp4"
            local_audio = temp_path / "audio.wav"

            self._download_gcs_file(video_uri, local_video)
            self._download_gcs_file(audio_uri, local_audio)

            output_video = temp_path / "final_with_narration.mp4"
            self._mux_audio(video_path=local_video, audio_path=local_audio, output_path=output_video)

            destination_uri = (
                f"{settings.GENERATED_VIDEOS_BUCKET}/"
                f"{content_id}/final/"
                f"final_with_narration_{uuid4().hex[:8]}.mp4"
            )

            self._upload_gcs_file(output_video, destination_uri)
            return destination_uri

    def burn_captions(
        self,
        content_id: str,
        video_uri: str,
        cues,
        scene_number: Optional[int] = None,
    ) -> Optional[str]:
        if not cues or not self.ffmpeg_bin:
            return None

        with tempfile.TemporaryDirectory(prefix="content-os-captions-") as temp_dir:
            temp_path = Path(temp_dir)
            local_video = temp_path / "input.mp4"
            self._download_gcs_file(video_uri, local_video)

            (temp_path / "captions.ass").write_text(self._build_ass(cues), encoding="utf-8")

            output_video = temp_path / "captioned.mp4"
            self._burn_subtitles(
                work_dir=temp_path,
                video_name=local_video.name,
                ass_name="captions.ass",
                output_name=output_video.name,
            )

            folder = f"scene_{scene_number}" if scene_number else "final"
            destination_uri = (
                f"{settings.GENERATED_VIDEOS_BUCKET}/"
                f"{content_id}/{folder}/"
                f"captioned_{uuid4().hex[:8]}.mp4"
            )

            self._upload_gcs_file(output_video, destination_uri)
            return destination_uri

    def create_subtitle_file(
        self,
        content_id: str,
        cues,
    ) -> str:
        srt_content = self._build_srt(cues)

        with tempfile.TemporaryDirectory(prefix="content-os-srt-") as temp_dir:
            temp_path = Path(temp_dir)
            srt_path = temp_path / "subtitles.srt"
            srt_path.write_text(srt_content, encoding="utf-8")

            destination_uri = (
                f"{settings.GENERATED_VIDEOS_BUCKET}/"
                f"{content_id}/final/"
                f"subtitles_{uuid4().hex[:8]}.srt"
            )

            self._upload_gcs_file(
                local_path=srt_path,
                gs_uri=destination_uri,
                content_type="application/x-subrip",
            )

            return destination_uri

    def upload_file(self, local_path: Path, gs_uri: str, content_type: str) -> None:
        self._upload_gcs_file(local_path, gs_uri, content_type=content_type)

    def _download_gcs_file(self, gs_uri: str, local_path: Path) -> None:
        bucket_name, blob_name = self._parse_gs_uri(gs_uri)
        bucket = self.storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.download_to_filename(str(local_path))

    def _upload_gcs_file(self, local_path: Path, gs_uri: str, content_type: str = "video/mp4") -> None:
        bucket_name, blob_name = self._parse_gs_uri(gs_uri)
        bucket = self.storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(str(local_path), content_type=content_type)

    def _concat_videos(self, concat_file: Path, output_path: Path) -> None:
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-c",
            "copy",
            str(output_path),
        ]

        completed = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )

        if completed.returncode != 0:
            raise RuntimeError(
                "FFmpeg composition failed. "
                f"stderr: {completed.stderr.strip()}"
            )

    def _mux_audio(self, video_path: Path, audio_path: Path, output_path: Path) -> None:
        # Veo clips carry their own soundtrack; map streams explicitly so the narration
        # replaces it. Pad the narration and cap at the video length so short narration
        # doesn't truncate the video ("apad" + "-shortest" never terminates with stream copy).
        video_duration = self.probe_duration(video_path)
        if video_duration:
            length_args = ["-af", "apad", "-t", f"{video_duration:.3f}"]
        else:
            length_args = ["-shortest"]

        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(audio_path),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            *length_args,
            str(output_path),
        ]

        completed = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )

        if completed.returncode != 0:
            raise RuntimeError(
                "FFmpeg audio mux failed. "
                f"stderr: {completed.stderr.strip()}"
            )

    def probe_duration(self, media_path: Path) -> Optional[float]:
        if not self.ffmpeg_bin:
            return None
        completed = subprocess.run(
            [self.ffmpeg_bin, "-hide_banner", "-i", str(media_path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", completed.stderr)
        if not match:
            return None
        hours, minutes, seconds = match.groups()
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)

    def _burn_subtitles(self, work_dir: Path, video_name: str, ass_name: str, output_name: str) -> None:
        # Run inside work_dir with relative names: the subtitle filters need heavy escaping
        # for absolute paths (especially Windows drive letters). Complex shaping (HarfBuzz) is
        # required for scripts like Devanagari, where vowel signs reorder and letters join.
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-i",
            video_name,
            "-vf",
            f"ass={ass_name}:shaping=complex",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
            output_name,
        ]

        completed = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            cwd=str(work_dir),
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )

        if completed.returncode != 0:
            raise RuntimeError(
                "FFmpeg caption burn-in failed. "
                f"stderr: {completed.stderr.strip()[-1500:]}"
            )

    def _build_ass(self, cues) -> str:
        lines = [
            "[Script Info]",
            "ScriptType: v4.00+",
            # Same coordinate space libass uses for SRT, so sizes match the original caption look.
            f"PlayResX: {CAPTION_PLAY_RES[0]}",
            f"PlayResY: {CAPTION_PLAY_RES[1]}",
            "WrapStyle: 0",
            "ScaledBorderAndShadow: yes",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
            "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            f"Style: {CAPTION_ASS_STYLE}",
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ]
        for cue in cues:
            # Braces start ASS override blocks and backslashes start ASS escapes.
            text = (
                cue.text.strip()
                .replace("\\", "/")
                .replace("{", "(")
                .replace("}", ")")
                .replace("\r\n", "\n")
                .replace("\n", "\\N")
            )
            lines.append(
                f"Dialogue: 0,{self._to_ass_timestamp(cue.start_seconds)},"
                f"{self._to_ass_timestamp(cue.end_seconds)},Default,,0,0,0,,{text}"
            )
        return "\n".join(lines) + "\n"

    @staticmethod
    def _to_ass_timestamp(seconds: float) -> str:
        total_cs = int(round(seconds * 100))
        hours, remainder = divmod(total_cs, 360_000)
        minutes, remainder = divmod(remainder, 6_000)
        secs, centis = divmod(remainder, 100)
        return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"

    def _build_srt(self, cues) -> str:
        lines: List[str] = []
        for index, cue in enumerate(cues, start=1):
            lines.append(str(index))
            lines.append(
                f"{self._to_srt_timestamp(cue.start_seconds)} --> {self._to_srt_timestamp(cue.end_seconds)}"
            )
            lines.append(cue.text.strip())
            lines.append("")

        return "\n".join(lines)

    def _to_srt_timestamp(self, seconds: float) -> str:
        total_ms = int(round(seconds * 1000))
        hours = total_ms // 3_600_000
        total_ms -= hours * 3_600_000
        minutes = total_ms // 60_000
        total_ms -= minutes * 60_000
        secs = total_ms // 1000
        millis = total_ms - secs * 1000

        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _parse_gs_uri(self, gs_uri: str) -> tuple[str, str]:
        if not gs_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI: {gs_uri}")

        path_without_scheme = gs_uri[len("gs://"):]
        parts = path_without_scheme.split("/", 1)

        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise ValueError(f"Invalid GCS URI: {gs_uri}")

        return parts[0], parts[1]
