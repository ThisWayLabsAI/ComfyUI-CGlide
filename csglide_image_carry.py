"""Experimental raw-frame capture. Imported only by the experimental branch.

No sampler, model, or live project state is touched. Immutable PNGs live in ComfyUI temp. A late/cancelled render can never overwrite
a newer capture. Standard ComfyUI temp cleanup owns their on-disk lifetime.
"""
from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path

_TOKEN = re.compile(r"[a-f0-9-]{36}\Z")
SUBFOLDER = "cglide-image-carry"


def save_final_frame(images, temp_root: str, run_token: str) -> dict:
    """Save only the raw final RGB frame, preserving its spatial dimensions."""
    if not _TOKEN.fullmatch(run_token):
        raise ValueError("Image Carry: invalid capture identity.")
    if len(images.shape) != 4 or images.shape[0] < 1 or images.shape[-1] != 3:
        raise ValueError("Image Carry: expected a nonempty decoded [frames, height, width, RGB] tensor.")
    import numpy as np
    from PIL import Image

    frame = images[-1].detach().cpu().float().numpy()
    if not np.isfinite(frame).all():
        raise ValueError("Image Carry: decoded final frame contains non-finite pixels.")
    pixels = np.clip(frame * 255.0, 0, 255).round().astype(np.uint8)
    directory = Path(temp_root) / SUBFOLDER
    directory.mkdir(parents=True, exist_ok=True)
    if (directory / (run_token + ".png")).exists():
        raise ValueError("Image Carry: capture identity already exists; retry with a fresh run token.")
    filename = run_token + ".png"
    descriptor, scratch = tempfile.mkstemp(prefix=".capture-", suffix=".png", dir=directory)
    os.close(descriptor)
    try:
        Image.fromarray(pixels).save(scratch, format="PNG")
        os.replace(scratch, directory / filename)
    finally:
        if os.path.exists(scratch):
            os.unlink(scratch)
    return {"filename": filename, "subfolder": SUBFOLDER, "type": "temp",
            "version": run_token, "width": int(images.shape[2]),
            "height": int(images.shape[1]), "frames": int(images.shape[0])}


class CSGlideImageCarry:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",), "run_token": ("STRING",)}}

    RETURN_TYPES = ()
    FUNCTION = "capture"
    OUTPUT_NODE = True
    CATEGORY = "CGlide/experimental"
    DESCRIPTION = "Capture raw decoder final frame for the Image Carry experiment. Added to queued prompts automatically."

    def capture(self, images, run_token):
        import folder_paths

        frame = save_final_frame(images, folder_paths.get_temp_directory(), run_token)
        return {"ui": {"cglide_image_carry": [frame]}, "result": ()}
