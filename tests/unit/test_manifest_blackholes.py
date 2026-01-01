import json
import sqlite3
import sys
from pathlib import Path

# Add data directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "data"))

import build_data


def _create_db(path, systems):
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.execute(
        "CREATE TABLE systems (solarSystemId INTEGER PRIMARY KEY, name TEXT, centerX REAL, centerY REAL, centerZ REAL)"
    )
    for sid, name in systems:
        cur.execute(
            "INSERT INTO systems (solarSystemId, name, centerX, centerY, centerZ) VALUES (?, ?, 0, 0, 0)",
            (sid, name),
        )
    con.commit()
    con.close()


def test_manifest_includes_blackhole_counts(tmp_path):
    db = tmp_path / "test.db"
    out = tmp_path / "out"
    out.mkdir()

    # Create systems that include the black hole IDs we'll reference
    systems = [(8000001, "BH1"), (8000002, "BH2"), (1, "S1")]
    _create_db(str(db), systems)

    # Create a CSV listing two black holes present in the systems table
    csvf = tmp_path / "bh.csv"
    csvf.write_text("8000001,8000002")

    argv = [
        "build_data.py",
        "--db",
        str(db),
        "--out",
        str(out),
        "--black-holes-csv",
        str(csvf),
    ]
    sys_argv_backup = sys.argv
    sys.argv = argv
    try:
        build_data.main()
    finally:
        sys.argv = sys_argv_backup

    manifest = json.loads((out / "manifest.json").read_text())
    assert "counts" in manifest
    assert "systems_black_holes" in manifest["counts"]
    assert manifest["counts"]["systems_black_holes"] == 2
