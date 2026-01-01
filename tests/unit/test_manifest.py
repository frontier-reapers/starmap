"""Tests for manifest contents produced by build_data.py
"""

import json
import sqlite3
import sys
import subprocess
from pathlib import Path


def make_fixture_db(path):
    con = sqlite3.connect(path)
    cur = con.cursor()
    # Minimal SolarSystems table
    cur.execute(
        "CREATE TABLE SolarSystems (solarSystemId INTEGER PRIMARY KEY, name TEXT, centerX REAL, centerY REAL, centerZ REAL)"
    )
    # Insert two systems
    cur.execute(
        "INSERT INTO SolarSystems (solarSystemId, name, centerX, centerY, centerZ) VALUES (1, 'Alpha', 0, 0, 0)"
    )
    # Second system: use meters so transform applies
    # Use METERS_PER_LY via multiplication in code that calls script
    cur.execute(
        "INSERT INTO SolarSystems (solarSystemId, name, centerX, centerY, centerZ) VALUES (2, 'Beta', 94607304725808, 189214609451616, 283872914176424)"
    )

    # Minimal Jumps table
    cur.execute(
        "CREATE TABLE Jumps (fromSystemId INTEGER, toSystemId INTEGER)"
    )
    cur.execute("INSERT INTO Jumps (fromSystemId, toSystemId) VALUES (1, 2)")

    # Minimal NpcStations table
    cur.execute("CREATE TABLE NpcStations (solarSystemId INTEGER)")
    cur.execute("INSERT INTO NpcStations (solarSystemId) VALUES (1)")

    con.commit()
    con.close()


def test_manifest_contains_bounds_and_hash(tmp_path):
    db = tmp_path / "fixture.db"
    make_fixture_db(db)

    out = tmp_path / "out"
    out.mkdir()

    # Create a simple black holes CSV so validation passes
    bh = tmp_path / "blackholes.csv"
    bh.write_text("1,2")

    script = Path(__file__).parent.parent.parent / "data" / "build_data.py"

    # Run script with --hash to force blob sha256 computation
    subprocess.run(
        [
            sys.executable,
            str(script),
            "--db",
            str(db),
            "--out",
            str(out),
            "--hash",
            "--black-holes-csv",
            str(bh),
        ],
        check=True,
    )

    manifest_path = out / "manifest.json"
    assert manifest_path.exists()

    manifest = json.loads(manifest_path.read_text())

    # Bounds should exist with center and radius
    assert "bounds" in manifest
    assert "center" in manifest["bounds"]
    assert "radius" in manifest["bounds"]

    # Counts should contain both legacy and friendly keys
    assert "counts" in manifest
    counts = manifest["counts"]
    assert counts.get("systems") == 2
    assert counts.get("jumps") == 1
    assert counts.get("stations") == 1
    assert counts.get("black_holes") is not None

    # Blobs should contain sha256 entries when --hash passed
    assert "blobs" in manifest
    assert "systems_positions.bin" in manifest["blobs"]
    assert "sha256" in manifest["blobs"]["systems_positions.bin"]
