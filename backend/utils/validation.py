def is_valid_gs_uri(value: str) -> bool:
	if not value.startswith("gs://"):
		return False

	without_scheme = value[len("gs://"):]
	parts = without_scheme.split("/", 1)

	if len(parts) != 2:
		return False

	bucket_name, blob_name = parts
	if not bucket_name or not blob_name:
		return False

	return True


def are_valid_subtitle_cues(cues) -> tuple[bool, str]:
	previous_end = 0.0

	for index, cue in enumerate(cues, start=1):
		if cue.end_seconds <= cue.start_seconds:
			return (
				False,
				f"Cue {index} has invalid timing: end must be greater than start.",
			)

		if cue.start_seconds < previous_end:
			return (
				False,
				f"Cue {index} overlaps with the previous cue.",
			)

		previous_end = cue.end_seconds

	return True, "ok"
