import copy
import threading
import time
from typing import Any, Dict, Optional
from uuid import uuid4


class VideoJobStore:
    """In-memory progress tracker for background video generation jobs.

    Jobs live in this process only: they are lost on restart and are not shared
    between multiple server instances.
    """

    def __init__(self, max_jobs: int = 50):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs

    def create(self) -> Dict[str, Any]:
        now = time.time()
        job = {
            "job_id": f"job_{uuid4().hex[:12]}",
            "status": "queued",
            "stage": "queued",
            "message": "Waiting to start.",
            "created_at": now,
            "updated_at": now,
            "content_id": None,
            "version": None,
            "title": None,
            "total_scenes": 0,
            "total_shots": 0,
            "completed_shots": 0,
            "face_reference_used": False,
            "scenes": [],
            "localizations": [],
            "final_video_uri": None,
            "result": None,
            "error": None,
        }

        with self._lock:
            self._jobs[job["job_id"]] = job
            self._evict_oldest_finished()
            return copy.deepcopy(job)

    def update(self, job_id: str, **fields: Any) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.update(fields)
            job["updated_at"] = time.time()

    def append_scene(self, job_id: str, scene: Dict[str, Any]) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["scenes"].append(scene)
            job["updated_at"] = time.time()

    def append_localization(self, job_id: str, localization: Dict[str, Any]) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["localizations"].append(localization)
            job["updated_at"] = time.time()

    def increment_shots(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["completed_shots"] += 1
            job["updated_at"] = time.time()

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            return copy.deepcopy(job) if job else None

    def _evict_oldest_finished(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        finished = sorted(
            (job for job in self._jobs.values() if job["status"] in ("completed", "failed")),
            key=lambda job: job["updated_at"],
        )
        for job in finished[: len(self._jobs) - self._max_jobs]:
            self._jobs.pop(job["job_id"], None)
