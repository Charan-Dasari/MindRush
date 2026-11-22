/**
 * MindRush Admin — Analytics Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const dashRes = await fetch('/api/admin/dashboard');
    if (dashRes.ok) {
      const data = await dashRes.json();
      const m = data.metrics || {};
      document.getElementById('metric-pending').textContent = m.pending_review || 0;
      document.getElementById('metric-approved').textContent = m.approved || 0;
      document.getElementById('metric-published').textContent = m.published || 0;
      document.getElementById('metric-docs').textContent = m.source_documents || 0;
    }

    const batchRes = await fetch('/api/admin/batches');
    if (batchRes.ok) {
      const bData = await batchRes.json();
      const batches = bData.batches || [];
      const bList = document.getElementById('batches-list');
      if (batches.length === 0) {
        bList.innerHTML = '<div>No generation batches executed yet.</div>';
      } else {
        bList.innerHTML = batches.slice(0, 5).map(b => `
          <div style="padding:8px 0; border-bottom:1px solid #334155;">
            <strong>${b.topic} (${b.difficulty})</strong> - ${b.requested_count} items
            <div style="color:#64748b; font-size:11px;">Status: ${b.status} | ID: ${b.batch_id.slice(0, 8)}...</div>
          </div>
        `).join('');
      }
    }

    const auditRes = await fetch('/api/admin/audit-logs');
    if (auditRes.ok) {
      const aData = await auditRes.json();
      const logs = aData.audit_logs || [];
      const aList = document.getElementById('audit-list');
      if (logs.length === 0) {
        aList.innerHTML = '<div>No audit events recorded yet.</div>';
      } else {
        aList.innerHTML = logs.slice(0, 5).map(l => `
          <div style="padding:8px 0; border-bottom:1px solid #334155;">
            <span style="color:#38bdf8;">[${l.action}]</span> on ${l.target_collection}
            <div style="color:#64748b; font-size:11px;">Time: ${new Date(l.createdAt).toLocaleTimeString()}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
});
