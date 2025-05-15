// Use a minimal EventEmitter implementation for React Native (no 'events' package needed)
class EventEmitter {
  constructor() {
    this.events = {};
  }
  addListener(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }
  removeListener(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}
export const eventEmitter = new EventEmitter();

   