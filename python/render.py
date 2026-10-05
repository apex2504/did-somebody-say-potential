# Some values in this file are based on those from https://github.com/apollosense/megumi-meme-generator/blob/main/app.js

import io
import math
import os
from typing import List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_IMAGE_PATH = os.path.join(CURRENT_DIR, "image.png")
DEFAULT_FONT_PATH = os.path.join(CURRENT_DIR, "TikTokSans-900.ttf")

_BASE_IMAGE: Optional[Image.Image] = None
_FONT_CACHE = {}


def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    """Convert hex color string (e.g. '#73B5FF') to RGB tuple."""
    hex_str = hex_str.lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join([c * 2 for c in hex_str])
    return (int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))


def get_base_image(image_path: str = DEFAULT_IMAGE_PATH) -> Image.Image:
    """Load and cache the base Megumi image."""
    global _BASE_IMAGE
    if _BASE_IMAGE is None:
        candidates = [
            image_path,
            os.path.join(CURRENT_DIR, "image.png"),
            "image.png",
        ]
        for c in candidates:
            if os.path.exists(c):
                _BASE_IMAGE = Image.open(c).convert("RGBA")
                break
        if _BASE_IMAGE is None:
            raise FileNotFoundError(f"Could not find image.png in {candidates}")
    return _BASE_IMAGE.copy()


def get_font(size: float, font_path: str = DEFAULT_FONT_PATH) -> ImageFont.FreeTypeFont:
    """Load and cache TrueType fonts at requested (possibly fractional) pixel sizes."""
    candidates = [
        font_path,
        os.path.join(CURRENT_DIR, "TikTokSans-900.ttf"),
        "TikTokSans-900.ttf",
    ]
    resolved_path = None
    for c in candidates:
        if os.path.exists(c):
            resolved_path = c
            break
    if not resolved_path:
        raise FileNotFoundError(f"Could not find TikTokSans-900.ttf in {candidates}")

    cache_key = (resolved_path, size)
    if cache_key not in _FONT_CACHE:
        # Canvas uses the exact (fractional) px size, e.g. "900 112.64px", so don't truncate it.
        _FONT_CACHE[cache_key] = ImageFont.truetype(resolved_path, size)
    return _FONT_CACHE[cache_key]


# Gradient stop 0 colour used by the web generator (#eaf4ff).
_GRADIENT_TOP = (234, 244, 255)

# Glow passes from web/app.js: (shadowBlur multiplier, globalAlpha).
_GLOW_PASSES = ((1.0, 0.9), (0.55, 0.9), (0.25, 1.0))


def _shadow_sigma(shadow_blur: float) -> float:
    """Canvas spec: the shadow is a Gaussian blur with standard deviation shadowBlur / 2.
    Pillow's GaussianBlur ``radius`` is that standard deviation."""
    return shadow_blur / 2.0


def _scale_alpha(mask: Image.Image, alpha: float) -> Image.Image:
    """Apply canvas globalAlpha to a coverage mask."""
    if alpha >= 1.0:
        return mask
    return mask.point(lambda p: int(p * alpha + 0.5))


def _composite_color(dst: Image.Image, rgb: Tuple[int, int, int], mask: Image.Image) -> Image.Image:
    """Source-over a solid colour onto ``dst`` using ``mask`` as its alpha."""
    layer = Image.new("RGBA", dst.size, rgb + (255,))
    layer.putalpha(mask)
    return Image.alpha_composite(dst, layer)


def _gradient_layer(
    size: Tuple[int, int], origin_y: int, top: float, bottom: float, c1: Tuple[int, int, int]
) -> Image.Image:
    """Equivalent of ctx.createLinearGradient(0, top, 0, bottom) with stops
    0 -> #eaf4ff, .38 -> c1, 1 -> c1. Sampled at pixel centres like canvas, and
    padded (clamped) beyond the ends."""
    w, h = size
    span = bottom - top
    col = []
    for row in range(h):
        py = origin_y + row + 0.5
        pos = (py - top) / span if span else 1.0
        pos = 0.0 if pos < 0.0 else (1.0 if pos > 1.0 else pos)
        if pos >= 0.38:
            col.append(c1)
        else:
            f = pos / 0.38
            col.append(tuple(int(round(a + (b - a) * f)) for a, b in zip(_GRADIENT_TOP, c1)))
    strip = Image.new("RGB", (1, h))
    strip.putdata(col)
    return strip.resize((w, h), Image.NEAREST).convert("RGBA")


def _text_width(text: str, sz: float, font_path: str) -> float:
    """Rendered width of ``text`` (including the edge stroke) when drawn from x = 0."""
    if not text:
        return 0.0
    stroke_r = int(sz * 0.08 / 2.0)
    return get_font(sz, font_path).getbbox(text, anchor="ls", stroke_width=stroke_r)[2]


def _split_long_word(word: str, sz: float, max_width: float, font_path: str) -> List[str]:
    """Hard-break a single word that is wider than ``max_width`` into fitting chunks."""
    chunks: List[str] = []
    current = ""
    for ch in word:
        if current and _text_width(current + ch, sz, font_path) > max_width:
            chunks.append(current)
            current = ch
        else:
            current += ch
    if current:
        chunks.append(current)
    return chunks


def _wrap_words(words: List[str], sz: float, max_width: float, font_path: str) -> List[str]:
    """Greedy word wrap at font size ``sz``. Words too wide for a row are hard-broken."""
    rows: List[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}" if current else word
        if _text_width(candidate, sz, font_path) <= max_width:
            current = candidate
            continue
        if current:
            rows.append(current)
        if _text_width(word, sz, font_path) <= max_width:
            current = word
        else:
            *full, current = _split_long_word(word, sz, max_width, font_path)
            rows.extend(full)
    if current:
        rows.append(current)
    return rows


def _layout_rows(
    lines: List[str], base: float, small: float, max_width: Optional[float], font_path: str
) -> List[Tuple[str, float]]:
    """
    Turn user lines into (row_text, font_size) rows, top to bottom.

    Manual newlines always start a new row. The bottom row uses ``base``; when the last
    user line is too long, the bottom row takes as many trailing words as fit at ``base``
    and the remaining words wrap above it at ``small``.
    """
    rows: List[Tuple[str, float]] = []
    last = len(lines) - 1
    for i, line in enumerate(lines):
        words = line.split()
        if max_width is None or not words:
            rows.append((line, base if i == last else small))
            continue

        if i != last:
            rows.extend((r, small) for r in _wrap_words(words, small, max_width, font_path))
            continue

        # Bottom line: fill the big bottom row from the end, wrap the rest small above it.
        split = len(words) - 1
        while split > 0 and _text_width(" ".join(words[split - 1:]), base, font_path) <= max_width:
            split -= 1
        rows.extend((r, small) for r in _wrap_words(words[:split], small, max_width, font_path))
        # Normally a single row; more only if one word is too wide even on its own.
        rows.extend((r, base) for r in _wrap_words(words[split:], base, max_width, font_path))
    return rows


def render_megumi(
    text: str = "HELL YEAH",
    size: float = 11.0,
    wrap: bool = True,
    uppercase: bool = True,
    color: str = "#73B5FF",
    glow_intensity: float = 100.0,
    glow_color: str = "#0033FF",
    shrink: bool = True,
    x_ratio: float = 0.045,
    y_ratio: float = 0.9,
    image_path: str = DEFAULT_IMAGE_PATH,
    font_path: str = DEFAULT_FONT_PATH,
    max_width_ratio: Optional[float] = None,
) -> bytes:
    """
    Render text overlaid on Megumi image with TikTok Sans 900 font and neon glow.
    Mirrors draw() in web/app.js pass for pass. Returns PNG bytes.

    When ``wrap`` is enabled, lines wider than the available width flow onto new rows.
    The available width defaults to the image width minus ``x_ratio`` margins on both
    sides; override it with ``max_width_ratio`` (fraction of the image width).
    """
    result = get_base_image(image_path)
    W, H = result.size

    # Sanitize and split lines (same as lines() in app.js)
    t = text.replace("\r", "").replace("\\n", "\n")
    if uppercase:
        t = t.upper()
    arr = t.split("\n")
    while arr and arr[-1].strip() == "":
        arr.pop()

    if arr:
        base = W * (size / 100.0)
        small = (base * 0.5) if shrink else base
        glow_scale = glow_intensity / 100.0
        c1 = hex_to_rgb(color)
        c2 = hex_to_rgb(glow_color)
        start_x = x_ratio * W
        start_y = y_ratio * H

        max_width: Optional[float] = None
        if wrap:
            ratio = max_width_ratio if max_width_ratio is not None else 1.0 - 2.0 * x_ratio
            max_width = max(1.0, ratio * W)
        rows = _layout_rows(arr, base, small, max_width, font_path)

        # Size + baseline per row, built from the bottom up
        items = []
        cursor = start_y
        for row_text, sz in reversed(rows):
            items.insert(0, (row_text, sz, cursor))
            cursor -= sz * 1.08

        for line_text, sz, y_pos in items:
            if not line_text:
                continue
            result = _draw_line(result, line_text, sz, start_x, y_pos, glow_scale, c1, c2, font_path)

    # Save to PNG in memory
    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _draw_line(
    result: Image.Image,
    line_text: str,
    sz: float,
    x: float,
    y: float,
    glow_intensity: float,
    c1: Tuple[int, int, int],
    c2: Tuple[int, int, int],
    font_path: str,
) -> Image.Image:
    font = get_font(sz, font_path)
    W, H = result.size

    # canvas strokeText(lineWidth = sz*0.08) paints sz*0.04 either side of the outline;
    # Pillow's stroke_width is that per-side radius.
    stroke_r = int(sz * 0.08 / 2.0)
    glow = glow_intensity * 0.9
    tight_blur = sz * 0.12 * max(glow, 0.2)
    max_blur = max(tight_blur, sz * _GLOW_PASSES[0][0] * glow if glow > 0 else 0.0)

    # Work in a crop around the line, big enough to hold the widest shadow (~3 sigma).
    pad = int(math.ceil(3.0 * _shadow_sigma(max_blur))) + 4
    l, t, r, b = font.getbbox(line_text, anchor="ls", stroke_width=stroke_r)
    x0 = int(math.floor(x + l)) - pad
    y0 = int(math.floor(y + t)) - pad
    x1 = int(math.ceil(x + r)) + pad
    y1 = int(math.ceil(y + b)) + pad
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return result
    cw, ch = x1 - x0, y1 - y0
    lx, ly = x - x0, y - y0  # text origin inside the crop (keeps the sub-pixel offset)

    def text_mask(stroke: int = 0) -> Image.Image:
        m = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(m).text(
            (int(lx), int(ly)), line_text, font=font, fill=255, anchor="ls",
            stroke_width=stroke, stroke_fill=255,
        )
        return m

    def shadow(mask: Image.Image, shadow_blur: float) -> Image.Image:
        return mask.filter(ImageFilter.GaussianBlur(_shadow_sigma(shadow_blur)))

    fill_mask = text_mask()
    region = result.crop((x0, y0, x1, y1))  # out-of-bounds areas come back transparent

    if glow > 0:
        # Wide neon halo, then tighter passes. Each pass is fillText in c2 with a c2 shadow,
        # both scaled by globalAlpha: shadow first, then the glyphs themselves.
        for blur_mult, alpha in _GLOW_PASSES:
            blur = sz * blur_mult * glow
            if blur > 0:
                region = _composite_color(region, c2, _scale_alpha(shadow(fill_mask, blur), alpha))
            region = _composite_color(region, c2, _scale_alpha(fill_mask, alpha))

        # Deep-blue edge layer (strokeText, no shadow). Pillow's stroke also fills the
        # glyph interior, but that is already opaque c2 from the alpha=1 pass above.
        region = _composite_color(region, c2, text_mask(stroke_r))

    # Final gradient fill with a tight c2 shadow (drawn even when glow == 0, like the JS).
    region = _composite_color(region, c2, shadow(fill_mask, tight_blur))
    grad = _gradient_layer((cw, ch), y0, y - sz * 0.78, y, c1)
    grad.putalpha(fill_mask)
    region = Image.alpha_composite(region, grad)

    # Paste the processed crop back, clipped to the image bounds.
    sx0, sy0 = max(0, -x0), max(0, -y0)
    sx1, sy1 = cw - max(0, x1 - W), ch - max(0, y1 - H)
    result.paste(region.crop((sx0, sy0, sx1, sy1)), (x0 + sx0, y0 + sy0))
    return result
