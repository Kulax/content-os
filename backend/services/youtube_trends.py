from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from backend.config import settings
from backend.services.narration import known_language_code


CATEGORY_NAME_TO_ID = {
    "film": "1",
    "autos": "2",
    "music": "10",
    "pets": "15",
    "sports": "17",
    "short_movies": "18",
    "travel": "19",
    "gaming": "20",
    "vlogs": "21",
    "people": "22",
    "comedy": "23",
    "entertainment": "24",
    "news": "25",
    "howto": "26",
    "education": "27",
    "science": "28",
    "technology": "28",
    "nonprofits": "29",
}


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class YouTubeTrendsService:
    def __init__(self):
        self.api_key = settings.YOUTUBE_API_KEY
        self.base_url = settings.YOUTUBE_API_BASE.rstrip("/")

    def resolve_category(self, category: str, category_id: str | None) -> tuple[str, str]:
        if category_id:
            return (category or "custom").strip().lower(), category_id.strip()

        normalized = (category or "entertainment").strip().lower().replace(" ", "_")
        resolved_id = CATEGORY_NAME_TO_ID.get(normalized)
        if not resolved_id:
            raise ValueError(
                "Unsupported category. Use one of: " + ", ".join(sorted(CATEGORY_NAME_TO_ID)) + "."
            )

        return normalized, resolved_id

    def fetch_trending(
        self,
        category_id: str,
        region_code: str,
        max_results: int,
        topic: str | None = None,
        language: str | None = None,
    ) -> tuple[list[dict[str, Any]], str]:
        """Trending videos for a category/region, plus a short note describing the source used.

        YouTube has no "most popular" chart for some categories (e.g. Education, Travel & Events) and
        answers 404. Those fall back to the most-viewed recent uploads in that category and region.
        """
        if not self.api_key:
            raise RuntimeError("YOUTUBE_API_KEY is not configured.")

        response = self._get("videos", {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "videoCategoryId": category_id,
            "regionCode": region_code,
            "maxResults": max_results,
        })

        if response.status_code == 200:
            results = [self._to_video(item, item.get("id", "")) for item in response.json().get("items", [])]
            results = [video for video in results if video]
            if results:
                return results, "YouTube's most popular chart for this category and region."
        elif response.status_code != 404:
            self._raise(response)

        return self._most_viewed_recent(category_id, region_code, max_results, topic, language)

    def _most_viewed_recent(
        self,
        category_id: str,
        region_code: str,
        max_results: int,
        topic: str | None,
        language: str | None = None,
    ) -> tuple[list[dict[str, Any]], str]:
        # Region filters don't restrict language, so bias search towards the requested one (e.g. "en", "hi").
        relevance_language = (known_language_code(language or "") or "").split("-")[0] or None
        for days in (7, 30):
            published_after = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
            params = {
                "part": "snippet",
                "type": "video",
                "order": "viewCount",
                "videoCategoryId": category_id,
                "regionCode": region_code,
                "publishedAfter": published_after,
                "maxResults": max_results,
            }
            if topic:
                params["q"] = topic
            if relevance_language:
                params["relevanceLanguage"] = relevance_language

            search = self._get("search", params)
            if search.status_code != 200:
                self._raise(search)

            video_ids = [
                item.get("id", {}).get("videoId")
                for item in search.json().get("items", [])
                if item.get("id", {}).get("videoId")
            ]
            # Need enough videos to read a trend; otherwise widen the time window once.
            if len(video_ids) < min(5, max_results) and days == 7:
                continue
            if not video_ids:
                break

            details = self._get("videos", {"part": "snippet,statistics", "id": ",".join(video_ids)})
            if details.status_code != 200:
                self._raise(details)
            by_id = {item.get("id"): item for item in details.json().get("items", [])}
            results = [self._to_video(by_id[video_id], video_id) for video_id in video_ids if video_id in by_id]
            results = [video for video in results if video]
            if results:
                return results, (
                    f"YouTube has no trending chart for this category, so these are the most-viewed "
                    f"videos uploaded in the last {days} days for this category and region."
                )

        raise ValueError(
            "YouTube returned no videos for this category and region. Try another category or region."
        )

    def _get(self, endpoint: str, params: dict[str, Any]) -> requests.Response:
        return requests.get(f"{self.base_url}/{endpoint}", params={**params, "key": self.api_key}, timeout=30)

    @staticmethod
    def _raise(response: requests.Response) -> None:
        try:
            message = response.json().get("error", {}).get("message") or response.text[:300]
        except ValueError:
            message = response.text[:300]
        if response.status_code == 403 and "quota" in message.lower():
            raise RuntimeError("YouTube API daily quota exceeded. Try again tomorrow or use another API key.")
        raise RuntimeError(f"YouTube API request failed ({response.status_code}): {message}")

    @staticmethod
    def _to_video(item: dict[str, Any], video_id: str) -> dict[str, Any] | None:
        if not video_id:
            return None
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        return {
            "video_id": video_id,
            "title": snippet.get("title", ""),
            "channel_title": snippet.get("channelTitle", ""),
            "published_at": snippet.get("publishedAt"),
            "view_count": _safe_int(stats.get("viewCount")),
            "like_count": _safe_int(stats.get("likeCount")),
            "comment_count": _safe_int(stats.get("commentCount")),
            "category_id": snippet.get("categoryId"),
            "video_url": f"https://www.youtube.com/watch?v={video_id}",
        }
