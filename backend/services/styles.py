from typing import Dict, Any


STYLE_PROFILES: Dict[str, Dict[str, str]] = {
    "Pulp / Neo-Noir": {
        "label": "Pulp / Neo-Noir Fiction",
        "description": "High-contrast chiaroscuro shadows, gritty neon backlighting, 35mm film grain, Dutch angles, graphic novel pulp aesthetic.",
        "lighting_and_color": "High-contrast deep blacks with saturated neon red and amber accents, venetian blind shadow slats, hard rim lighting.",
        "camera_and_lens": "Dutch tilted angles, 35mm vintage prime lens, dramatic low-angle framing, stylized graphic novel silhouettes.",
        "texture_and_cadence": "Gritty 35mm film grain, atmospheric cigarette smoke and rain reflections, dramatic hard-boiled pacing."
    },
    "Pastel / Wes Anderson": {
        "label": "Pastel / Wes Anderson Aesthetic",
        "description": "Strict symmetrical flat composition, curated muted pastel palette, whimsical dollhouse theatrical blocking, warm soft lighting.",
        "lighting_and_color": "Curated pastel palette of powder blue, mustard yellow, coral pink, and mint green with warm diffused soft lighting.",
        "camera_and_lens": "Dead-center symmetrical framing, 90-degree snap whip pans, flat orthographic tableau staging, vintage 16mm lens.",
        "texture_and_cadence": "Fine 16mm film texture, meticulous storybook diorama precision, charming deadpan timing."
    },
    "90s Multi-Cam Sitcom": {
        "label": "90s Multi-Cam Sitcom",
        "description": "Authentic broadcast NTSC color grading, multi-camera studio living room set, warm floodlights, classic TV staging.",
        "lighting_and_color": "Bright studio floodlighting, warm multi-cam studio glow, broadcast NTSC video grading.",
        "camera_and_lens": "Standard 3-camera sitcom setup, wide multi-angle living room and kitchen stages, flat studio depth of field.",
        "texture_and_cadence": "Subtle videotape softness, classic 90s TV broadcast aesthetic, energetic sitcom blocking and comedic pacing."
    },
    "3D Pixar / Animation": {
        "label": "3D Pixar / Animation",
        "description": "High-end 3D CGI animation, expressive subsurface scattering, lush volumetric lighting, blockbuster animated character physics.",
        "lighting_and_color": "Rich vibrant color gamut, golden volumetric light shafts, warm subsurface skin and fur scattering.",
        "camera_and_lens": "Smooth digital virtual camera, cinematic shallow depth of field with creamy circular bokeh, dynamic tracking.",
        "texture_and_cadence": "Hyper-detailed stylized 3D textures, clean polished CGI rendering, fluid and expressive character animation."
    },
    "2D Anime / Cartoon": {
        "label": "2D Anime / Studio Ghibli Cartoon",
        "description": "Hand-painted watercolor backgrounds, bold clean cel-shaded ink lines, lush atmospheric nature lighting, Studio Ghibli aesthetic.",
        "lighting_and_color": "Lush natural sunbeams, vibrant watercolor skies, rich hand-painted botanical greens, soft atmospheric glow.",
        "camera_and_lens": "Cinematic anime camera pans, dramatic hero framing, gentle wind breeze parallax layers.",
        "texture_and_cadence": "Classic 2D cel animation texture, delicate hand-inked line art, poetic and expressive Japanese animation timing."
    },
    "Cyberpunk / Sci-Fi": {
        "label": "Cyberpunk / Neon Sci-Fi",
        "description": "Dystopian futuristic megacity, rain-slicked asphalt, vibrant cyan and magenta holographic glow, anamorphic lens flares.",
        "lighting_and_color": "Dark moody nocturnal base illuminated by intense cyan, violet, and electric pink neon lights and volumetric laser fog.",
        "camera_and_lens": "Low-angle anamorphic widescreen lens, horizontal blue streak flares, sweeping drone fly-throughs.",
        "texture_and_cadence": "Rain reflections, holographic optical artifacts, high-tech dystopian futuristic velocity."
    },
    "Claymation / Stop-Motion": {
        "label": "Claymation / Stop-Motion",
        "description": "Handcrafted plasticine clay characters, tangible tactile fingerprint textures, physical miniature diorama lighting, 12fps cadence.",
        "lighting_and_color": "Warm tangible table-top studio spotlights, physical miniature shadows, rich organic clay pigments.",
        "camera_and_lens": "Macro tilt-shift miniature lens, shallow physical depth of field, handcrafted diorama perspective.",
        "texture_and_cadence": "Visible subtle clay fingerprints, tactile fabric and armature textures, charming 12fps stop-motion frame stutter."
    },
    "Watercolor / Storybook": {
        "label": "Watercolor / Storybook Illustration",
        "description": "Soft deckled paper grain, flowing organic watercolor washes, delicate hand-drawn pencil borders, fairy-tale storybook aesthetic.",
        "lighting_and_color": "Soft luminous paper translucency, gentle pastel watercolor gradients, warm natural storybook radiance.",
        "camera_and_lens": "Gentle illustrative multiplane parallax drift, book illustration framing, whimsical storybook perspective.",
        "texture_and_cadence": "Rough handmade cotton paper texture, organic watercolor blooming edges, gentle drifting illustration movement."
    },
    "Retro 80s VHS": {
        "label": "Retro 80s VHS / Analog Tape",
        "description": "Authentic analog videotape artifacts, subtle chromatic aberration, magnetic tracking scanlines, nostalgic 1980s camcorder aesthetic.",
        "lighting_and_color": "Saturated 80s magnetic tape colors, warm analog tungsten spill, vintage CRT phosphors.",
        "camera_and_lens": "Handheld vintage VHS camcorder, manual snap zoom, retro analog lens flares.",
        "texture_and_cadence": "Authentic magnetic tape noise, subtle tracking distortion at frame edges, nostalgic 1980s camcorder cadence."
    },
    "Cinematic Realistic": {
        "label": "Cinematic Realistic (4K Photoreal)",
        "description": "Arri Alexa master prime lens, naturalistic cinematic lighting, 4K photorealistic textures, prestige drama color grade.",
        "lighting_and_color": "Naturalistic directional key and fill lighting, cinematic color grading with rich shadows and preserved highlights.",
        "camera_and_lens": "Steadicam and dolly tracking, 35mm master prime lens, natural shallow depth of field, prestige cinematic framing.",
        "texture_and_cadence": "Ultra-detailed 4K photorealism, natural physical lighting, smooth theatrical pacing."
    }
}


def resolve_style_profile(style_query: str) -> Dict[str, str]:
    if not style_query:
        return STYLE_PROFILES["Cinematic Realistic"]

    cleaned = style_query.strip().lower()
    for key, profile in STYLE_PROFILES.items():
        if key.lower() in cleaned or cleaned in key.lower():
            return profile

        # Keyword matching
        if "pulp" in cleaned or "noir" in cleaned:
            return STYLE_PROFILES["Pulp / Neo-Noir"]
        if "pastel" in cleaned or "anderson" in cleaned:
            return STYLE_PROFILES["Pastel / Wes Anderson"]
        if "sitcom" in cleaned or "tv" in cleaned or "90s" in cleaned:
            return STYLE_PROFILES["90s Multi-Cam Sitcom"]
        if "pixar" in cleaned or "3d" in cleaned or "cgi" in cleaned:
            return STYLE_PROFILES["3D Pixar / Animation"]
        if "anime" in cleaned or "cartoon" in cleaned or "ghibli" in cleaned or "2d" in cleaned:
            return STYLE_PROFILES["2D Anime / Cartoon"]
        if "cyberpunk" in cleaned or "sci-fi" in cleaned or "neon" in cleaned:
            return STYLE_PROFILES["Cyberpunk / Sci-Fi"]
        if "clay" in cleaned or "stop-motion" in cleaned:
            return STYLE_PROFILES["Claymation / Stop-Motion"]
        if "watercolor" in cleaned or "storybook" in cleaned or "illustration" in cleaned:
            return STYLE_PROFILES["Watercolor / Storybook"]
        if "vhs" in cleaned or "retro" in cleaned or "80s" in cleaned:
            return STYLE_PROFILES["Retro 80s VHS"]

    # Fallback with custom profile
    return {
        "label": style_query,
        "description": f"Rendered strictly in {style_query} aesthetic.",
        "lighting_and_color": f"Lighting, palette, and color grading tailored to {style_query}.",
        "camera_and_lens": f"Cinematic camera work appropriate for {style_query}.",
        "texture_and_cadence": f"Visual textures consistent with {style_query}."
    }
