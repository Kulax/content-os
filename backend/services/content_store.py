import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from google.cloud import storage

from backend.models import ContentBlueprint


CONTENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,199}$")

_VERSION_DIR = re.compile(r"^v(\d+)/(.*)$")
_SCENE_FILE = re.compile(r"^scene_(\d+)/(.+)$")


def is_valid_content_id(content_id: str) -> bool:
    return bool(content_id) and bool(CONTENT_ID_PATTERN.match(content_id)) and ".." not in content_id


@dataclass
class VersionAssets:
    version: int
    has_blueprint: bool = False
    has_video_result: bool = False
    final_video_uri: Optional[str] = None
    # scene number -> best previewable video for that scene
    scene_videos: Dict[int, str] = field(default_factory=dict)
    # scene number -> composed scene video before narration/captions (used for re-voicing)
    composed_scene_videos: Dict[int, str] = field(default_factory=dict)
    updated: Optional[datetime] = None


class ContentStore:
    """Persists Content DNA versions and their rendered outputs next to the media in Cloud Storage.

    Layout: <base>/<content_id>/v<version>/blueprint.json and video.json. Media generated before
    versioning lives directly under <base>/<content_id>/ and is treated as version 1.
    """

    def __init__(self, storage_client: storage.Client, base_uri: str):
        without_scheme = base_uri[len("gs://"):].rstrip("/")
        self.bucket_name, _, self.prefix = without_scheme.partition("/")
        self.client = storage_client

    def _path(self, relative: str) -> str:
        return f"{self.prefix}/{relative}" if self.prefix else relative

    def _uri(self, blob_name: str) -> str:
        return f"gs://{self.bucket_name}/{blob_name}"

    def _bucket(self):
        return self.client.bucket(self.bucket_name)

    def save_blueprint(self, blueprint: ContentBlueprint) -> None:
        blob = self._bucket().blob(self._path(f"{blueprint.content_id}/v{blueprint.version}/blueprint.json"))
        blob.upload_from_string(blueprint.model_dump_json(indent=2), content_type="application/json")

    def save_video_result(self, content_id: str, version: int, result: Dict[str, Any]) -> None:
        payload = {key: value for key, value in result.items() if key != "blueprint"}
        blob = self._bucket().blob(self._path(f"{content_id}/v{version}/video.json"))
        blob.upload_from_string(json.dumps(payload, indent=2, default=str), content_type="application/json")

    def load_blueprint(self, content_id: str, version: int) -> Optional[ContentBlueprint]:
        blob = self._bucket().blob(self._path(f"{content_id}/v{version}/blueprint.json"))
        if not blob.exists():
            return None
        return ContentBlueprint.model_validate_json(blob.download_as_text())

    def load_video_result(self, content_id: str, version: int) -> Optional[Dict[str, Any]]:
        blob = self._bucket().blob(self._path(f"{content_id}/v{version}/video.json"))
        if not blob.exists():
            return None
        return json.loads(blob.download_as_text())

    def scan(self, content_id: str) -> Dict[int, VersionAssets]:
        """Inventory every version of a content ID from the files present in the bucket."""
        root = self._path(f"{content_id}/")
        versions: Dict[int, VersionAssets] = {}
        # Track recency per candidate so the newest file of each kind wins.
        final_updated: Dict[int, datetime] = {}
        composed_updated: Dict[tuple, datetime] = {}
        scene_rank: Dict[tuple, tuple] = {}

        for blob in self.client.list_blobs(self.bucket_name, prefix=root):
            relative = blob.name[len(root):]
            match = _VERSION_DIR.match(relative)
            if match:
                version, inner = int(match.group(1)), match.group(2)
            else:
                version, inner = 1, relative

            assets = versions.setdefault(version, VersionAssets(version=version))
            if assets.updated is None or (blob.updated and blob.updated > assets.updated):
                assets.updated = blob.updated

            if inner == "blueprint.json":
                assets.has_blueprint = True
                continue
            if inner == "video.json":
                assets.has_video_result = True
                continue
            if not inner.endswith(".mp4"):
                continue

            if inner.startswith("final/final_experience_"):
                if version not in final_updated or blob.updated > final_updated[version]:
                    final_updated[version] = blob.updated
                    assets.final_video_uri = self._uri(blob.name)
                continue

            scene_match = _SCENE_FILE.match(inner)
            if not scene_match:
                continue
            scene_number, file_part = int(scene_match.group(1)), scene_match.group(2)
            if file_part.startswith("captioned_"):
                priority = 3
            elif file_part.startswith(f"scene_{scene_number}_composed_"):
                priority = 2
            elif file_part.startswith("shot_"):
                priority = 1
            else:
                continue

            key = (version, scene_number)
            if priority == 2 and (key not in composed_updated or blob.updated > composed_updated[key]):
                composed_updated[key] = blob.updated
                assets.composed_scene_videos[scene_number] = self._uri(blob.name)

            rank = (priority, blob.updated)
            if key not in scene_rank or rank > scene_rank[key]:
                scene_rank[key] = rank
                assets.scene_videos[scene_number] = self._uri(blob.name)

        return versions

    def list_content(self) -> List[Dict[str, Any]]:
        """Top-level content IDs in the output bucket (newest first)."""
        root = self._path("")
        iterator = self.client.list_blobs(self.bucket_name, prefix=root, delimiter="/")
        list(iterator)  # consume pages so prefixes are populated
        content_ids = []
        for prefix in iterator.prefixes:
            content_id = prefix[len(root):].strip("/")
            if content_id and content_id != "personas" and is_valid_content_id(content_id):
                content_ids.append(content_id)
        return [{"content_id": content_id} for content_id in sorted(content_ids)]
