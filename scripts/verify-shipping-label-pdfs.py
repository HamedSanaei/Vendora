"""Validate synthetic A5 parcel-label fixtures; render pages with Poppler for visual inspection."""
import argparse
import json
import re
import shutil
import subprocess
import unicodedata
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


def normalize(value):
    """Normalize Persian extraction glyphs for assertions without modifying the PDF."""
    return " ".join(unicodedata.normalize("NFKC", value).replace("\u200c", " ").split())


def validate(file, render):
    """Check paper, exact page count/order, complete data, embedded fonts and absence of finance/overflow."""
    reader = PdfReader(file)
    expected = 3 if "multiple" in file.name else 1
    assert len(reader.pages) == expected, (file, len(reader.pages))
    fonts = set()
    for index, page in enumerate(reader.pages):
        assert abs(float(page.mediabox.width) - 419.53) < 1 and abs(float(page.mediabox.height) - 595.28) < 1
        text = normalize(page.extract_text() or "")
        assert f"VD-{100 + index}" in text, text
        assert "گیرنده آزمایشی فارسی" in text and "فروشگاه وندورا" in text, text
        assert "کد پستی" in text and "تلفن پشتیبانی" in text
        assert "پلاک" in text and "واحد" in text and "کرایه" in text
        for number in ["09121234567", "1234567890", "02112345678"]:
            assert number in re.sub(r"\s", "", text), (file, number, text)
        for private in ["قیمت", "فاکتور", "تومان", "987654321", "موجودی", "example.invalid"]:
            assert private not in text, (file, private)
        if index == 1:
            assert "تیپاکس" in text and "پرداخت هنگام تحویل" in text
        else:
            assert "پست پیشتاز" in text and "رایگان" in text
        if "long" in file.name:
            assert text.count("مجتمع وندورا") == 5, text
        for reference in page["/Resources"]["/Font"].values():
            font = reference.get_object()
            fonts.add(str(font["/BaseFont"]))
            assert "Vazirmatn" in str(font["/BaseFont"])
            for descendant in font.get("/DescendantFonts") or [font]:
                descriptor = descendant.get_object()["/FontDescriptor"]
                assert any(key in descriptor for key in ["/FontFile", "/FontFile2", "/FontFile3"])
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            assert page.chars
            assert all(c["x0"] >= 21 and c["x1"] <= page.width - 21 and c["top"] >= 21 and c["bottom"] <= page.height - 21 for c in page.chars)
    if render:
        executable = shutil.which("pdftoppm")
        if not executable:
            raise RuntimeError("Poppler pdftoppm is required for --render")
        directory = file.parent / "rendered"
        directory.mkdir(exist_ok=True)
        for number in range(1, expected + 1):
            subprocess.run([executable, "-f", str(number), "-l", str(number), "-scale-to", "1400", "-png", "-singlefile", str(file), str(directory / f"{file.stem}-{number}")], check=True)
    return {"file": file.name, "pages": expected, "paper": "A5 portrait", "fonts": sorted(fonts), "status": "passed"}


def main():
    """Inspect only explicitly generated test files, never application documents or database records."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args()
    files = sorted(args.directory.glob("shipping-label-*-A5.pdf"))
    assert len(files) == 3, f"Expected single/multiple/long variants, got {len(files)}"
    results = [validate(file, args.render) for file in files]
    (args.directory / "verification.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
