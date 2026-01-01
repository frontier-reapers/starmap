#!/usr/bin/env python3

"""
build_data.py — Extracts systems and jumps from an SQLite DB, converts meters→light-years,
applies Rx(-90°) coordinate transform (x,y,z)->(x,z,-y), and writes compact binary assets.

Usage:
  python build_data.py --db path/to/static.db --out ./public/data

Optional overrides (auto-detected by default):
  --systems-table SolarSystems
  --sys-id-col solarSystemId
  --sys-name-col name
  --sys-x-col centerX --sys-y-col centerY --sys-z-col centerZ

  --jumps-table Jumps
  --jump-from-col fromSystemId
  --jump-to-col   toSystemId
    --release e6c4
"""
import argparse, json, array, re, sys
from pathlib import Path

# Try to import sqlite3, fall back to pysqlite3 if the built-in is missing
try:
    import sqlite3
except ImportError:
    import pysqlite3 as sqlite3

METERS_PER_LY = 9.4607304725808e15  # IAU light-year

def is_filtered_system(name):
    """Returns True if system should be filtered out (V-### or AD### patterns)"""
    # Match V-### (e.g., V-001, V-123)
    if re.match(r'^V-\d{3}$', name, re.IGNORECASE):
        return True
    # Match AD### (e.g., AD001, AD123)
    if re.match(r'^AD\d{3}$', name, re.IGNORECASE):
        return True
    return False

def infer_table(cur, needle_keywords):
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in cur.fetchall()]
    for t in tables:
        tl = t.lower()
        if any(k in tl for k in needle_keywords):
            return t
    return tables[0] if tables else None

def get_cols(cur, table):
    cur.execute(f"PRAGMA table_info({table});")
    return [r[1] for r in cur.fetchall()]

def find_col(cols, candidates):
    cl = [c.lower() for c in cols]
    for cand in candidates:
        for i, c in enumerate(cl):
            if cand == c:
                return cols[i]
    return None

def transform_xyz(xm, ym, zm):
    """Meters to light-years, then Rx(-90°): (x, y, z) -> (x, z, -y)."""
    xly = float(xm) / METERS_PER_LY
    yly = float(ym) / METERS_PER_LY
    zly = float(zm) / METERS_PER_LY
    return (xly, zly, -yly)


def validate_assets(ids, positions, jumps, station_ids, black_hole_ids, valid_system_ids):
    """Return a list of validation error strings for built assets."""
    issues = []

    # positions are 3-component vectors; ensure count matches ids
    pos_len = len(positions)
    if pos_len % 3 != 0:
        issues.append(f"positions length {pos_len} is not divisible by 3")
    pos_count = pos_len // 3
    id_count = len(ids)
    if pos_count != id_count:
        issues.append(f"positions count ({pos_count}) does not match ids count ({id_count})")

    # Jumps must only reference known systems
    invalid_jumps = [(a, b) for (a, b) in jumps if a not in valid_system_ids or b not in valid_system_ids]
    if invalid_jumps:
        sample = invalid_jumps[:5]
        issues.append(f"{len(invalid_jumps)} jumps reference missing systems (examples: {sample})")

    # Station systems must exist
    invalid_station_ids = [sid for sid in station_ids if sid not in valid_system_ids]
    if invalid_station_ids:
        sample = invalid_station_ids[:5]
        issues.append(f"{len(invalid_station_ids)} station system IDs are missing from systems (examples: {sample})")

    # Black hole systems must exist
    invalid_black_hole_ids = [sid for sid in black_hole_ids if sid not in valid_system_ids]
    if invalid_black_hole_ids:
        sample = invalid_black_hole_ids[:5]
        issues.append(f"{len(invalid_black_hole_ids)} black hole IDs are missing from systems (examples: {sample})")

    return issues

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Path to SQLite database")
    ap.add_argument("--out", default="./public/data", help="Output directory for asset files")
    # Optional overrides
    ap.add_argument("--systems-table")
    ap.add_argument("--sys-id-col")
    ap.add_argument("--sys-name-col")
    ap.add_argument("--sys-x-col")
    ap.add_argument("--sys-y-col")
    ap.add_argument("--sys-z-col")
    ap.add_argument("--jumps-table")
    ap.add_argument("--jump-from-col")
    ap.add_argument("--jump-to-col")
    ap.add_argument("--black-holes-csv", help="CSV file with one or more system IDs (one per line or comma-separated) for black holes")
    ap.add_argument("--black-holes-table", help="SQLite table name that contains black hole system IDs")
    ap.add_argument("--black-holes-col", help="Column name in --black-holes-table containing the system ID (defaults to detected column)")
    ap.add_argument("--release", help="Data release label (e.g., e6c4)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    systems_table = args.systems_table or infer_table(cur, ["system"])
    jumps_table   = args.jumps_table   or infer_table(cur, ["jump","gate","link"])

    if not systems_table:
        raise SystemExit("Could not find systems table; use --systems-table to specify.")

    sys_cols = get_cols(cur, systems_table)
    id_col   = args.sys_id_col   or find_col(sys_cols, ["id","system_id","solarsystemid","smart_object_id"]) or sys_cols[0]
    name_col = args.sys_name_col or find_col(sys_cols, ["name","system_name","label"])
    x_col    = args.sys_x_col    or find_col(sys_cols, ["x","posx","position_x","world_x","centerx"])
    y_col    = args.sys_y_col    or find_col(sys_cols, ["y","posy","position_y","world_y","centery"])
    z_col    = args.sys_z_col    or find_col(sys_cols, ["z","posz","position_z","world_z","centerz"])

    # Load systems
    cols = [id_col]
    if name_col: cols.append(name_col)
    if x_col: cols.append(x_col)
    if y_col: cols.append(y_col)
    if z_col: cols.append(z_col)
    cur.execute(f"SELECT {', '.join(cols)} FROM {systems_table}")
    systems = []
    filtered_count = 0
    for row in cur.fetchall():
        sid = row[id_col]
        nm = row[name_col] if (name_col and name_col in row.keys()) else str(sid)
        
        # Filter out V-### and AD### systems
        if is_filtered_system(nm):
            filtered_count += 1
            continue
        
        xv = float(row[x_col]) if x_col else 0.0
        yv = float(row[y_col]) if y_col else 0.0
        zv = float(row[z_col]) if z_col else 0.0
        systems.append((int(sid), nm, xv, yv, zv))

    # Detect duplicate system IDs early to avoid downstream indexing bugs
    seen = {}
    duplicates = []
    for sid, nm, x, y, z in systems:
        if sid in seen:
            duplicates.append(sid)
        else:
            seen[sid] = nm
    if duplicates:
        sample = duplicates[:5]
        print("ERROR: Duplicate or non-unique system IDs detected:", file=sys.stderr)
        print(f" - {len(duplicates)} duplicate IDs (examples: {sample})", file=sys.stderr)
        raise SystemExit(1)

    # Load systems with NPC stations
    station_systems = set()
    try:
        cur.execute("SELECT DISTINCT solarSystemId FROM NpcStations WHERE solarSystemId IS NOT NULL")
        for row in cur.fetchall():
            station_systems.add(int(row[0]))
        print(f"Found {len(station_systems)} systems with NPC stations", file=__import__('sys').stderr)
    except Exception as e:
        print(f"Warning: Could not load NPC stations: {e}", file=__import__('sys').stderr)

    # Load jumps
    jumps = []
    if jumps_table:
        jmp_cols = get_cols(cur, jumps_table)
        def contains(parts):
            jl = [c.lower() for c in jmp_cols]
            for idx, c in enumerate(jl):
                if all(p in c for p in parts):
                    return jmp_cols[idx]
            return None
        source_col = args.jump_from_col or contains(["from","id"]) or contains(["a","id"]) or contains(["source"])
        target_col = args.jump_to_col   or contains(["to","id"])   or contains(["b","id"]) or contains(["target"])
        if source_col and target_col:
            cur.execute(f"SELECT {source_col} as s, {target_col} as t FROM {jumps_table}")
            for r in cur.fetchall():
                if r["s"] is not None and r["t"] is not None:
                    jumps.append((int(r["s"]), int(r["t"])))

    # We'll close the DB connection after optionally reading black holes from a table

    # Build set of valid system IDs for jump filtering
    valid_system_ids = {sid for sid, _, _, _, _ in systems}

    # Build arrays
    ids = array.array('I')
    positions = array.array('f')
    names = {}
    station_ids = array.array('I')  # IDs of systems with stations

    for sid, nm, x, y, z in systems:
        ids.append(sid)
        names[str(sid)] = nm
        xt, yt, zt = transform_xyz(x, y, z)
        positions.extend([xt, yt, zt])
        
        # Track systems with stations
        if sid in station_systems:
            station_ids.append(sid)

    # Black hole systems (can be provided via CSV or SQLite table; fall back to hardcoded IDs)
    black_hole_ids_values = []
    if args.black_holes_csv:
        csv_path = Path(args.black_holes_csv)
        if not csv_path.exists():
            print(f"Error: black holes CSV not found: {csv_path}", file=sys.stderr)
            raise SystemExit(1)
        try:
            text = csv_path.read_text()
            # split by lines and commas, tolerate whitespace
            parts = [p.strip() for ln in text.splitlines() for p in ln.split(',')]
            for p in parts:
                if not p:
                    continue
                black_hole_ids_values.append(int(p))
        except Exception as e:
            print(f"Error parsing black holes CSV: {e}", file=sys.stderr)
            raise SystemExit(1)
    elif args.black_holes_table:
        try:
            # need an active DB cursor; use the existing connection
            bh_table = args.black_holes_table
            bh_cols = get_cols(cur, bh_table)
            bh_col = args.black_holes_col or find_col(bh_cols, ["solarSystemId","system_id","id","solar_system_id"]) or bh_cols[0]
            cur.execute(f"SELECT DISTINCT {bh_col} FROM {bh_table} WHERE {bh_col} IS NOT NULL")
            for r in cur.fetchall():
                black_hole_ids_values.append(int(r[0]))
        except Exception as e:
            print(f"Error reading black holes table '{args.black_holes_table}': {e}", file=sys.stderr)
            raise SystemExit(1)
    else:
        black_hole_ids_values = [30000001, 30000002, 30000003]

    # We can safely close DB connection now
    con.close()

    black_hole_ids = array.array('I', black_hole_ids_values)

    # Validate built data before writing to disk
    issues = validate_assets(ids, positions, jumps, station_ids, black_hole_ids, valid_system_ids)
    if issues:
        print("Data validation failed:", file=sys.stderr)
        for msg in issues:
            print(f"- {msg}", file=sys.stderr)
        raise SystemExit(1)

    # Flatten jumps (validated) to binary array
    flat_jumps = array.array('I')
    for a, b in jumps:
        flat_jumps.extend([a, b])

    filtered_jumps = 0  # validation enforces all jumps are valid

    # Write assets
    (out_dir / "systems_positions.bin").write_bytes(positions.tobytes())
    (out_dir / "systems_ids.bin").write_bytes(ids.tobytes())
    (out_dir / "systems_names.json").write_text(json.dumps(names, ensure_ascii=False))
    (out_dir / "jumps.bin").write_bytes(flat_jumps.tobytes())
    (out_dir / "systems_with_stations.bin").write_bytes(station_ids.tobytes())
    (out_dir / "systems_black_holes.bin").write_bytes(black_hole_ids.tobytes())

    manifest = {
        "counts": {
            "systems": len(systems),
            "jumps": len(jumps),
            "systems_with_stations": len(station_ids),
            "systems_black_holes": len(black_hole_ids)
        },
        "schema": {
            "systems_positions.bin": {"type":"Float32Array","components":3},
            "systems_ids.bin": {"type":"Uint32Array"},
            "systems_names.json": {"type":"MapIdToName"},
            "jumps.bin": {"type":"Uint32Array","components":2,"meaning":"pairs of system IDs [a,b]"},
            "systems_with_stations.bin": {"type":"Uint32Array","meaning":"IDs of systems with NPC stations"},
            "systems_black_holes.bin": {"type":"Uint32Array","meaning":"IDs of black hole systems"}
        },
        "coord_system": {
            "units": "lightyears",
            "transform": "Rx(-90deg), i.e., (x,y,z)->(x,z,-y)"
        }
    }
    if args.release:
        manifest["release"] = args.release
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(json.dumps({
        "systems_table": systems_table,
        "jumps_table": jumps_table,
        "systems_count": len(systems),
        "filtered_systems": filtered_count,
        "systems_with_stations": len(station_ids),
        "systems_black_holes": len(black_hole_ids),
        "jumps_count": len(flat_jumps) // 2,
        "filtered_jumps": filtered_jumps,
        "release": args.release,
        "out": str(out_dir.resolve())
    }, indent=2))

if __name__ == "__main__":
    main()
