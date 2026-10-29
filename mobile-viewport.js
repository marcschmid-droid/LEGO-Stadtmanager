/* Keep form actions above the iOS keyboard; no data access or storage. */
(function () {
  function update() {
    const viewport = window.visualViewport;
    const root = document.documentElement.style;
    root.setProperty('--bcm-viewport-height', (viewport?.height || window.innerHeight) + 'px');
    root.setProperty('--bcm-viewport-top', (viewport?.offsetTop || 0) + 'px');
  }
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
})();
