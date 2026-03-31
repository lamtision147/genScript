"use client";

import { useEffect, useMemo, useState } from "react";
import { apiPost } from "@/lib/client/api";
import { buildBulkResultCsv, buildCsvTemplate, normalizeBulkRows, parseCsvText } from "@/lib/client/csv-utils";
import { routes } from "@/lib/routes";
import { getCopy } from "@/lib/i18n";
import { trackEvent } from "@/lib/client/telemetry";

function downloadTextFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function NextBulkGeneratorPanel({ language = "vi" }) {
  const copy = getCopy(language);
  const isVi = language === "vi";
  const [csvText, setCsvText] = useState(buildCsvTemplate(language));
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setCsvText(buildCsvTemplate(language));
    setResults([]);
    setError("");
  }, [language]);

  function applyLanguageTemplate() {
    setCsvText(buildCsvTemplate(language));
    setResults([]);
    setError("");
  }

  const rows = useMemo(() => normalizeBulkRows(parseCsvText(csvText)).slice(0, 20), [csvText]);

  async function runBulkGenerate() {
    setRunning(true);
    setError("");
    setResults([]);
    try {
      const payloadRows = rows.map((row) => ({
        lang: language,
        productName: row.productName,
        category: row.category,
        subcategory: Number.isFinite(Number(row.subcategory)) ? Number(row.subcategory) : 0,
        channel: 2,
        tone: 1,
        brandStyle: 0,
        mood: 0,
        targetCustomer: row.targetCustomer,
        shortDescription: row.shortDescription,
        highlights: row.highlights,
        attributes: row.attributes,
        priceSegment: row.priceSegment,
        images: [],
        improved: false,
        variantCount: 1
      }));

      const data = await apiPost(routes.api.generateBulk, { rows: payloadRows, brandPreset: "minimalist" });
      const outputs = (data.items || []).map((item) => ({
        productName: item.productName,
        source: item.source || "fallback",
        quality: item.quality ?? "",
        headline: item.title || item.productName,
        paragraph1: item.paragraph1 || "",
        hashtags: (item.hashtags || []).join(" ")
      }));

      setResults(outputs);
      trackEvent("bulk.generate.success", { count: outputs.length });
    } catch (err) {
      setError(isVi ? "Tạo nội dung hàng loạt thất bại." : (err.message || "Bulk generation failed"));
      trackEvent("bulk.generate.failed", { error: err.message || "unknown" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="bulk-panel">
      <div className="bulk-head">
        <h3 className="subsection-title">{isVi ? "Tạo hàng loạt (CSV)" : "Bulk Generate (CSV)"}</h3>
        <div className="user-actions">
          <button type="button" className="ghost-button" onClick={() => downloadTextFile("bulk-template.csv", buildCsvTemplate(language), "text/csv")}>{isVi ? "Tải template" : "Template CSV"}</button>
          <button type="button" className="ghost-button" onClick={applyLanguageTemplate}>{isVi ? "Mẫu theo ngôn ngữ" : "Template by language"}</button>
          <button type="button" className="ghost-button" disabled={!results.length} onClick={() => downloadTextFile("bulk-results.csv", buildBulkResultCsv(results), "text/csv")}>{isVi ? "Tải kết quả" : "Download Results"}</button>
        </div>
      </div>

      <p className="bulk-note">{isVi ? "Dán CSV (tối đa 20 dòng) để tạo nội dung hàng loạt." : "Paste CSV (max 20 rows) to generate product intros in batch."}</p>
      <textarea className="bulk-textarea" value={csvText} onChange={(event) => setCsvText(event.target.value)} />

      <div className="bulk-actions">
        <span className="inline-note">{isVi ? `Số dòng hợp lệ: ${rows.length}` : `Rows detected: ${rows.length}`}</span>
        <button type="button" className="primary-button" disabled={running || !rows.length} onClick={runBulkGenerate}>
          {running ? copy.form.generating : (isVi ? "Chạy tạo hàng loạt" : "Run Bulk Generate")}
        </button>
      </div>

      {error ? <div className="history-empty error-state">{error}</div> : null}

      {results.length ? (
        <div className="bulk-result-list">
          {results.map((item, index) => (
            <div key={`${item.productName}-${index}`} className="bulk-result-item">
              <strong>{item.productName}</strong>
              <span>{isVi ? "Nguồn" : "Source"}: {item.source} · {isVi ? "Chất lượng" : "Quality"}: {item.quality || "n/a"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
