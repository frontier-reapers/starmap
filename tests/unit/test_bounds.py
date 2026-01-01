"""Unit tests for compute_bounds helper in build_data.py"""

import math
import sys
from array import array
from pathlib import Path

# Add data directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "data"))

from build_data import compute_bounds


def test_compute_bounds_empty():
    positions = array("f")
    b = compute_bounds(positions)
    assert b["center"] == [0.0, 0.0, 0.0]
    assert b["radius"] == 0.0


def test_compute_bounds_single_point():
    positions = array("f", [1.0, 2.0, 3.0])
    b = compute_bounds(positions)
    assert b["min"] == [1.0, 2.0, 3.0]
    assert b["max"] == [1.0, 2.0, 3.0]
    assert b["center"] == [1.0, 2.0, 3.0]
    assert b["radius"] == 0.0


def test_compute_bounds_collinear_points():
    # points along x axis
    positions = array("f", [0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 20.0, 0.0, 0.0])
    b = compute_bounds(positions)
    assert b["min"] == [0.0, 0.0, 0.0]
    assert b["max"] == [20.0, 0.0, 0.0]
    assert b["center"] == [10.0, 0.0, 0.0]
    # furthest distance is 10 from center
    assert math.isclose(b["radius"], 10.0)


def test_compute_bounds_varied_points():
    positions = array("f", [0.0, 0.0, 0.0, 3.0, 4.0, 0.0])
    b = compute_bounds(positions)
    # center should be (1.5, 2.0, 0.0)
    assert all(abs(a - b_) < 1e-6 for a, b_ in zip([1.5, 2.0, 0.0], b["center"]))
    # radius should be distance from center to (3,4,0) ~ sqrt((1.5)^2+(2)^2) = 2.5
    assert math.isclose(b["radius"], 2.5)
