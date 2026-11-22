/**
 * MindRush Admin — Question Publication Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const pubBtn = document.getElementById('publish-btn');
  const pubStatus = document.getElementById('pub-status');

  if (pubBtn) {
    pubBtn.addEventListener('click', async () => {
      pubBtn.disabled = true;
      pubBtn.textContent = 'Publishing...';
      pubStatus.textContent = 'Allocating atomic sequences and staging file update...';

      try {
        const res = await fetch('/api/admin/questions/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'MindRush-Admin'
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Publication failed');

        pubStatus.innerHTML = `<span style="color:#22c55e;">Success! Published ${data.published_count} new questions. Total published bank: ${data.total_published}.</span>`;
      } catch (err) {
        pubStatus.innerHTML = `<span style="color:#ef4444;">Publication Error: ${err.message}</span>`;
      } finally {
        pubBtn.disabled = false;
        pubBtn.textContent = 'Publish Approved Questions Now';
      }
    });
  }
});
