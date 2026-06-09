class ToastManager {
  listeners = [];

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  show(message, type = 'success') {
    this.listeners.forEach(listener => listener(message, type));
  }
}

export const toastManager = new ToastManager();

export const toast = {
  success: (msg) => toastManager.show(msg, 'success'),
  error: (msg) => toastManager.show(msg, 'error'),
  info: (msg) => toastManager.show(msg, 'info'),
};
