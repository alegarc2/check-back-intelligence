"""Ensure code headers match samples/check_back_template_v1.xlsx."""

import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.workbook.check_back_template import (  # noqa: E402
    CHECK_BACK_HEADERS,
    GYR_COL,
    detect_header_row,
    repair_v1_template,
)

V1 = ROOT / "samples" / "check_back_template_v1.xlsx"


def _read_xlsx_headers() -> list[str]:
    wb = openpyxl.load_workbook(V1, read_only=True)
    ws = wb.active
    header_row = detect_header_row(ws)
    headers = [
        str(c.value).strip()
        for c in ws[header_row]
        if c.value is not None and str(c.value).strip()
    ]
    wb.close()
    return headers


def test_v1_template_matches_check_back_headers():
    repair_v1_template(V1)
    xlsx_headers = _read_xlsx_headers()
    assert xlsx_headers == CHECK_BACK_HEADERS
    assert CHECK_BACK_HEADERS[0] == "Account Name"
    assert CHECK_BACK_HEADERS[-1] == "Recommended Actions"
    assert "Success Portal" in CHECK_BACK_HEADERS
    assert GYR_COL in CHECK_BACK_HEADERS


def test_success_portal_exportable():
    export_path = ROOT / "dashboard" / "dashboard-export.js"
    export_src = export_path.read_text(encoding="utf-8")
    skip_block = export_src.split("EXPORT_SKIP")[1].split(");")[0]
    assert "'Success Portal'," not in skip_block
    assert "Success Portal" in (ROOT / "dashboard" / "lib" / "constants.js").read_text(encoding="utf-8")


def test_recommended_actions_exportable():
    export_path = ROOT / "dashboard" / "dashboard-export.js"
    export_src = export_path.read_text(encoding="utf-8")
    skip_block = export_src.split("EXPORT_SKIP")[1].split(");")[0]
    assert "'Recommended Actions'," not in skip_block
    assert "Recommended Actions" in (ROOT / "dashboard" / "lib/constants.js").read_text(encoding="utf-8")


if __name__ == "__main__":
    test_v1_template_matches_check_back_headers()
    print("ok test_v1_template_matches_check_back_headers")
    test_success_portal_exportable()
    print("ok test_success_portal_exportable")
    test_recommended_actions_exportable()
    print("ok test_recommended_actions_exportable")
    print("all passed")
