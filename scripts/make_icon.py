"""
JARVIS Icon Generator — создаёт jarvis.ico, tray-icon.png, jarvis.png
Требует: pillow (pip install pillow)
Использование: python scripts/make_icon.py
"""
import os
import struct
import zlib
from pathlib import Path
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def create_jarvis_ico(output_dir: str = "electron/assets"):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Install pillow: pip install pillow")
        raise

    os.makedirs(output_dir, exist_ok=True)

    CYAN = (0, 212, 255, 255)
    BG   = (5, 10, 20, 255)
    GLOW = (0, 100, 180, 80)

    def make_frame(size: int) -> Image.Image:
        img = Image.new("RGBA", (size, size), BG)
        draw = ImageDraw.Draw(img)

        # Внешний светящийся обод
        margin = max(2, size // 12)
        lw = max(1, size // 20)
        for offset in range(3, 0, -1):
            glow_color = (0, 212, 255, 30 * offset)
            m = margin - offset * lw
            draw.ellipse([m, m, size - m, size - m], outline=glow_color, width=lw + offset)

        # Основной круг
        draw.ellipse([margin, margin, size - margin, size - margin],
                     outline=CYAN, width=lw)

        # Буква J
        font_size = int(size * 0.48)
        font = None
        for font_path in [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]:
            if os.path.exists(font_path):
                try:
                    from PIL import ImageFont as IF
                    font = IF.truetype(font_path, font_size)
                    break
                except Exception:
                    pass
        if font is None:
            from PIL import ImageFont as IF
            font = IF.load_default()

        bbox = draw.textbbox((0, 0), "J", font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (size - tw) // 2 - bbox[0]
        y = (size - th) // 2 - bbox[1]

        # Тень
        draw.text((x + max(1, size // 60), y + max(1, size // 60)), "J",
                  fill=(0, 50, 100, 180), font=font)
        # Основной текст
        draw.text((x, y), "J", fill=CYAN, font=font)

        return img

    sizes = [256, 128, 64, 48, 32, 16]
    images = [make_frame(s) for s in sizes]

    # Сохраняем ICO
    ico_path = Path(output_dir) / "jarvis.ico"
    images[0].save(str(ico_path), format="ICO",
                   sizes=[(s, s) for s in sizes])
    print(f"  Created: {ico_path}")

    # Сохраняем PNG для трея (32x32)
    tray_path = Path(output_dir) / "tray-icon.png"
    make_frame(32).save(str(tray_path), format="PNG")
    print(f"  Created: {tray_path}")

    # Большой PNG (256) для Linux
    png_path = Path(output_dir) / "jarvis.png"
    images[0].save(str(png_path), format="PNG")
    print(f"  Created: {png_path}")

    # macOS ICNS (простой способ через PIL если поддерживается)
    try:
        icns_path = Path(output_dir) / "jarvis.icns"
        images[0].save(str(icns_path), format="ICNS")
        print(f"  Created: {icns_path}")
    except Exception:
        print("  ICNS: skipped (macOS only)")

    print(f"\nJARVIS icons generated in {output_dir}/")


if __name__ == "__main__":
    import sys
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "electron/assets"
    create_jarvis_ico(out_dir)
