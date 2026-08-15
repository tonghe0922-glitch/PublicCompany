#!/usr/bin/env python3
from __future__ import annotations

import phase10_preparation_extract as extract

extract.PHASE_CODE = "PHASE-11"
extract.RANGE_LABEL = "P011–P016"
extract.RANGE_FILE_LABEL = "P011_P016"
extract.SCOPE_LABEL = "P011-P016 绩效成长福利"
extract.NEXT_PROCESS_BOUNDARY = "P017 and later processes remain out of scope."
extract.OUT_DIR = extract.ROOT / "docs" / "implementation" / "phases" / extract.PHASE_CODE
extract.OUT_JSON = extract.OUT_DIR / f"{extract.RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.json"
extract.OUT_MD = extract.OUT_DIR / f"{extract.RANGE_FILE_LABEL}_SOURCE_SNAPSHOT.md"
extract.TARGET_CODES = ("P011", "P012", "P013", "P014", "P015", "P016")
extract.GENERATOR_RELATIVE = "scripts/implementation/phase11_preparation_extract.py"

if __name__ == "__main__":
    extract.main()
