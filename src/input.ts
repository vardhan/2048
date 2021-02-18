export class Input {
  touchGesture: TouchGesture | undefined = undefined;
  constructor(handlers: any) {
    // register keyboard
    document.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.code in handlers) {
        handlers[ev.code]();
      }
    });

    // // register touch
    // this.touchGesture = new TouchGesture(document.getElementById("canvas") as HTMLCanvasElement, (code: string) => {
    //   if (code in handlers) {
    //     handlers[code]();
    //   }
    // });
  }
}

class TouchGesture {
  dragStart: number | undefined = undefined;
  prevX = 0;
  prevY = 0;
  diffX = 0;
  diffY = 0;

  constructor(canvas: HTMLCanvasElement, handler: any) {
    let touchmove = (ev) => {
      this.diffX += (ev.touches[0].clientX - this.prevX);
      this.diffY += (ev.touches[0].clientY - this.prevY);
      this.prevX = ev.touches[0].clientX;
      this.prevY = ev.touches[0].clientY;
      this.dragStart = Date.now();
    }
    canvas.addEventListener('touchstart', (ev) => {
      this.dragStart = Date.now();
      this.prevX = ev.touches[0].clientX;
      this.prevY = ev.touches[0].clientY;
      document.addEventListener('touchmove', touchmove, false);
    }, false);

    canvas.addEventListener('touchend', (ev) => {
      document.removeEventListener('touchmove', touchmove);
      let code = this.eval_swipe();
      if (code) {
        handler(code);
      }
    });
    canvas.addEventListener('touchcancel', (ev) => {
      document.removeEventListener('touchmove', touchmove);
      let code = this.eval_swipe();
      if (code) {
        handler(code);
      }
    });
  };

  eval_swipe(): string | undefined {
    if (this.dragStart == undefined) {
      return;
    }
    
    let elapsed = Date.now() - this.dragStart;
    let code = undefined;
    if (elapsed < 200) {
      if (Math.abs(this.diffX) > Math.abs(this.diffY)) {
        if (this.diffX > 0) {
          code = "ArrowRight";
        } else {
          code = "ArrowLeft";
        }
      } else {
        if (this.diffY > 0) {
          code = "ArrowDown";
        } else {
          code = "ArrowUp";
        }
      }
    }
    this.dragStart = undefined;
    this.diffX = 0;
    this.diffY = 0;
    this.prevX = 0;
    this.prevY = 0;
    return code;
  }
}