(() => {
  'use strict';

  const existing = document.getElementById('logoFrameImageFitStyles');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'logoFrameImageFitStyles';
  style.textContent = `
    /*
      Force every non-thumbnail logo image to fill a predictable box inside
      its frame. The explicit min/max reset plus !important prevents mobile
      Safari from falling back to the image's intrinsic pixel dimensions.
    */
    .logo-frame:not(.thumb) img {
      width: 86% !important;
      height: 86% !important;
      min-width: 86% !important;
      min-height: 86% !important;
      max-width: 86% !important;
      max-height: 86% !important;
      object-fit: contain !important;
      display: block;
    }

    .logo-only-year-item .logo-frame img,
    .logo-only-team-item .logo-frame img {
      width: 88% !important;
      height: 88% !important;
      min-width: 88% !important;
      min-height: 88% !important;
      max-width: 88% !important;
      max-height: 88% !important;
    }

    @media (max-width: 760px) {
      .battle-card .logo-frame.large img {
        width: 90% !important;
        height: 90% !important;
        min-width: 90% !important;
        min-height: 90% !important;
        max-width: 90% !important;
        max-height: 90% !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
