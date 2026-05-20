document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('requestId');

  if (!requestId) {
    window.close();
    return;
  }

  // Elements
  const infoType = document.getElementById('info-type');
  const infoRp = document.getElementById('info-rp');
  const infoUser = document.getElementById('info-user');
  const userRow = document.getElementById('user-row');
  const selectionContainer = document.getElementById('selection-container');
  const passkeySelect = document.getElementById('passkey-select');
  const noPasskeyWarning = document.getElementById('no-passkey-warning');
  const btnCancel = document.getElementById('btn-cancel');
  const btnConfirm = document.getElementById('btn-confirm');
  const dialogTitle = document.getElementById('dialog-title');

  let requestData = null;

  // Load request details from background
  try {
    requestData = await chrome.runtime.sendMessage({ type: 'PASSKEY_DIALOG_READY', requestId });
  } catch (err) {
    console.error('Failed to get request details:', err);
    window.close();
    return;
  }

  if (!requestData) {
    window.close();
    return;
  }

  // Set RP
  infoRp.textContent = requestData.rpId || (requestData.rp && requestData.rp.id) || 'unknown domain';

  if (requestData.type === 'WEBAUTHN_CREATE') {
    dialogTitle.textContent = 'Create Passkey';
    infoType.textContent = 'Create Passkey';
    infoType.style.color = 'var(--success)';
    
    // User info
    if (requestData.user && requestData.user.name) {
      infoUser.textContent = requestData.user.name;
      userRow.style.display = 'flex';
    }
    
    btnConfirm.textContent = 'Create Passkey';
    btnConfirm.disabled = false;
  } else if (requestData.type === 'WEBAUTHN_GET') {
    dialogTitle.textContent = 'Sign In with Passkey';
    infoType.textContent = 'Sign In';
    infoType.style.color = 'var(--accent)';
    
    const passkeys = requestData.passkeys || [];
    if (passkeys.length === 0) {
      noPasskeyWarning.style.display = 'block';
      btnConfirm.disabled = true;
    } else {
      // Populate standard select dropdown hidden fallback
      passkeySelect.innerHTML = passkeys.map(p => `
        <option value="${escapeHtml(p.credential_id)}">${escapeHtml(p.title)}</option>
      `).join('');

      // Populate card selector container
      const listContainer = document.getElementById('passkeys-list-container');
      if (listContainer) {
        listContainer.innerHTML = passkeys.map((p, idx) => {
          const isPreferred = idx === 0; // simple mock rule
          const friendlyLastUsed = p.last_used ? new Date(p.last_used).toLocaleDateString() : 'Never';
          return `
            <div class="passkey-card ${idx === 0 ? 'selected' : ''}" data-cred-id="${escapeHtml(p.credential_id)}">
              <i class="ph-duotone ph-fingerprint passkey-card-icon"></i>
              <div class="passkey-card-info">
                <div class="passkey-card-title">${escapeHtml(p.title)}</div>
                <div class="passkey-card-meta">
                  <span>ID: ${escapeHtml(p.credential_id.substring(0, 8))}...</span>
                  <span class="passkey-card-dot"></span>
                  <span>Used: ${friendlyLastUsed}</span>
                </div>
              </div>
              ${isPreferred ? `
                <span class="nl-badge" style="color:var(--accent); border-color:var(--accent); font-size:7.5px; padding:1px 4px; border-radius:3px; font-weight:700;">
                  Preferred
                </span>` : ''}
            </div>
          `;
        }).join('');

        // Wire up selection behaviors
        const cards = listContainer.querySelectorAll('.passkey-card');
        cards.forEach(card => {
          card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            passkeySelect.value = card.getAttribute('data-cred-id');
          });
        });
      }
      
      selectionContainer.style.display = 'block';
      btnConfirm.textContent = 'Sign In';
      btnConfirm.disabled = false;
    }
  }

  // Cancel button
  btnCancel.addEventListener('click', () => {
    window.close();
  });

  // Confirm button
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Processing...';
    
    const selectedCredentialId = requestData.type === 'WEBAUTHN_GET' ? passkeySelect.value : null;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'PASSKEY_DIALOG_CONFIRM',
        requestId,
        selectedCredentialId
      });
    } catch (err) {
      console.error('Confirm failed:', err);
      alert('Operation failed. Please try again.');
      btnConfirm.disabled = false;
      btnConfirm.textContent = requestData.type === 'WEBAUTHN_CREATE' ? 'Create Passkey' : 'Sign In';
    }
  });

  // Helper to escape HTML safely
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
