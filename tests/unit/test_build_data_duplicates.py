import sqlite3
import sys
from pathlib import Path

# Add data directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "data"))

import build_data


def _create_db_with_duplicates(path):
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.execute(
        "CREATE TABLE systems (solarSystemId INTEGER PRIMARY KEY, name TEXT, centerX REAL, centerY REAL, centerZ REAL)"
    )
    # Insert duplicate IDs
    cur.execute(
        "INSERT INTO systems (solarSystemId, name, centerX, centerY, centerZ) VALUES (?, ?, 0, 0, 0)",
        (1, "S1"),
    )
    cur.execute(
        "INSERT INTO systems (solarSystemId, name, centerX, centerY, centerZ) VALUES (?, ?, 0, 0, 0)",
        (1, "S1-dup"),
    )
    con.commit()
    con.close()


def test_duplicate_system_ids_fail(tmp_path, capsys):
    db = tmp_path / "dup.db"
    out = tmp_path / "out"
    out.mkdir()
    _create_db_with_duplicates(str(db))

    argv = ["build_data.py", "--db", str(db), "--out", str(out)]
    sys_argv_backup = sys.argv
    sys.argv = argv
    try:
        try:
            build_data.main()
            assert False, "Expected SystemExit due to duplicate IDs"
        except SystemExit as e:
            assert e.code == 1
            captured = capsys.readouterr()
            assert "Duplicate" in captured.err or "duplicate" in captured.err
    finally:
        sys.argv = sys_argv_backup
