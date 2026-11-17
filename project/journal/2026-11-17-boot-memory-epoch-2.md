# Account for cold boot memory

> Written by: Codex
> **State:** 2026-11-17, MEMORY-GATES MG5 and MG6 (J408).

Model the simultaneous transport and decode allocations separately
from the shader and paint upload phase. Count retained far slab indices
and paint mip arrays in residence. The model now uses epoch 2.

The 168 MB compiler allowance comes from Nine’s calibrated early
shader step. Late GPU growth remains outside that estimate. Keep the
engine format pin held while the measured peaks or estimates exceed
1.5 GB and collect new runtime readings before releasing this model.
