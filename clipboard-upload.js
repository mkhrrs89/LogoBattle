(() => {
  'use strict';

  function clipboardImageFiles(event) {
    const items = Array.from(event.clipboardData?.items || []);
    return items
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean);
  }

  function uniqueClipboardFile(file, index) {
    const extension = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]+/gi, '') || 'png';
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return new File([file], `pasted-logo-${stamp}-${index + 1}.${extension}`, {
      type: file.type || 'image/png',
      lastModified: Date.now(),
    });
  }

  function sendToExistingUploader(files) {
    const input = document.getElementById('uploadInput') || document.getElementById('emptyUploadInput');
    if (!input) return false;

    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  document.addEventListener('paste', event => {
    const files = clipboardImageFiles(event);
    if (!files.length) return;

    // Only intercept paste when the clipboard actually contains image files,
    // so normal text pasting into search/edit fields keeps working unchanged.
    event.preventDefault();

    const uploadFiles = files.map(uniqueClipboardFile);
    if (!sendToExistingUploader(uploadFiles)) {
      alert('The logo uploader is not ready yet. Please try pasting the image again.');
    }
  });
})();
