/**
 * MindRush Admin — Documents Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.getElementById('docs-list');
  try {
    const res = await fetch('/api/admin/documents');
    if (!res.ok) throw new Error('Failed to load documents');
    const data = await res.json();
    const docs = data.documents || [];

    if (docs.length === 0) {
      listEl.innerHTML = '<div style="color:#94a3b8;">No source documents ingested yet.</div>';
      return;
    }

    listEl.innerHTML = docs.map(d => `
      <div style="background:#1e293b; padding:14px; border-radius:6px; margin-bottom:10px; border:1px solid #334155;">
        <strong>${d.filename}</strong> (Standard ${d.standard} ${d.subject})
        <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
          Status: <span style="color:#38bdf8;">${d.processing_status}</span> | Extracted Questions: ${d.extracted_question_count || 0}
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = `<div style="color:#ef4444;">Error: ${err.message}</div>`;
  }
});
