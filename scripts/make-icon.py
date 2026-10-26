"""Generate the market-storefront raster icon from the same design as icon.svg.

The market accepts a GitHub-hosted PNG/JPG/WebP icon for its cards, so this draws a
512x512 PNG (4x supersampled, then downscaled) using only Pillow.
"""

from pathlib import Path

from PIL import Image, ImageDraw

SS = 4
SIZE = 512
canvas = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)


def s(value: float) -> float:
    return value * SS


BLUE = (77, 107, 254, 255)
WHITE = (255, 255, 255, 255)
WHITE_SOFT = (255, 255, 255, 140)

# Rounded-square plate (#4D6BFE, radius 112 of 512).
draw.rounded_rectangle(
    (s(0), s(0), s(SIZE - 1), s(SIZE - 1)),
    radius=s(112),
    fill=BLUE,
)

# Gauge arc: center (256, 328), r 128, over the top half.
arc_box = (s(128), s(200), s(384), s(456))
draw.arc(arc_box, start=180, end=360, fill=WHITE, width=s(40))

# Needle from the hub toward the upper right, and the hub itself.
draw.line((s(252), s(332), s(328), s(248)), fill=WHITE, width=s(32))
draw.line((s(252), s(332), s(328), s(248)), fill=WHITE, width=s(32))
for radius, fill in ((s(32), WHITE),):
    draw.ellipse(
        (s(256) - radius, s(328) - radius, s(256) + radius, s(328) + radius),
        fill=fill,
    )

# Soft baseline under the gauge.
draw.line((s(168), s(392), s(344), s(392)), fill=WHITE_SOFT, width=s(32))

icon = canvas.resize((SIZE, SIZE), Image.LANCZOS)
out = Path(__file__).resolve().parent.parent / "assets" / "icon-512.png"
out.parent.mkdir(parents=True, exist_ok=True)
icon.save(out, "PNG", optimize=True)
print(out, out.stat().st_size)
