/**
 * MindRush Admin — Question Review Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('review-cards-container');
  const countSpan = document.getElementById('pending-count');

  async function loadPendingQuestions() {
    try {
      const res = await fetch('/api/admin/questions/pending-review');
      if (!res.ok) throw new Error('Failed to load pending questions');
      const data = await res.json();
      const questions = data.questions || [];

      countSpan.textContent = questions.length;
      if (questions.length === 0) {
        container.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8;">No questions currently awaiting review.</div>';
        return;
      }

      container.innerHTML = '';
      for (const item of questions) {
        const q = item.question || item;
        const val = item.validation || {};
        const card = document.createElement('div');
        card.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-bottom: 20px;';

        const optHtml = (q.options || []).map(opt => `
          <div style="padding: 8px 12px; background: #0f172a; border-radius: 4px; margin-bottom: 6px; ${opt.id === q.correct_option_id ? 'border: 1px solid #16a34a;' : ''}">
            <strong>${opt.id}:</strong> ${opt.text}
            ${opt.id === q.correct_option_id ? '<span style="color:#22c55e; margin-left:8px;">[Correct Answer]</span>' : ''}
          </div>
        `).join('');

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-weight: 700; color: #38bdf8;">Topic: ${q.topic || 'General'} | Difficulty: ${q.difficulty || 'medium'}</span>
            <span style="font-size: 12px; color: #94a3b8;">ID: ${q.question_id || q._id}</span>
          </div>
          <h3 style="margin-top: 0; font-size: 18px;">${q.question_text}</h3>
          <div style="margin: 12px 0;">${optHtml}</div>
          <div style="background: #0b0f19; padding: 10px; border-radius: 6px; font-size: 13px; color: #94a3b8; margin-bottom: 16px;">
            <strong>Automated Validation:</strong>
            Schema: <span style="color:${val.schema_valid ? '#22c55e' : '#ef4444'}">${val.schema_valid ? 'PASS' : 'FAIL'}</span> |
            Math Check: <span style="color:${val.answer_valid ? '#22c55e' : '#ef4444'}">${val.answer_valid ? 'PASS' : 'FAIL'} (Recalc: ${val.recalculated_value != null ? val.recalculated_value : 'N/A'})</span> |
            Duplicate Check: <span>${val.duplicate_check || 'passed'} (Score: ${val.similarity_score || 0})</span>
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="approve-btn" data-id="${q._id || q.question_id}" style="background:#16a34a; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:700;">Approve</button>
            <button class="reject-btn" data-id="${q._id || q.question_id}" style="background:#dc2626; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:700;">Reject</button>
          </div>
        `;
        container.appendChild(card);
      }

      // Attach event listeners
      document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const qId = e.target.getAttribute('data-id');
          await submitDecision(qId, 'approved');
        });
      });

      document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const qId = e.target.getAttribute('data-id');
          const reason = prompt('Please enter mandatory rejection reason:');
          if (!reason || !reason.trim()) {
            alert('Rejection requires a mandatory reason.');
            return;
          }
          await submitDecision(qId, 'rejected', reason.trim());
        });
      });
    } catch (err) {
      container.innerHTML = `<div style="color: #ef4444; padding: 24px;">Failed to load pending questions: ${err.message}</div>`;
    }
  }

  async function submitDecision(id, decision, reason = null) {
    try {
      const res = await fetch(`/api/admin/questions/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'MindRush-Admin'
        },
        body: JSON.stringify({ decision, reason })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to submit review');
      }
      loadPendingQuestions();
    } catch (err) {
      alert('Error updating question: ' + err.message);
    }
  }

  loadPendingQuestions();
});
