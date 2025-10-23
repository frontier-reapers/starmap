"""
Unit tests for build_data.py coordinate transformation and data processing
"""
import sys
from pathlib import Path

# Add data directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'data'))

from build_data import transform_xyz, METERS_PER_LY


def test_transform_xyz_origin():
    """Test that origin (0,0,0) remains at origin after transform"""
    x, y, z = transform_xyz(0, 0, 0)
    assert x == 0.0
    assert y == 0.0
    assert z == 0.0


def test_transform_xyz_meters_to_lightyears():
    """Test conversion from meters to light-years"""
    # 1 light-year in meters
    x, y, z = transform_xyz(METERS_PER_LY, 0, 0)
    assert abs(x - 1.0) < 1e-10  # Should be ~1 light-year
    assert y == 0.0
    assert z == 0.0


def test_transform_xyz_rotation():
    """Test Rx(-90°) rotation: (x,y,z) -> (x,z,-y)"""
    # Input: (1 LY, 2 LY, 3 LY) in meters
    x_m = METERS_PER_LY * 1.0
    y_m = METERS_PER_LY * 2.0
    z_m = METERS_PER_LY * 3.0
    
    x, y, z = transform_xyz(x_m, y_m, z_m)
    
    # Expected output after Rx(-90°): (x, z, -y) = (1, 3, -2)
    assert abs(x - 1.0) < 1e-10
    assert abs(y - 3.0) < 1e-10
    assert abs(z - (-2.0)) < 1e-10


def test_transform_xyz_negative_values():
    """Test transformation with negative coordinates"""
    x_m = -METERS_PER_LY * 5.0
    y_m = METERS_PER_LY * 10.0
    z_m = -METERS_PER_LY * 3.0
    
    x, y, z = transform_xyz(x_m, y_m, z_m)
    
    # Expected: (-5, -3, -10)
    assert abs(x - (-5.0)) < 1e-10
    assert abs(y - (-3.0)) < 1e-10
    assert abs(z - (-10.0)) < 1e-10


def test_meters_per_ly_constant():
    """Verify the METERS_PER_LY constant is correct"""
    # IAU definition: 1 ly = 9.4607304725808e15 meters
    assert METERS_PER_LY == 9.4607304725808e15
