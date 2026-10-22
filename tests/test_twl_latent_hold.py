"""Exercise upstream latent hold on CPU without importing the node package or models."""
import ast
import os
from pathlib import Path
import tempfile
import types
import unittest
import torch
from safetensors.torch import save_file

class Nested:
    def __init__(self, tensors): self.tensors = tensors
    def unbind(self): return self.tensors

class LatentHoldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tree=ast.parse((Path(__file__).parents[1]/'csglide_cast.py').read_text(encoding='utf-8'))
        node=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='CSGlideCast')
        method=next(n for n in node.body if isinstance(n,ast.FunctionDef) and n.name=='_latent_hold')
        functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['video_latent_t','snap_guide_run']]
        cls.env={'torch':torch,'os':os,'comfy':types.SimpleNamespace(nested_tensor=types.SimpleNamespace(NestedTensor=Nested)),
                 'MIN_REF_FRAMES':5,'FPS':24,'AUDIO_LATENT_FPS':40}
        exec(compile(ast.Module(body=functions+[method],type_ignores=[]),'actual_latent_hold','exec'),cls.env)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.path=str(Path(self.tmp.name)/'previous.h3latent');self.env['_find_latent_sidecar']=lambda cont:self.path if os.path.exists(self.path) else None
        self.current={'samples':Nested((torch.zeros((1,4,17,2,2)),torch.zeros((1,4,1,120))))}
        self.config={'cont':{'file':'previous.mkv','frames':22,'audio':False}}
        self.previous=torch.rand((1,4,12,2,2),generator=torch.Generator().manual_seed(1))

    def hold(self): return self.env['_latent_hold'](None,self.config,None,self.current,56)

    def test_saved_tail_is_copied_exactly_and_only_the_overlap_is_held(self):
        save_file({'video':self.previous},self.path)
        held,overlap,_=self.hold();v,a=held['samples'].unbind();mask,_=held['noise_mask'].unbind()
        self.assertEqual(overlap,22);self.assertTrue(torch.equal(v[:,:,:7],self.previous[:,:,-7:]));self.assertTrue(torch.equal(v[:,:,7:],torch.zeros_like(v[:,:,7:])))
        self.assertEqual(mask[:,:,:7].count_nonzero().item(),0);self.assertTrue(torch.all(mask[:,:,7:]==1));self.assertTrue(torch.equal(a,self.current['samples'].unbind()[1]))
        self.assertEqual(self.current['samples'].unbind()[0].count_nonzero().item(),0)

    def test_missing_sidecar_falls_back(self): self.assertIsNone(self.hold())

    def test_incompatible_canvas_falls_back(self):
        save_file({'video':torch.zeros((1,4,12,3,2))},self.path);self.assertIsNone(self.hold())

if __name__=='__main__': unittest.main()
