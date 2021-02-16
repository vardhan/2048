export class Input {
  mouseGesture: MouseGesture | undefined = undefined;
  touchGesture: TouchGesture | undefined = undefined;
  constructor(handlers: any) {
    // register keyboard
    document.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.code in handlers) {
        handlers[ev.code]();
      }
    });

    // register mouse
    this.mouseGesture = new MouseGesture((code: string) => {
      if (code in handlers) {
        handlers[code]();
      }
    });

    // register touch
    this.touchGesture = new TouchGesture(document.getElementById("canvas") as HTMLCanvasElement, (code: string) => {
      if (code in handlers) {
        handlers[code]();
      }
    });
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

class MouseGesture {
  dragStart: number | undefined = undefined;
  diffX = 0;
  diffY = 0;

  constructor(handler: any) {
    let mousemove = (event: MouseEvent) => {
      this.diffX += event.movementX;
      this.diffY += event.movementY;
    }
    document.onmousedown = () => {
      this.dragStart = Date.now();
      document.addEventListener('mousemove', mousemove);
    };
    document.onmouseup = (ev) => {
      document.removeEventListener('mousemove', mousemove);
      let code = this.eval_swipe();
      if (code) {
        handler(code);
      }
    };
    document.onmouseleave = () => {
      document.removeEventListener('mousemove', mousemove);
      let ev = this.eval_swipe();
      if (ev) {
        handler(ev);
      }
    };
  }

  eval_swipe(): string | undefined {
    if (this.dragStart == undefined) {
      return;
    }
    
    let elapsed = Date.now() - this.dragStart;
    let code = undefined;
    if (elapsed < 300) {
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
    return code;
  }
}