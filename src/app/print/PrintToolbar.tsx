"use client";

export default function PrintToolbar() {
  return (
    <div className="print-toolbar no-print">
      <button
        onClick={() => window.print()}
        className="print-btn"
      >
        🖨️ Imprimer / PDF
      </button>
      <a href="/" className="print-btn print-btn-ghost">
        ← Retour
      </a>
    </div>
  );
}
