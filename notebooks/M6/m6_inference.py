"""
Compatibility shim — the inference wrapper moved to backend/inference.py as
part of the M7-T1 restructuring (backend code lives under backend/). This
file re-exports it unchanged so the M6-T6/T9/T10 notebooks keep working
without modification or duplicated logic.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from inference import *  # noqa: F401,F403
