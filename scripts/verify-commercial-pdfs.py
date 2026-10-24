"""Check generated synthetic invoice PDFs with developer-only pypdf/pdfplumber; optionally render QA pages using Poppler."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import unicodedata

import pdfplumber
from pypdf import PdfReader


def normalized(value):
    """Normalize Arabic presentation glyphs only for assertions, never to rewrite an invoice."""
    return " ".join(unicodedata.normalize("NFKC", value).replace("\u200c", " ").split())


def validate(path, poppler_directory=None):
    """Validate paper, embedded fonts, Persian content, rows and final totals in one generated fixture."""
    match = re.search(r"(Sale|Proforma)-(A4|A5)-(2|65)\.pdf$", path.name)
    if not match:
        raise ValueError(f"Not a known synthetic fixture: {path}")
    kind, size, row_count = match.groups()
    reader = PdfReader(path)
    assert "evaluation" not in str(reader.metadata).lower(), f"Evaluation metadata in {path}"
    assert len(reader.pages) > 1 if row_count == "65" else len(reader.pages) >= 1
    expected_dimensions = (595, 842) if size == "A4" else (420, 595)
    font_names = set()
    texts = []
    for page in reader.pages:
        assert all(abs(float(value) - expected) <= 1 for value, expected in zip((page.mediabox.width, page.mediabox.height), expected_dimensions))
        text = normalized(page.extract_text() or "")
        assert "\ufffd" not in text, f"Replacement glyph in {path}"
        assert "فاکتور فروش" in text if kind == "Sale" else "پیش فاکتور" in text
        if "کیف دوشی" in text:
            assert "قیمت واحد" in text, f"Missing repeated table header in {path}"
        texts.append(text)
        for reference in page["/Resources"]["/Font"].values():
            font = reference.get_object()
            font_names.add(str(font["/BaseFont"]))
            assert "Vazirmatn" in str(font["/BaseFont"]), f"Unexpected fallback font in {path}"
            descendants = font.get("/DescendantFonts") or [font]
            for descendant in descendants:
                descriptor = descendant.get_object()["/FontDescriptor"]
                assert any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")), f"Unembedded font in {path}"
    assert " ".join(texts).count("کیف دوشی") == int(row_count), f"Missing/repeated product row in {path}"
    assert "مبلغ نهایی" in texts[-1], f"Terms orphaned from totals in {path}"
    assert "تومان" in texts[-1] and "کرایه" in texts[-1]
    expected_total = int(row_count) * 1242000 + 60000 if path.name.startswith("community-linux-") else int(row_count) * 1250000
    total_text = f"{expected_total:,}".translate(str.maketrans("0123456789,", "۰۱۲۳۴۵۶۷۸۹٬"))
    # PDF text extraction may return RTL numeral runs in visual rather than logical order.
    assert total_text in texts[-1] or total_text[::-1] in texts[-1], f"Incorrect/missing final amount in {path}"
    if kind == "Proforma":
        assert "تضمین قیمت" in texts[-1]
    else:
        assert "ثبت قطعی" in texts[-1]
    with pdfplumber.open(path) as document:
        for page in document.pages:
            assert page.chars, f"Empty page in {path}"
            assert all(c["x0"] >= -1 and c["x1"] <= page.width + 1 and c["top"] >= -1 and c["bottom"] <= page.height + 1 for c in page.chars), f"Text outside physical page in {path}"
    if poppler_directory:
        executable = Path(poppler_directory) / ("pdftoppm.exe" if (Path(poppler_directory) / "pdftoppm.exe").exists() else "pdftoppm")
        render_directory = path.parent / "rendered"
        render_directory.mkdir(exist_ok=True)
        for page_number in sorted({1, (len(reader.pages) + 1) // 2, len(reader.pages)}):
            subprocess.run([str(executable), "-f", str(page_number), "-l", str(page_number), "-scale-to", "1200", "-png", "-singlefile", str(path), str(render_directory / f"{path.stem}-page-{page_number}")], check=True)
    return {"file": path.name, "pages": len(reader.pages), "paper": size, "rows": int(row_count), "fonts": sorted(font_names), "status": "passed"}


def main():
    """Run reproducible assertions against an explicit fixture directory; never read application databases."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--poppler-directory")
    args = parser.parse_args()
    files = sorted(args.directory.glob("*.pdf"))
    if len(files) != 8:
        raise ValueError(f"Expected the eight fixture variants, got {len(files)}")
    results = [validate(path, args.poppler_directory) for path in files]
    (args.directory / "verification.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
