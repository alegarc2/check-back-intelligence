"""Smoke tests for Standard license column wiring (dashboard JS sources)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_standard_in_license_parser_and_mapper():
    license_js = (ROOT / "dashboard/lib/license-products.js").read_text(encoding="utf-8")
    mapper_js = (ROOT / "dashboard/lib/bia-workbook-mapper.js").read_text(encoding="utf-8")
    renderer_js = (ROOT / "dashboard/lib/bia-slide-renderer.js").read_text(encoding="utf-8")
    editor_js = (ROOT / "dashboard/lib/bia-slide-editor.js").read_text(encoding="utf-8")
    export_js = (ROOT / "dashboard/dashboard-export.js").read_text(encoding="utf-8")

    assert "licStandard" in license_js
    assert "std: 'Standard'" in license_js or "std: \"Standard\"" in license_js
    assert "licStandard: enriched['Lic Standard (used/entitled)']" in mapper_js
    assert "licStandard: lic.std" in mapper_js
    assert "['std', lic.std]" in renderer_js
    assert "Standard: 'Lic Standard (used/entitled)'" in editor_js
    assert "linkSubCell" in renderer_js
    assert "insight-link-label\">Subscription</span>" in renderer_js
    html_js = (ROOT / "dashboard/lib/html-utils.js").read_text(encoding="utf-8")
    editor_js = (ROOT / "dashboard/lib/bia-slide-editor.js").read_text(encoding="utf-8")
    assert "normalizeSubColumnValue" in html_js
    assert "col === 'Sub #'" in editor_js
    assert "normalizeSavedColumnValue" in editor_js
    assert "TREND_DISPLAY" in (ROOT / "dashboard/lib/constants.js").read_text(encoding="utf-8")
    assert "renderTrendsBlock" in renderer_js
    assert "bia-trend-label" in renderer_js
    assert "'Success Portal'," not in export_js.split("EXPORT_SKIP")[1].split(");")[0]


if __name__ == "__main__":
    test_standard_in_license_parser_and_mapper()
    print("ok test_standard_in_license_parser_and_mapper")
    print("all passed")
