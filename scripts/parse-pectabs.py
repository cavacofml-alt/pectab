#!/usr/bin/env python3
"""Parse DCS PAX.txt / ADD.txt pectab exports into data/pectabs.json.

Usage:
    python3 scripts/parse-pectabs.py PAX.txt ADD.txt > data/pectabs.json

Expected input format (one header line, then fixed-column-ish, whitespace
separated records; see the DCS's own HELP.txt for the field descriptions):

    pectab dir st len main add eq pax dest remarks
    P0101  PAX 3  400 305  12  Y  58  3    N
"""
import json
import sys

FIELDS = ["id", "dir", "st", "len", "main", "add", "eq", "pax", "dest", "remarks"]
INT_FIELDS = {"st", "len", "main", "add", "pax", "dest"}


def parse_file(path, expected_dir):
    records = []
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    header = lines[0].split()[:9]
    assert header == ["pectab", "dir", "st", "len", "main", "add", "eq", "pax", "dest"], (
        f"unexpected header in {path}: {header}"
    )

    for lineno, raw in enumerate(lines[1:], start=2):
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        tokens = line.split(None, 9)  # 10th token (if any) is the free-text remainder: remarks
        if len(tokens) < 9:
            print(f"WARN {path}:{lineno}: only {len(tokens)} tokens, skipping: {line!r}", file=sys.stderr)
            continue
        rec = dict(zip(FIELDS, tokens))
        if len(tokens) == 9:
            rec["remarks"] = ""
        for k in INT_FIELDS:
            rec[k] = int(rec[k])
        rec["eq"] = rec["eq"].strip().upper() == "Y"
        rec["remarks"] = rec["remarks"].strip()
        if rec["dir"] != expected_dir:
            print(f"WARN {path}:{lineno}: dir={rec['dir']} but file is meant to hold {expected_dir}", file=sys.stderr)
        records.append(rec)
    return records


def main():
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} PAX.txt ADD.txt", file=sys.stderr)
        sys.exit(1)

    pax = parse_file(sys.argv[1], "PAX")
    add = parse_file(sys.argv[2], "ADD")
    all_recs = pax + add

    ids = [r["id"] for r in all_recs]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        print(f"WARN duplicate ids across files: {sorted(dupes)}", file=sys.stderr)

    ordered = sorted(
        (
            {
                "id": r["id"],
                "dir": r["dir"],
                "st": r["st"],
                "len": r["len"],
                "pax": r["pax"],
                "main": r["main"],
                "add": r["add"],
                "eq": r["eq"],
                "dest": r["dest"],
                "remarks": r["remarks"],
            }
            for r in all_recs
        ),
        key=lambda r: r["id"],
    )

    print(json.dumps(ordered, indent=2, ensure_ascii=False))

    print(f"TOTAL: {len(ordered)} (PAX={len(pax)} ADD={len(add)})", file=sys.stderr)
    zero_len = [r["id"] for r in ordered if r["len"] == 0]
    if zero_len:
        print(f"NOTE: records with len=0 (placeholder/unused entries?): {zero_len}", file=sys.stderr)
    not_eq = [r["id"] for r in ordered if not r["eq"]]
    if not_eq:
        print(f"NOTE: records with eq=N (stubs not all equal size): {not_eq}", file=sys.stderr)
    sum_mismatch = [r["id"] for r in ordered if r["pax"] + r["main"] + r["st"] * r["add"] != r["len"]]
    if sum_mismatch:
        print(f"NOTE: records where pax+main+st*add != len ({len(sum_mismatch)}): {sum_mismatch}", file=sys.stderr)


if __name__ == "__main__":
    main()
