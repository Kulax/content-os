import time
from typing import List, Optional

from google import genai
from google.genai.types import (
    GenerateVideosConfig,
    Image,
    VideoGenerationReferenceImage,
    VideoGenerationReferenceType,
)

from backend.config import settings

# Veo 3.1 accepts up to three "asset" (subject) reference images of a single person/product.
MAX_REFERENCE_IMAGES = 3


class VideoGenerationService:
    def __init__(self):
        self.client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )

        self.model = settings.VEO_MODEL

        self.output_bucket = settings.GENERATED_VIDEOS_BUCKET

    def generate_shot_video(
        self,
        prompt: str,
        content_id: str,
        scene_number: int = 1,
        shot_number: int = 1,
        duration_seconds: int = 8,
        reference_images: Optional[List[Image]] = None,
    ) -> str:

        output_uri = (
            f"{self.output_bucket}/"
            f"{content_id}/"
            f"scene_{scene_number}/"
            f"shot_{shot_number}.mp4"
        )

        # Clamp and map duration to strictly supported Veo durations: [4, 6, 8]
        allowed_durations = [4, 6, 8]
        if duration_seconds not in allowed_durations:
            # Snap to nearest supported duration: 5 -> 4 or 6, <=4 -> 4, >=7 -> 8
            if duration_seconds <= 4:
                duration_seconds = 4
            elif duration_seconds == 5:
                duration_seconds = 4
            elif duration_seconds == 7:
                duration_seconds = 6
            else:
                duration_seconds = 8

        config = GenerateVideosConfig(
            aspect_ratio="16:9",
            number_of_videos=1,
            duration_seconds=duration_seconds,
            enhance_prompt=True,
            resolution="720p",
            person_generation="allow_adult",
            output_gcs_uri=output_uri,
            generate_audio=settings.VEO_GENERATE_AUDIO,
        )

        if reference_images:
            config.reference_images = [
                VideoGenerationReferenceImage(
                    image=image,
                    reference_type=VideoGenerationReferenceType.ASSET,
                )
                for image in reference_images[:MAX_REFERENCE_IMAGES]
            ]

        operation = self.client.models.generate_videos(
            model=self.model,
            prompt=prompt,
            config=config,
        )

        print("Veo generation started.")

        while not operation.done:
            print("Waiting for Veo...")
            time.sleep(15)
            operation = self.client.operations.get(operation)

        if getattr(operation, "error", None):
            raise RuntimeError(
                f"Veo generation failed: {operation.error}"
            )

        response = operation.response

        # Check for safety filter / empty result diagnostics
        if not response or not response.generated_videos:
            diag_info = []
            if response:
                if hasattr(response, "rai_media_filtered_reasons") and response.rai_media_filtered_reasons:
                    diag_info.append(f"Safety/RAI filter triggered: {response.rai_media_filtered_reasons}")
                if hasattr(response, "rai_media_filtered_count") and response.rai_media_filtered_count:
                    diag_info.append(f"Filtered count: {response.rai_media_filtered_count}")
            diag_str = " | ".join(diag_info) if diag_info else "Check prompt for copyrighted names, political figures, or safety triggers, and verify GCS bucket write permissions."
            raise RuntimeError(
                f"Veo completed but returned no generated video. Details: {diag_str}"
            )

        video = response.generated_videos[0].video

        if not video:
            raise RuntimeError(
                "Veo completed but the generated video object is empty."
            )

        generated_uri = video.uri

        if not generated_uri:
            raise RuntimeError(
                "Veo completed but returned no Cloud Storage URI."
            )

        print(f"Video generated successfully: {generated_uri}")

        return generated_uri

    def generate_scene_video(
        self,
        prompt: str,
        content_id: str,
        scene_number: int = 1,
        duration_seconds: int = 8,
    ) -> str:
        # Backward-compatible wrapper for single-clip scene generation.
        return self.generate_shot_video(
            prompt=prompt,
            content_id=content_id,
            scene_number=scene_number,
            shot_number=1,
            duration_seconds=duration_seconds,
        )