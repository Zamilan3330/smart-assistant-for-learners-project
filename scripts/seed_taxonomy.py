#!/usr/bin/env python3
"""
Taxonomy seed script
Reads taxonomy/it.yaml and inserts into PostgreSQL.

Tables populated (in order):
  domains → bok_sources → knowledge_areas → ka_source_mappings
  → knowledge_units → topics → learning_outcomes

Usage:
  pip install psycopg2-binary pyyaml
  python scripts/seed_taxonomy.py
"""

import os
import yaml
import psycopg2
from urllib.parse import urlparse
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_env(env_path: Path):
    """Minimal .env loader — no extra dependencies needed."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), val)


def parse_db_url(url: str) -> dict:
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "dbname": p.path.lstrip("/"),
        "user": p.username,
        "password": p.password,
    }


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

def seed(cur, data: dict):
    domain_data = data["domain"]
    sources_data = domain_data.get("sources", [])
    kas_data = data.get("knowledge_areas", [])

    # ------------------------------------------------------------------
    # 1. Domain
    # ------------------------------------------------------------------
    cur.execute(
        """
        INSERT INTO domains (code, name, description, version)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (code) DO UPDATE
            SET name        = EXCLUDED.name,
                description = EXCLUDED.description,
                version     = EXCLUDED.version
        RETURNING id
        """,
        (
            domain_data["id"],
            domain_data["name"],
            (domain_data.get("description") or "").strip(),
            data.get("version", 1),
        ),
    )
    domain_id = cur.fetchone()[0]
    print(f"✓ Domain: {domain_data['id']}  →  id={domain_id}")

    # ------------------------------------------------------------------
    # 2. BOK Sources
    # ------------------------------------------------------------------
    source_id_map: dict[str, int] = {}
    for src in sources_data:
        cur.execute(
            """
            INSERT INTO bok_sources (source_code, source_name, description)
            VALUES (%s, %s, %s)
            ON CONFLICT (source_code) DO UPDATE
                SET source_name = EXCLUDED.source_name,
                    description = EXCLUDED.description
            RETURNING id
            """,
            (src["name"], src["name"], src.get("description", "").strip()),
        )
        src_id = cur.fetchone()[0]
        source_id_map[src["name"]] = src_id
        print(f"  ✓ BokSource: {src['name']}  →  id={src_id}")

    # ------------------------------------------------------------------
    # 3. Knowledge Areas
    # ------------------------------------------------------------------
    for ka_idx, ka in enumerate(kas_data):
        cur.execute(
            """
            INSERT INTO knowledge_areas
                (domain_id, ka_code, name, description, is_core, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (ka_code) DO UPDATE
                SET name        = EXCLUDED.name,
                    description = EXCLUDED.description,
                    is_core     = EXCLUDED.is_core,
                    sort_order  = EXCLUDED.sort_order
            RETURNING id
            """,
            (
                domain_id,
                ka["id"],
                ka["name"],
                (ka.get("description") or "").strip(),
                bool(ka.get("core", False)),
                ka_idx,
            ),
        )
        ka_id = cur.fetchone()[0]
        core_tag = "[core]" if ka.get("core") else ""
        print(f"\n  ✓ KA {ka['id']}  {core_tag}  {ka['name']}  →  id={ka_id}")

        # --------------------------------------------------------------
        # 3a. KA ↔ Source mappings
        # --------------------------------------------------------------
        source_map: dict = ka.get("source_map") or {}
        for source_code, refs in source_map.items():
            if source_code not in source_id_map:
                print(f"     ⚠ Unknown source '{source_code}' — skipping")
                continue
            src_id = source_id_map[source_code]
            ref_list = refs if isinstance(refs, list) else [refs]
            for ref in ref_list:
                cur.execute(
                    """
                    INSERT INTO ka_source_mappings
                        (knowledge_area_id, source_id, source_reference)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (knowledge_area_id, source_id, source_reference)
                    DO NOTHING
                    """,
                    (ka_id, src_id, str(ref).strip()),
                )

        # --------------------------------------------------------------
        # 3b. Knowledge Units
        # --------------------------------------------------------------
        for ku_idx, ku in enumerate(ka.get("knowledge_units") or []):
            cur.execute(
                """
                INSERT INTO knowledge_units
                    (knowledge_area_id, ku_code, name, is_core, sort_order)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (ku_code) DO UPDATE
                    SET name       = EXCLUDED.name,
                        is_core    = EXCLUDED.is_core,
                        sort_order = EXCLUDED.sort_order
                RETURNING id
                """,
                (
                    ka_id,
                    ku["id"],
                    ku["name"],
                    bool(ku.get("core", False)),
                    ku_idx,
                ),
            )
            ku_id = cur.fetchone()[0]
            core_tag = "[core]" if ku.get("core") else ""
            print(f"    ✓ KU {ku['id']}  {core_tag}  {ku['name']}  →  id={ku_id}")

            # ----------------------------------------------------------
            # 3c. Topics  (no unique constraint → INSERT WHERE NOT EXISTS)
            # ----------------------------------------------------------
            for t_idx, topic in enumerate(ku.get("topics") or []):
                topic_str = str(topic).strip()
                cur.execute(
                    """
                    INSERT INTO topics (knowledge_unit_id, topic_name, sort_order)
                    SELECT %s, %s, %s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM topics
                        WHERE knowledge_unit_id = %s AND topic_name = %s
                    )
                    """,
                    (ku_id, topic_str, t_idx, ku_id, topic_str),
                )

            # ----------------------------------------------------------
            # 3d. Learning Outcomes  (no unique constraint → INSERT WHERE NOT EXISTS)
            # ----------------------------------------------------------
            for lo_idx, outcome in enumerate(ku.get("learning_outcomes") or []):
                outcome_str = str(outcome).strip()
                cur.execute(
                    """
                    INSERT INTO learning_outcomes
                        (knowledge_unit_id, outcome_text, sort_order)
                    SELECT %s, %s, %s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM learning_outcomes
                        WHERE knowledge_unit_id = %s AND outcome_text = %s
                    )
                    """,
                    (ku_id, outcome_str, lo_idx, ku_id, outcome_str),
                )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    project_root = Path(__file__).parent.parent
    load_env(project_root / ".env")

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set in .env")

    yaml_path = project_root / "taxonomy" / "it.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(f"YAML not found: {yaml_path}")

    with open(yaml_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    print(f"Connecting to database...")
    conn = psycopg2.connect(**parse_db_url(db_url))
    conn.autocommit = False
    cur = conn.cursor()

    try:
        seed(cur, data)
        conn.commit()
        print("\n✅  Taxonomy seed complete!")

        # Summary counts
        for table in [
            "domains", "bok_sources", "knowledge_areas",
            "ka_source_mappings", "knowledge_units", "topics", "learning_outcomes",
        ]:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"   {table}: {count} rows")

    except Exception as exc:
        conn.rollback()
        print(f"\n❌  Seed failed: {exc}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
