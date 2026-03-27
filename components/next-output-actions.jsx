"use client";

export default function NextOutputActions({ result, onImprove, onCopy, onDownload }) {
  return (
    <div className="content-action-row">
      {result ? <button type="button" className="primary-button improve-button" onClick={onImprove}>Cải tiến thêm</button> : <span />}
      <div className="content-action-right">
        {result ? <button type="button" className="ghost-button icon-text-button" onClick={onCopy}><span className="button-icon" aria-hidden="true">⧉</span><span>Copy</span></button> : null}
        {result ? <button type="button" className="ghost-button icon-text-button" onClick={onDownload}><span className="button-icon" aria-hidden="true">⇩</span><span>Tải về</span></button> : null}
      </div>
    </div>
  );
}
