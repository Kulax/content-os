const outputPane = document.getElementById("outputPane");
let lastTrendIdeation = null;

function apiBase() {
  return document.getElementById("apiBase").value.trim().replace(/\/$/, "");
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function writeOutput(title, payload) {
  outputPane.textContent = `${title}\n\n${pretty(payload)}`;
}

function writeError(title, err) {
  const payload = {
    error: err?.message || "Unknown error",
    details: err?.details || null,
  };
  outputPane.textContent = `${title}\n\n${pretty(payload)}`;
}

async function postJson(path, body) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.details = data;
    throw err;
  }

  return data;
}

function createPayload() {
  return {
    prompt: document.getElementById("createPrompt").value.trim(),
    audience_level: document.getElementById("createAudience").value.trim() || "general",
    duration_seconds: Number(document.getElementById("createDuration").value || 120),
    language: document.getElementById("createLanguage").value.trim() || "English",
    format: "video",
    tone: document.getElementById("createTone").value.trim() || "engaging",
  };
}

function adaptPayload() {
  return {
    base_request: {
      prompt: document.getElementById("adaptBasePrompt").value.trim(),
      audience_level: document.getElementById("createAudience").value.trim() || "general",
      duration_seconds: Number(document.getElementById("createDuration").value || 120),
      language: document.getElementById("createLanguage").value.trim() || "English",
      format: "video",
      tone: document.getElementById("createTone").value.trim() || "engaging",
    },
    adaptation_instruction: document.getElementById("adaptInstruction").value.trim(),
    content_id: document.getElementById("adaptContentId").value.trim() || null,
    current_version: Number(document.getElementById("adaptVersion").value || 1),
  };
}

async function handleCreate() {
  try {
    writeOutput("Running /api/create ...", { status: "pending" });
    const data = await postJson("/api/create", createPayload());
    document.getElementById("renderContentId").value = data.content_id || "";
    writeOutput("Content DNA + Plan", data);
  } catch (err) {
    writeError("Create failed", err);
  }
}

async function handleCreateVideo() {
  try {
    writeOutput("Running /api/create-video ...", { status: "pending" });
    const data = await postJson("/api/create-video", createPayload());
    document.getElementById("renderContentId").value = data.content_id || "";

    const sceneUri = data.narrated_scene_video_path || data.scene_video_path;
    if (sceneUri) {
      document.getElementById("renderSceneUris").value = sceneUri;
      if (data.narration_audio_uri) {
        document.getElementById("renderNarrationUri").value = data.narration_audio_uri;
      }
    }

    writeOutput("Video + Narration Result", data);
  } catch (err) {
    writeError("Create video failed", err);
  }
}

async function handleTransform() {
  try {
    writeOutput("Running /api/transform ...", { status: "pending" });
    const data = await postJson("/api/transform", {
      source_text: document.getElementById("transformSource").value.trim(),
      transform_goal: document.getElementById("transformGoal").value.trim(),
      audience_level: document.getElementById("createAudience").value.trim() || "general",
      duration_seconds: Number(document.getElementById("createDuration").value || 120),
      language: document.getElementById("createLanguage").value.trim() || "English",
      format: "video",
      tone: document.getElementById("createTone").value.trim() || "engaging",
    });

    writeOutput("Transform Blueprint", data);
  } catch (err) {
    writeError("Transform failed", err);
  }
}

async function handleUnderstand() {
  try {
    writeOutput("Running /api/understand ...", { status: "pending" });
    const data = await postJson("/api/understand", {
      content_text: document.getElementById("understandText").value.trim(),
      audience_level: document.getElementById("createAudience").value.trim() || "general",
    });

    writeOutput("Understanding Output", data);
  } catch (err) {
    writeError("Understand failed", err);
  }
}

async function handleAdapt() {
  try {
    writeOutput("Running /api/adapt ...", { status: "pending" });
    const data = await postJson("/api/adapt", adaptPayload());
    writeOutput("Adapted Blueprint", data);
  } catch (err) {
    writeError("Adapt failed", err);
  }
}

function parseTrendSignals(rawSignals) {
  return rawSignals
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 3) {
        return {
          source_type: parts[0] || "custom",
          source_label: parts[1] || null,
          text: parts.slice(2).join(" | "),
        };
      }

      return {
        source_type: "custom",
        source_label: null,
        text: line,
      };
    })
    .filter((item) => item.text);
}

async function handleIdeateTrends() {
  try {
    writeOutput("Running /api/ideate-trends ...", { status: "pending" });

    const payload = {
      topic: document.getElementById("trendTopic").value.trim(),
      audience_level: document.getElementById("createAudience").value.trim() || "general",
      language: document.getElementById("createLanguage").value.trim() || "English",
      max_ideas: 5,
      signals: parseTrendSignals(document.getElementById("trendSignals").value),
      mcp_dump: document.getElementById("trendMcpDump").value.trim() || null,
      additional_context: document.getElementById("trendAdditionalContext").value.trim() || null,
    };

    const data = await postJson("/api/ideate-trends", payload);
    lastTrendIdeation = data;
    writeOutput("Trend Ideation Insights", data);
  } catch (err) {
    writeError("Trend ideation failed", err);
  }
}

async function handleIdeateYouTubeTrends() {
  try {
    writeOutput("Running /api/ideate-youtube-trends ...", { status: "pending" });

    const payload = {
      category: document.getElementById("ytCategory").value,
      region_code: (document.getElementById("ytRegion").value || "US").trim().toUpperCase(),
      max_results: 15,
      audience_level: document.getElementById("createAudience").value.trim() || "general",
      language: document.getElementById("createLanguage").value.trim() || "English",
      max_ideas: 5,
      topic_override: document.getElementById("trendTopic").value.trim() || null,
      additional_context: document.getElementById("trendAdditionalContext").value.trim() || null,
    };

    const data = await postJson("/api/ideate-youtube-trends", payload);
    lastTrendIdeation = data.ideation || null;
    writeOutput("YouTube Trending + Ideation", data);
  } catch (err) {
    writeError("YouTube trend ideation failed", err);
  }
}

function handleUseTopTrend() {
  if (!lastTrendIdeation?.top_create_request?.prompt) {
    writeOutput("No trend ideation result yet", {
      message: "Run Trend Ideation first.",
    });
    return;
  }

  const req = lastTrendIdeation.top_create_request;

  document.getElementById("createPrompt").value = req.prompt || "";
  document.getElementById("createAudience").value = req.audience_level || "general";
  document.getElementById("createDuration").value = req.duration_seconds || 120;
  document.getElementById("createLanguage").value = req.language || "English";
  document.getElementById("createTone").value = req.tone || "engaging";

  writeOutput("Top trend idea copied to Create", {
    prompt: req.prompt,
    audience_level: req.audience_level,
    duration_seconds: req.duration_seconds,
    language: req.language,
    tone: req.tone,
  });
}

async function handleRender() {
  try {
    writeOutput("Running /api/render-experience ...", { status: "pending" });

    const uris = document
      .getElementById("renderSceneUris")
      .value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const narrationUri = document.getElementById("renderNarrationUri").value.trim();

    const data = await postJson("/api/render-experience", {
      content_id: document.getElementById("renderContentId").value.trim(),
      scene_uris: uris,
      narration_audio_uri: narrationUri || null,
      subtitle_cues: [],
    });

    writeOutput("Final Render", data);
  } catch (err) {
    writeError("Render failed", err);
  }
}

document.getElementById("btnCreate").addEventListener("click", handleCreate);
document.getElementById("btnCreateVideo").addEventListener("click", handleCreateVideo);
document.getElementById("btnTransform").addEventListener("click", handleTransform);
document.getElementById("btnUnderstand").addEventListener("click", handleUnderstand);
document.getElementById("btnAdapt").addEventListener("click", handleAdapt);
document.getElementById("btnIdeateTrends").addEventListener("click", handleIdeateTrends);
document.getElementById("btnIdeateYouTube").addEventListener("click", handleIdeateYouTubeTrends);
document.getElementById("btnUseTopTrend").addEventListener("click", handleUseTopTrend);
document.getElementById("btnRender").addEventListener("click", handleRender);
document.getElementById("btnClear").addEventListener("click", () => {
  outputPane.textContent = "Run a flow to view structured results.";
});
