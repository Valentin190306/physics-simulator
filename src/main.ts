import { App } from './ui/app';

window.addEventListener('error', (event) => {
  const status = document.getElementById('status');
  if (status) status.textContent = `Error: ${event.message}`;
});

window.addEventListener('unhandledrejection', (event) => {
  const status = document.getElementById('status');
  if (status) status.textContent = `Error: ${String(event.reason)}`;
});

new App();
