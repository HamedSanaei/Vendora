# QuestPDF Community configuration and validation

Verified on 2026-10-24. No commit, push, deployment or production-data operation was performed.

## Eligibility and official terms

The current official [License Selection Guide](https://www.questpdf.com/license/guide.html) and [Community License](https://www.questpdf.com/license/community.html), effective 6 July 2026/version 3.0, were reviewed. The business owner explicitly confirmed on 2026-10-24 that Vendora is privately owned, non-governmental and below USD 1,000,000 consolidated annual gross revenue in the most recently completed fiscal year. On that self-certified basis it qualifies for Community use. A public GitHub repository alone was not treated as an open-source license or proof of eligibility.

The revenue calculation includes entities under common control; the guide specifies first-year estimates and annual-average currency conversion where applicable. Eligibility must be reassessed if the business's revenue or ownership changes. Current terms exclude public-sector/publicly traded entities and provide a 90-day transition when Community eligibility is lost. This record is owner self-certification, not an independent audit of financial records.

The [official activation documentation](https://www.questpdf.com/license/configuration.html) specifies a local license selection in code. No license key, domain registration, external activation request or paid subscription is needed for eligible Community use. The existing QuestPDF package/version remains unchanged.

## Runtime configuration

`API/appsettings.json` now contains:

```json
"Accounting": {
  "Pdf": {
    "License": "Community"
  }
}
```

Immediately after building the application host, `API/Program.cs` invokes `CommercialPdfConfiguration.Initialize`. The Infrastructure implementation selects the process-wide license once:

```csharp
QuestPDF.Settings.License = LicenseType.Community;
```

The production environment example also explicitly sets `Accounting__Pdf__License=Community`. Existing environment-specific overrides still take precedence: remove an obsolete blank/Evaluation override or set it to Community when deploying through the normal approved process. No real environment/production setting was changed in this task.

Missing/invalid settings return a safe startup warning and disable PDF generation only. Production Evaluation is refused. A conflicting attempt to change the process-wide license does not silently mutate the existing choice. The renderer also checks configuration for consumers outside the web host. Actual fonts are loaded once from the published `Fonts/` directory; system-installed fonts and external font services are unnecessary.

## Browser printing

Both admin and customer actions obtain the same authenticated A4/A5 PDF as downloads. Print reserves an empty viewer window synchronously during the user's click, before awaiting Axios. This avoids losing the browser's user activation during PDF generation. Once received, the PDF blob is opened in that window; the browser's PDF toolbar or Ctrl+P performs printing and printer selection locally.

- No printer driver, printer queue, network printer connection or server-side printer access is used.
- The viewer's opener is severed; credentials/tokens are not placed in the viewer URL.
- A blocked popup produces explicit localized feedback, with a download-and-print fallback.
- Failed PDF requests close the reserved empty viewer. PDF authorization remains enforced server-side.
- Four automated tests cover the two frontend helpers' synchronous reservation and blocked-popup behavior. Native OS print-dialog/hardware output is not automated or certified here. Browser automation previously refused blob-viewer navigation; no bypass was attempted. Authenticated PDF downloads and rendering are independently covered by integration tests.

The very small viewer helper is local to each independently built frontend so neither Docker build context must import source from the other application.

## Reproducible Linux production-runtime test

The local Docker daemon was started. The normal `deploy/docker/API.Dockerfile` was built without modification to its runtime dependencies. The test image derives from that exact API image and adds only the three diagnostic executable/manifest files. Infrastructure/QuestPDF assemblies, native libraries, font files, ASP.NET runtime, Production environment and non-root `app` user all come from the normal production image.

The probe reads the actual published `appsettings.json`, runs startup license initialization, asserts Community, then renders synthetic in-memory snapshots. It does not start the API, instantiate a DbContext, run migrations/seed, load machine credentials, call a payment service, or mount a database.

```powershell
powershell -NoProfile -File scripts/test-commercial-pdf-container.ps1
```

The script runs the probe with `--network none`, `--read-only`, `--cap-drop ALL`, `no-new-privileges`, a bounded `/tmp` tmpfs and only a fixture-output directory mount. It uses `docker run --rm`, never production compose. On non-Windows hosts the output directory must be writable by the production image's `app` UID. The script does not change ownership or permissions on application/production data.

Successful runtime: **linux/amd64, Ubuntu 24.04.5 LTS, user app**. Production API QA image ID at verification: `sha256:9ce4aa57312110665480780fec60e0b601db6cbf4d80d890d13a66a5a428a5d2`.

Eight Linux fixtures were generated: Sale/Proforma × A4/A5 × 2/65 rows. Small documents are one page. Long Linux fixtures use deliberately longer titles/addresses, discount, tax and shipping: A4 is eight pages and A5 fourteen pages. The shorter Windows fixture is eight A4/ten A5 pages. Different inputs explain the page-count difference; binary equality across platforms is not asserted.

## Automated and visual verification

- `dotnet test Vendora.slnx --no-restore`: **255 passed**, including real Community PDF rendering in Production, startup selection/repeated initialization/conflict refusal, missing/invalid/Production-Evaluation failure isolation, and authenticated owner/non-owner/guest PDF checks.
- `node --test admin/scripts/*.test.mjs`: **18 passed**, including four new browser PDF helper tests.
- Admin and site `npm run lint` and `npm run build`: passed. Admin build retains its existing large-chunk advisory. Node's direct test import of the site's TypeScript module emits a module-type performance warning; no application failure or package change was introduced.
- Normal production API Docker build and derived offline smoke run: passed. No extra Linux packages were needed for QuestPDF beyond the normal image.
- `scripts/verify-commercial-pdfs.py` validated **all 16 Windows/Linux PDFs**: actual paper dimensions, embedded Vazirmatn fonts, Persian headings, all expected product rows, repeating table headings, exact known final amounts, absence of Evaluation metadata, no empty pages, and glyph bounds inside the physical paper.
- Poppler rendered first/middle/last QA pages. Representative A4/A5 sale/proforma pages were visually inspected for connected Persian glyphs, RTL, tables, totals, headers and page numbering. A terms-only trailing page discovered in the long A5 fixture was fixed by keeping the summary and terms together; regenerated fixtures pass the regression assertion.

Developer-only validation uses the existing bundled Python pypdf/pdfplumber and Poppler tools; none are application/NuGet/npm dependencies:

```bash
python scripts/verify-commercial-pdfs.py artifacts/questpdf-community/linux --poppler-directory /path/to/poppler/bin
python scripts/verify-commercial-pdfs.py artifacts/questpdf-community/windows --poppler-directory /path/to/poppler/bin
```

Local evidence is under ignored `artifacts/questpdf-community/`: Docker build/run logs, Windows/Linux PDFs, JSON verification results and rendered PNGs. Fixtures contain only synthetic names/addresses/amounts. Local QA containers were removed on completion. Existing unrelated local containers were not changed or stopped.

Remaining verification limit: an end user's browser/OS printer selection and physical paper output still require normal manual acceptance; the application does not need server-side printer access. No real deployment, production database, financial transaction or production license account was accessed.
