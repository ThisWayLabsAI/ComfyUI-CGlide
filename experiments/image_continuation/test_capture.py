"""CPU-only checks. Load pure Cast helpers via AST to avoid ComfyUI/GPU startup."""
import ast
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import types
import unittest

import numpy as np
from PIL import Image
import torch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("image_carry", ROOT / "csglide_image_carry.py")
carry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(carry)
TOKEN = "12345678-1234-1234-1234-123456789abc"


def cast_helpers(input_root, temp_root):
    names = {"_resolve_asset", "parse_h3_data", "_slot_list", "_video_slot_list", "build_tag_map", "transcribe_prompt"}
    tree = ast.parse((ROOT / "csglide_cast.py").read_text(encoding="utf-8"))
    selected = ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names], type_ignores=[])
    namespace = {"os": os, "json": json, "re": re, "MAX_IMAGES": 9, "MAX_VIDEOS": 3, "MAX_AUDIOS": 3,
                 "FPS": 24, "ASSET_SUBFOLDER": "cglide", "LEGACY_ASSET_SUBFOLDERS": ("whatdreamscost",),
                 "folder_paths": types.SimpleNamespace(get_input_directory=lambda: input_root, get_temp_directory=lambda: temp_root)}
    exec(compile(selected, str(ROOT / "csglide_cast.py"), "exec"), namespace)
    return namespace


class CaptureTests(unittest.TestCase):
    def test_exact_final_frame_pixels_dimensions_and_source_immutability(self):
        with tempfile.TemporaryDirectory() as folder:
            images = torch.zeros((3, 32, 48, 3), device="cpu")
            images[-1, ..., 0] = 1
            images[-1, ..., 1] = 128 / 255
            before = images.clone()
            frame = carry.save_final_frame(images, folder, TOKEN)
            pixels = np.array(Image.open(Path(folder) / frame["subfolder"] / frame["filename"]))
            self.assertEqual(pixels.shape, (32, 48, 3))
            self.assertTrue(np.all(pixels == [255, 128, 0]))
            self.assertTrue(torch.equal(images, before))
            self.assertEqual(frame["frames"], 3)
            self.assertEqual(frame["version"], TOKEN)
            with self.assertRaisesRegex(ValueError, "already exists"):
                carry.save_final_frame(images, folder, TOKEN)
            self.assertEqual(len(list((Path(folder) / frame["subfolder"]).iterdir())), 1)

    def test_rejects_invalid_tokens_empty_non_rgb_and_nonfinite_frames(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "identity"):
                carry.save_final_frame(torch.zeros((1, 2, 2, 3)), folder, "../../outside")
            for shape in [(0, 2, 2, 3), (1, 2, 2, 4), (2, 2, 3)]:
                with self.assertRaisesRegex(ValueError, "nonempty decoded"):
                    carry.save_final_frame(torch.zeros(shape), folder, TOKEN)
            with self.assertRaisesRegex(ValueError, "non-finite"):
                carry.save_final_frame(torch.full((1, 2, 2, 3), float("nan")), folder, TOKEN)

    def test_temp_resolution_and_missing_or_escaping_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            frame = carry.save_final_frame(torch.zeros((1, 2, 2, 3)), folder, TOKEN)
            helpers = cast_helpers(folder, folder)
            resolve = helpers["_resolve_asset"]
            relative = f'{frame["subfolder"]}/{frame["filename"]}'
            self.assertEqual(resolve(relative + " [temp]"), str(Path(folder) / relative))
            Path(folder, "existing.png").write_bytes(b"unchanged-input")
            self.assertEqual(resolve("existing.png"), str(Path(folder) / "existing.png"))
            for ref in ["cglide-image-carry/missing.png [temp]", "cglide-image-carry/../existing.png [temp]", "../outside.png [temp]"]:
                with self.assertRaisesRegex(FileNotFoundError, "Re-render the preceding"):
                    resolve(ref)

    def test_sparse_slot_tokens_match_actual_conditioning_order_and_audio_trims(self):
        with tempfile.TemporaryDirectory() as folder:
            helpers = cast_helpers(folder, folder)
            cfg = helpers["parse_h3_data"]({"mode":"ref2va", "prompt":"original dialogue", "slots":{
                "images":[{"file":"identity.png"}, {"file":"cglide-image-carry/frame.png [temp]"}, {}, {"file":"wardrobe.png"}],
                "audios":[{"file":"voice.wav","start":3.125,"end":6.25}]}})
            tags, presentation = helpers["build_tag_map"](cfg, False, False)
            self.assertEqual(tags["@image2"], "<Picture 2>")
            self.assertEqual(tags["@image4"], "<Picture 3>")
            self.assertEqual(tags["@audio1"], "<Audio 1>")
            self.assertEqual(cfg["audios"][0]["start"], 3.125)
            self.assertEqual(cfg["audios"][0]["end"], 6.25)
            self.assertIsNone(cfg["cont"])
            self.assertEqual(helpers["transcribe_prompt"]("@image2 pose; @image4 clothes; @audio1 dialogue",tags,list(tags)),
                             "<Picture 2> pose; <Picture 3> clothes; <Audio 1> dialogue")

    def test_existing_join_bypasses_all_processing_when_no_source(self):
        spec = importlib.util.spec_from_file_location("image_carry_join_test", ROOT / "csglide_join.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        images = torch.rand((5, 4, 6, 3), device="cpu")
        audio = {"waveform": torch.zeros((1, 1, 2000)), "sample_rate": 24000}
        result = module.CSGlideJoin().join("", images, 0, "early_cut", 6, True, audio)
        self.assertIs(result[0], images)
        self.assertIs(result[1], audio)
        self.assertEqual(result[2:], (5, ""))


if __name__ == "__main__":
    unittest.main()
