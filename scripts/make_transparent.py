from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def parse_rgb(value: str) -> np.ndarray:
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("RGB values must look like 212,212,212")

    try:
        rgb = np.array([int(part) for part in parts], dtype=np.float32)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("RGB values must be integers") from exc

    if np.any(rgb < 0) or np.any(rgb > 255):
        raise argparse.ArgumentTypeError("RGB values must be between 0 and 255")

    return rgb


def run_lengths(mask: np.ndarray) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = 0
    current = bool(mask[0])

    for index in range(1, len(mask)):
        if bool(mask[index]) != current:
            runs.append((start, index))
            start = index
            current = bool(mask[index])

    runs.append((start, len(mask)))
    return runs


def detect_checker_layout(rgb: np.ndarray, tiles_x: int | None, tiles_y: int | None) -> tuple[np.ndarray, np.ndarray]:
    height, width, _ = rgb.shape

    if tiles_x and tiles_y:
        x_labels = np.floor(np.arange(width) / (width / tiles_x)).astype(np.int32)
        y_labels = np.floor(np.arange(height) / (height / tiles_y)).astype(np.int32)
        return x_labels, y_labels

    top_row = rgb[0].mean(axis=1)
    left_col = rgb[:, 0].mean(axis=1)
    brightness_threshold = (float(top_row.min()) + float(top_row.max())) / 2.0

    x_runs = run_lengths(top_row < brightness_threshold)
    y_runs = run_lengths(left_col < brightness_threshold)

    x_labels = np.zeros(width, dtype=np.int32)
    y_labels = np.zeros(height, dtype=np.int32)

    for index, (start, end) in enumerate(x_runs):
        x_labels[start:end] = index

    for index, (start, end) in enumerate(y_runs):
        y_labels[start:end] = index

    return x_labels, y_labels


def estimate_checker_colors(rgb: np.ndarray, x_labels: np.ndarray, y_labels: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    max_x = int(x_labels.max()) + 1
    max_y = int(y_labels.max()) + 1

    dark_samples: list[np.ndarray] = []
    light_samples: list[np.ndarray] = []

    for yi in range(min(max_y, 8)):
        y_positions = np.where(y_labels == yi)[0]
        if not len(y_positions):
            continue
        y_center = int(y_positions[len(y_positions) // 2])

        for xi in range(min(max_x, 8)):
            x_positions = np.where(x_labels == xi)[0]
            if not len(x_positions):
                continue
            x_center = int(x_positions[len(x_positions) // 2])
            sample = rgb[y_center, x_center]

            if (xi + yi) % 2 == 0:
                dark_samples.append(sample)
            else:
                light_samples.append(sample)

    if not dark_samples or not light_samples:
        raise ValueError("Could not estimate checkerboard colors from the image edges")

    dark_bg = np.median(np.stack(dark_samples), axis=0).astype(np.float32)
    light_bg = np.median(np.stack(light_samples), axis=0).astype(np.float32)
    return dark_bg, light_bg


def build_checkerboard_background(
    rgb: np.ndarray,
    tiles_x: int | None,
    tiles_y: int | None,
    dark_bg: np.ndarray | None,
    light_bg: np.ndarray | None,
) -> np.ndarray:
    x_labels, y_labels = detect_checker_layout(rgb, tiles_x, tiles_y)

    if dark_bg is None or light_bg is None:
        auto_dark, auto_light = estimate_checker_colors(rgb, x_labels, y_labels)
        dark_bg = auto_dark if dark_bg is None else dark_bg
        light_bg = auto_light if light_bg is None else light_bg

    parity = (y_labels[:, None] + x_labels[None, :]) % 2
    return np.where(parity[..., None] == 0, dark_bg, light_bg).astype(np.float32)


def sample_solid_background(rgb: np.ndarray, sample_size: int) -> np.ndarray:
    height, width, _ = rgb.shape
    sample_size = max(1, min(sample_size, width // 4, height // 4))

    corners = [
        rgb[:sample_size, :sample_size],
        rgb[:sample_size, width - sample_size:],
        rgb[height - sample_size:, :sample_size],
        rgb[height - sample_size:, width - sample_size:],
    ]
    samples = np.concatenate([corner.reshape(-1, 3) for corner in corners], axis=0)
    return np.median(samples, axis=0).astype(np.float32)


def extract_foreground(
    rgb: np.ndarray,
    background: np.ndarray,
    low_threshold: float,
    high_threshold: float,
    neutral_spread: float,
    neutral_cutoff: float,
) -> np.ndarray:
    if high_threshold <= low_threshold:
        raise ValueError("--high-threshold must be greater than --low-threshold")

    delta = np.abs(rgb - background).max(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)

    alpha = np.clip((delta - low_threshold) / (high_threshold - low_threshold), 0.0, 1.0)
    alpha = np.where((spread < neutral_spread) & (delta < neutral_cutoff), 0.0, alpha)
    alpha8 = (alpha * 255.0).astype(np.uint8)

    out_rgb = np.zeros_like(rgb)
    mask = alpha > 1e-6
    out_rgb[mask] = (rgb[mask] - background[mask] * (1.0 - alpha[mask, None])) / alpha[mask, None]
    out_rgb = np.clip(out_rgb, 0, 255).astype(np.uint8)

    return np.dstack([out_rgb, alpha8])


def save_preview(image: Image.Image, preview_path: Path, preview_bg: np.ndarray) -> None:
    base = Image.new("RGBA", image.size, tuple(int(value) for value in preview_bg) + (255,))
    preview = Image.alpha_composite(base, image)
    preview.save(preview_path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create a transparent PNG from an image flattened against a known background.",
    )
    parser.add_argument("input", type=Path, help="Source image path")
    parser.add_argument("output", type=Path, help="Output PNG path")
    parser.add_argument(
        "--mode",
        choices=("checkerboard", "solid"),
        default="checkerboard",
        help="Background model to remove",
    )
    parser.add_argument("--tiles-x", type=int, help="Checkerboard tiles across the image")
    parser.add_argument("--tiles-y", type=int, help="Checkerboard tiles down the image")
    parser.add_argument("--dark-bg", type=parse_rgb, help="Override the dark checker color, for example 212,212,212")
    parser.add_argument("--light-bg", type=parse_rgb, help="Override the light checker color, for example 253,254,253")
    parser.add_argument("--solid-bg", type=parse_rgb, help="Override the solid background color, for example 255,255,255")
    parser.add_argument("--corner-sample", type=int, default=32, help="Corner sample size used for solid mode")
    parser.add_argument("--low-threshold", type=float, default=30.0, help="Start fading in the foreground alpha at this delta")
    parser.add_argument("--high-threshold", type=float, default=90.0, help="Treat pixels as fully foreground by this delta")
    parser.add_argument("--neutral-spread", type=float, default=10.0, help="Treat low-saturation pixels below this spread as background noise")
    parser.add_argument("--neutral-cutoff", type=float, default=55.0, help="Clamp near-neutral pixels to transparent below this delta")
    parser.add_argument("--preview", type=Path, help="Optional preview image composited onto a solid color")
    parser.add_argument(
        "--preview-bg",
        type=parse_rgb,
        default=np.array([7, 43, 34], dtype=np.float32),
        help="RGB color for the preview background",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    image = Image.open(args.input).convert("RGBA")
    image_array = np.asarray(image, dtype=np.uint8)

    if int(image_array[..., 3].min()) < 255:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.output)
        if args.preview:
            args.preview.parent.mkdir(parents=True, exist_ok=True)
            save_preview(image, args.preview, args.preview_bg)
        print(f"Saved {args.output}")
        print("Input already had transparency; copied without modification.")
        if args.preview:
            print(f"Preview: {args.preview}")
        return

    rgb = image_array[..., :3].astype(np.float32)

    if args.mode == "checkerboard":
        background = build_checkerboard_background(
            rgb,
            tiles_x=args.tiles_x,
            tiles_y=args.tiles_y,
            dark_bg=args.dark_bg,
            light_bg=args.light_bg,
        )
    else:
        solid_bg = args.solid_bg if args.solid_bg is not None else sample_solid_background(rgb, args.corner_sample)
        background = np.broadcast_to(solid_bg, rgb.shape).astype(np.float32)

    rgba = extract_foreground(
        rgb,
        background,
        low_threshold=args.low_threshold,
        high_threshold=args.high_threshold,
        neutral_spread=args.neutral_spread,
        neutral_cutoff=args.neutral_cutoff,
    )

    output = Image.fromarray(rgba, "RGBA")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.output)

    if args.preview:
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        save_preview(output, args.preview, args.preview_bg)

    alpha_extrema = output.getchannel("A").getextrema()
    print(f"Saved {args.output}")
    print(f"Alpha range: {alpha_extrema}")
    if args.preview:
        print(f"Preview: {args.preview}")


if __name__ == "__main__":
    main()
