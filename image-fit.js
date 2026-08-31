(() => {
  'use strict';

  const style = document.createElement('style');
  style.id = 'logoFrameImageFitStyles';
  style.textContent = `
    /*
      Some source logo files are physically small (for example ~145px square).
      With width/height left as auto, browsers render those images near their
      intrinsic pixel size even inside a much larger logo frame. Give every
      non-thumbnail logo image a real box to fill, then let object-fit contain
      preserve its aspect ratio. This removes the apparent giant white margin
      without cropping the artwork.
    */
    .logo-frame:not(.thumb) img {
      width: 86%;
      height: 86%;
      max-width: none;
      max-height: none;
      object-fit: contain;
    }

    .logo-only-year-item .logo-frame img,
    .logo-only-team-item .logo-frame img {
      width: 88%;
      height: 88%;
    }
  `;
  document.head.appendChild(style);
})();
