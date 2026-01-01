import sys
import sqlite3
import json
from pathlib import Path
from array import array
import tempfile
import os

# Add data directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'data'))

import build_data


def _create_db(path, systems):
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.execute('CREATE TABLE systems (solarSystemId INTEGER PRIMARY KEY, name TEXT, centerX REAL, centerY REAL, centerZ REAL)')
    for sid, name in systems:
        cur.execute('INSERT INTO systems (solarSystemId, name, centerX, centerY, centerZ) VALUES (?, ?, 0, 0, 0)', (sid, name))
    con.commit()
    con.close()


def test_blackholes_from_csv_success(tmp_path):
    db = tmp_path / 'test.db'
    out = tmp_path / 'out'
    out.mkdir()
    # Create one system matching black hole id
    _create_db(str(db), [(5000001, 'BH-ONE')])

    csvf = tmp_path / 'bh.csv'
    csvf.write_text('5000001')

    argv = ['build_data.py', '--db', str(db), '--out', str(out), '--black-holes-csv', str(csvf)]
    sys_argv_backup = sys.argv
    sys.argv = argv
    try:
        build_data.main()
    finally:
        sys.argv = sys_argv_backup

    manifest = json.loads((out / 'manifest.json').read_text())
    assert manifest['counts']['systems_black_holes'] == 1
    # check binary contents
    data = (out / 'systems_black_holes.bin').read_bytes()
    # array of uint32 little endian
    assert len(data) >= 4


def test_blackholes_from_csv_missing_should_fail(tmp_path):
    db = tmp_path / 'test.db'
    out = tmp_path / 'out'
    out.mkdir()
    # create system with id 1, csv contains 999
    _create_db(str(db), [(1, 'S1')])
    csvf = tmp_path / 'bh.csv'
    csvf.write_text('999')

    argv = ['build_data.py', '--db', str(db), '--out', str(out), '--black-holes-csv', str(csvf)]
    sys_argv_backup = sys.argv
    sys.argv = argv
    try:
        try:
            build_data.main()
            assert False, "Expected SystemExit due to missing black hole ID"
        except SystemExit as e:
            assert e.code == 1
    finally:
        sys.argv = sys_argv_backup


def test_blackholes_from_table_success(tmp_path):
    db = tmp_path / 'test.db'
    out = tmp_path / 'out'
    out.mkdir()
    # create system
    _create_db(str(db), [(6000001, 'BH-TABLE')])

    con = sqlite3.connect(str(db))
    cur = con.cursor()
    cur.execute('CREATE TABLE BlackHoles (solarSystemId INTEGER)')
    cur.execute('INSERT INTO BlackHoles (solarSystemId) VALUES (?)', (6000001,))
    con.commit()
    con.close()

    argv = ['build_data.py', '--db', str(db), '--out', str(out), '--black-holes-table', 'BlackHoles']
    sys_argv_backup = sys.argv
    sys.argv = argv
    try:
        build_data.main()
    finally:
        sys.argv = sys_argv_backup

    manifest = json.loads((out / 'manifest.json').read_text())
    assert manifest['counts']['systems_black_holes'] == 1
