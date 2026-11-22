/**
 * MindRush Admin — Question Generation Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('generation-form');
  const generateBtn = document.getElementById('generate-btn');
  const monitorCard = document.getElementById('batch-monitor');
  const batchIdDisp = document.getElementById('batch-id-disp');
  const batchStatusBadge = document.getElementById('batch-status-badge');
  const batchCountDisp = document.getElementById('batch-count-disp');
  const batchMsg = document.getElementById('batch-msg');

  let pollInterval = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      curriculum_id: document.getElementById('curriculum').value,
      standard: parseInt(document.getElementById('standard').value, 10),
      subject: document.getElementById('subject').value,
      topic: document.getElementById('topic').value,
      difficulty: document.getElementById('difficulty').value,
      requested_count: parseInt(document.getElementById('count').value, 10),
      idempotency_key: 'ui_req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
    };

    generateBtn.disabled = true;
    generateBtn.textContent = 'Submitting Request...';
    monitorCard.style.display = 'block';
    batchStatusBadge.className = 'badge badge-pending';
    batchStatusBadge.textContent = 'DISPATCHING';
    batchMsg.textContent = 'Communicating with MindRush backend...';

    try {
      const response = await fetch('/api/admin/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'MindRush-Admin'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to dispatch generation batch');
      }

      const batchId = data.batch_id;
      batchIdDisp.textContent = batchId;
      batchStatusBadge.textContent = data.status || 'PENDING';
      batchMsg.textContent = 'Generation batch active. Polling status...';

      startPolling(batchId);
    } catch (err) {
      alert('Generation error: ' + err.message);
      generateBtn.disabled = false;
      generateBtn.textContent = 'Initiate Local LLM Generation';
      batchStatusBadge.className = 'badge badge-failed';
      batchStatusBadge.textContent = 'ERROR';
      batchMsg.textContent = err.message;
    }
  });

  function startPolling(batchId) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/generation/${batchId}`);
        if (!res.ok) return;

        const data = await res.json();
        const batch = data.batch || data;

        batchStatusBadge.textContent = (batch.status || 'UNKNOWN').toUpperCase();
        batchStatusBadge.className = `badge badge-${batch.status}`;
        batchCountDisp.textContent = batch.generated_count || 0;

        if (batch.status === 'completed') {
          clearInterval(pollInterval);
          generateBtn.disabled = false;
          generateBtn.textContent = 'Initiate Local LLM Generation';
          batchMsg.innerHTML = `Generation completed successfully! <a href="review.html" style="color: #38bdf8;">Go to Review Queue &rarr;</a>`;
        } else if (batch.status === 'failed') {
          clearInterval(pollInterval);
          generateBtn.disabled = false;
          generateBtn.textContent = 'Initiate Local LLM Generation';
          batchMsg.textContent = `Batch failed: ${batch.error_message || 'Inference error'}`;
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  }
});
