export class Keyboard {
  
  constructor(handlers) {
    document.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.code in handlers) {
        handlers[ev.code]();
      }
    });
  }
}
