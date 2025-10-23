import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else 'data/static.db'
con = sqlite3.connect(db_path)
cur = con.cursor()

# Get tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables: {tables}\n")

# Check first table
if tables:
    t = tables[0]
    cur.execute(f"PRAGMA table_info({t})")
    cols = [r[1] for r in cur.fetchall()]
    print(f"Table '{t}' columns: {cols}")
    
    cur.execute(f"SELECT * FROM {t} LIMIT 3")
    rows = cur.fetchall()
    print(f"Sample rows from '{t}':")
    for row in rows:
        print(f"  {row}")
    
    # Check if position columns exist
    pos_cols = [c for c in cols if any(x in c.lower() for x in ['x', 'y', 'z', 'center', 'pos'])]
    if pos_cols:
        print(f"\nPosition-related columns: {pos_cols}")
        cur.execute(f"SELECT {', '.join(pos_cols[:3])} FROM {t} WHERE {pos_cols[0]} != 0 LIMIT 3")
        print(f"Non-zero position samples:")
        for row in cur.fetchall():
            print(f"  {row}")

con.close()
