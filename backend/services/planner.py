from typing import List

from backend.models import Scene, Shot


class ExperiencePlannerService:
    """Plans Veo-compatible shots from semantic scene durations."""

    _ALLOWED_DURATIONS = (4, 6, 8)
    # Veo reference-to-video (face/subject reference images) only supports 8-second clips.
    REFERENCE_IMAGE_DURATIONS = (8,)

    def plan_scene(self, scene: Scene, allowed_durations: tuple[int, ...] | None = None) -> List[Shot]:
        target_seconds = max(scene.duration_seconds, 4)
        shot_durations = self._decompose_duration(target_seconds, allowed_durations or self._ALLOWED_DURATIONS)

        shots: List[Shot] = []
        for index, duration in enumerate(shot_durations, start=1):
            shots.append(
                Shot(
                    shot_number=index,
                    duration_seconds=duration,
                    purpose=self._build_shot_purpose(scene=scene, shot_number=index, total_shots=len(shot_durations)),
                    visual_action=self._build_shot_visual_action(scene=scene, shot_number=index, total_shots=len(shot_durations)),
                    camera_direction=self._camera_for_position(index=index, total=len(shot_durations)),
                    motion=self._motion_for_position(index=index, total=len(shot_durations)),
                    continuity_requirements=(
                        "Maintain consistent character identity, environment lighting, color palette, "
                        "and narrative continuity from the previous shot."
                    ),
                    generation_method="veo",
                )
            )

        return shots

    def _decompose_duration(self, target_seconds: int, allowed: tuple[int, ...]) -> List[int]:
        """Create a near-minimal shot plan using only the allowed clip lengths."""
        shortest = min(allowed)
        longest = max(allowed)
        if target_seconds <= shortest:
            return [shortest]

        # Prefer exact matches first (dynamic programming by reachable sums).
        limit = target_seconds + longest
        best = {0: []}

        for total in range(1, limit + 1):
            candidates = []
            for d in allowed:
                previous = total - d
                if previous in best:
                    candidates.append(best[previous] + [d])

            if candidates:
                best[total] = min(candidates, key=lambda c: (len(c), abs(sum(c) - target_seconds)))

        valid_totals = [t for t in best.keys() if t >= target_seconds]

        if valid_totals:
            chosen_total = min(valid_totals, key=lambda t: (t - target_seconds, len(best[t])))
            return best[chosen_total]

        # Fallback should be rare, but guarantees a valid output.
        durations: List[int] = []
        remaining = target_seconds
        while remaining > 8:
            durations.append(8)
            remaining -= 8

        if remaining <= 4:
            durations.append(4)
        elif remaining <= 6:
            durations.append(6)
        else:
            durations.append(8)

        return durations

    def _build_shot_purpose(self, scene: Scene, shot_number: int, total_shots: int) -> str:
        if total_shots == 1:
            return f"Deliver the full narrative intent of scene {scene.scene_number}: {scene.purpose}."

        if shot_number == 1:
            return f"Establish scene {scene.scene_number} context: {scene.title}."

        if shot_number == total_shots:
            return f"Conclude scene {scene.scene_number} with the key takeaway: {scene.purpose}."

        return f"Develop scene {scene.scene_number} progression and reinforce the core explanation."

    def _build_shot_visual_action(self, scene: Scene, shot_number: int, total_shots: int) -> str:
        """Constructs a progressive, chronological visual beat so shots flow sequentially rather than repeating."""
        base_desc = scene.visual_description.strip()

        if total_shots == 1:
            return f"Full scene action: {base_desc}"

        if shot_number == 1:
            return (
                f"Opening Establishing Beat: Initial visual state of Scene {scene.scene_number}. "
                f"Introduce the environment and main subject. Setting the stage: {base_desc}"
            )

        if shot_number == 2 and total_shots > 2:
            return (
                f"Developing Action Beat: Progressive movement and interaction. The subject moves deeper "
                f"into action, demonstrating or activating the core concept. Context: {scene.purpose}"
            )

        if shot_number == total_shots:
            return (
                f"Climactic / Resolving Beat: Final reveal and conclusion of Scene {scene.scene_number}. "
                f"Showing the impact, transformation, or final outcome. Resolving: {scene.purpose}"
            )

        return (
            f"Intermediate Action Beat (Shot {shot_number} of {total_shots}): Transitioning and expanding the action. "
            f"Dynamic interaction showing: {scene.purpose}"
        )

    def _camera_for_position(self, index: int, total: int) -> str:
        if index == 1:
            return "Cinematic establishing frame with a gentle push-in."
        if index == total:
            return "Intentional hold or slight pull-back to land the conclusion."
        return "Controlled medium movement to maintain narrative continuity."

    def _motion_for_position(self, index: int, total: int) -> str:
        if index == 1:
            return "Slow and stable motion to orient the viewer."
        if index == total:
            return "Subtle deceleration to emphasize scene closure."
        return "Smooth, coherent motion aligned to the scene explanation."
