// Prevent flash of wrong theme — must run before CSS loads
document.documentElement.dataset.theme =
  localStorage.getItem('arcadehub_theme') ||
  (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark');
