import { Input } from "./input";

const kDimension = 4;
const kBackgroundStyle = "#004643"; // https://www.happyhues.co/palettes/10
const kTilePadding = 3;
const kRoundedRadius = 7;
const kTileStyle = {
  0:"#f9bc60",
  1:"#f9bc60",
  2:"#eee4da",
  4:"#eee1c9",
  8:"#f3b27a",
  16:"#f69664",
  32:"#f77c5f",
  64:"#f75f3b",
  128:"#edd073",
  256:"#edcc62",
  512:"#edc950",
  1024:"#edc53f",
  2048:"#edc22e"
};

const kTranslateDuration = 100;
const kAppearDuration = 60;
const kMergeOutroDuration = 100;

const gCanvas = document.getElementById("canvas")! as HTMLCanvasElement;
const gContext = gCanvas.getContext("2d", { alpha: false })!;
let gTileSize = gCanvas.width/kDimension;
let gFont = 0.082*gCanvas.width + "px cabin";

interface Coord {
  x: number,
  y: number,
}
function resetCoord(xy: Coord) {
  xy.x = 0;
  xy.y = 0;
}
function isempty(c: Coord): boolean {
  return c.x == 0 && c.y == 0;
}
interface TileDiff {
  pos: Coord,
  mergedFrom: Coord,
  isNew: boolean
}
function resetTileDiff(diff: TileDiff) {
  resetCoord(diff.pos);
  resetCoord(diff.mergedFrom);
  diff.isNew = true;
}
let gNumCache = {0: "0", 2: "2", 4: "4"} // number -> string=
function getCachedString(num: number): string {
  if (!(num in gNumCache)) {
    gNumCache[num] = num.toString();
  }
  return gNumCache[num]
}
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function fillRoundedRect(x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  gContext.beginPath();
  gContext.moveTo(x+r, y);
  gContext.arcTo(x+w, y,   x+w, y+h, r);
  gContext.arcTo(x+w, y+h, x,   y+h, r);
  gContext.arcTo(x,   y+h, x,   y,   r);
  gContext.arcTo(x,   y,   x+w, y,   r);
  gContext.closePath();
}

class Tile {
  val: number = -1;
  // where was this tile's previous position; used for animating it to the current position.
  // `pos` is relative offset.
  // `mergedFrom` is relative offset.
  prev: TileDiff = {pos: {x:0, y: 0}, mergedFrom: {x:0, y:0}, isNew: true};

  constructor(val: number) {
    this.reset(val);
  }
  reset(val: number)  {
    this.val = val;
    resetTileDiff(this.prev);
  }

  // renders the animation frame at duration `now` of the given tile.
  render(elapsedMs: number) {
    let val = this.val;
    if (val == -1) {
      return;
    }
    let wasMerged = this.prev.mergedFrom.x != 0 || this.prev.mergedFrom.y != 0;
    let translateFactor = Math.max(0, 1 - elapsedMs/kTranslateDuration); // pct left of translation animation.
    // translate animation for ghost tile that just got merged:
    if (wasMerged && elapsedMs <= kTranslateDuration + kMergeOutroDuration) {
      val /= 2;
      gContext?.save();
      let deltax = this.prev.mergedFrom.x*gTileSize;
      let deltay = this.prev.mergedFrom.y*gTileSize;
      gContext?.translate(-deltax * translateFactor, -deltay * translateFactor); // center of the ghost tile.
      this.drawTile(val);
      gContext?.restore();
    }
    // translate animation for any moving tile
    if (elapsedMs <= kTranslateDuration + kMergeOutroDuration && (this.prev.pos.x != 0 || this.prev.pos.y != 0)) {
      let deltax = this.prev.pos.x*gTileSize;
      let deltay = this.prev.pos.y*gTileSize;
      gContext.translate(-deltax * translateFactor, -deltay * translateFactor); // animation position of the tile
    }
    // Merge outro animation (the part where they grind against each other and become one):
    if (wasMerged && elapsedMs >= kTranslateDuration && elapsedMs <= kTranslateDuration + kMergeOutroDuration) {
      val *= 2;
      let factor = (elapsedMs - kTranslateDuration)/kMergeOutroDuration;
      gContext?.scale(1.10*easeOutBack(factor),1.10*easeOutBack(factor));
    }
    // appear animation for new tiles:  
    if (elapsedMs <= kTranslateDuration && this.prev.isNew) {
      return;
    } else if (elapsedMs <= kTranslateDuration + kAppearDuration && this.prev.isNew) {
      let factor = (elapsedMs - kTranslateDuration)/kAppearDuration;
      gContext?.scale(easeOutBack(factor),easeOutBack(factor));
    }

    this.drawTile(val);
  }

  drawTile(val: number) {
    const pad = kTilePadding;
    gContext.fillStyle = val in kTileStyle ? kTileStyle[val] : kTileStyle[2048];
    fillRoundedRect(-gTileSize/2 + pad, -gTileSize/2 + pad, gTileSize - 2*pad, gTileSize - 2*pad, kRoundedRadius);
    gContext.fill();

    gContext.fillStyle = "black";
    gContext.font = gFont;
    gContext.textAlign = "center";
    gContext.fillText(getCachedString(val), 0, 2*pad, (gTileSize-pad*2)*.8);
  }
}

// Board is an array of rows. Each row is an array of column values.
type TileRow = Array<Tile>;
type Board = Array<TileRow>;
class Game {
  board: Board;
  Input: Input;
  prevMoveTimeMs: number = performance.now();
  scratchRow: TileRow = new Array<Tile>(kDimension);
  animationRequest: number | undefined = undefined;

  boundRender = this.render.bind(this);

  constructor() {
    this.board = new Array<Array<Tile>>();
    for (let r = 0; r < kDimension; r++) {
      let row = new Array<Tile>();
      for (let c = 0; c < kDimension; c++) {
        row.push(new Tile(-1));
      }
      this.board.push(row);
    }
    this.Input = new Input({
        "ArrowLeft": this.move.bind(this, -1, 0),  // left
        "ArrowDown": this.move.bind(this, 0, 1), // down
        "ArrowRight": this.move.bind(this, 1, 0), // right
        "ArrowUp": this.move.bind(this, 0, -1) // up
      }
    );

    this.spawnTile();
    this.spawnTile();
  }

  copyBoardColumnIntoScratchRow(c: number) {
    let i = 0;
    for (let r of this.board) {
      this.scratchRow[i++] = r[c];
    }
  }

  // move the board towards direction `x` and `y`.
  //
  // To move the board, the board is first normalized into rows (rows stay as rows, columns transpose into rows), and the direction is normalized to towards x = 1.
  // The algorithm only moves things row-wise, to the left, and then denormalizes the movement back to `x` and `y`.
  //
  // requires: x,y in [-1,0,1] && abs(x) xor abs(y)
  move(x:number, y: number) {
    let now = performance.now();
    this.prevMoveTimeMs = now;
    let somethingMoved = false;
    if (x != 0) {
      for (let r = 0; r < this.board.length; r++) {
        if (x > 0) {
          this.board[r].reverse();
        }
        somethingMoved = this.moveRow(this.board[r], x, y) || somethingMoved;
        if (x > 0) {
          this.board[r].reverse();
        };
      }
    }
    else if (y != 0) {
      for (let c = 0; c < this.board.length; c++) {
        // extract column
        this.copyBoardColumnIntoScratchRow(c);
        if (y > 0) {
          this.scratchRow.reverse();
        }
        somethingMoved = this.moveRow(this.scratchRow, x, y) || somethingMoved;
        if (y > 0) {
          this.scratchRow.reverse();
        }
        // put the column back in.
        for (let i = 0; i < this.board.length; i++) {
          this.board[i][c] = this.scratchRow[i];
        }
      }
    }

    if (somethingMoved) {
      this.spawnTile();
    }

    this.scheduleNextRender(now);
  }

  // always move `tiles` to the left. `x` and `y` are used to keep state for animation purposes.
  // return true if something moved.
  moveRow(tiles: TileRow, x: number, y: number): boolean {
    let somethingMoved = false;
    let output: TileRow = tiles;
    let free = 0;
    let skipMerge = false;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].val == -1) {
        continue;
      }
      resetTileDiff(tiles[i].prev);
      tiles[i].prev.isNew = false;
      // move to the left?
      output[free].val = tiles[i].val;
      output[free].prev.pos.x = x * (i-free);
      output[free].prev.pos.y = y * (i-free);
      output[free].prev.mergedFrom.x = 0;
      output[free].prev.mergedFrom.y = 0;
      output[free].prev.isNew = tiles[i].prev.isNew;
      if (i != free) {
        somethingMoved = true;
      }
      // merge?
      if (free > 0 && output[free-1].val == output[free].val && !skipMerge) {
        output[free - 1].val += output[free].val;
        output[free - 1].prev.mergedFrom.x = output[free].prev.pos.x + x;
        output[free - 1].prev.mergedFrom.y = output[free].prev.pos.y + y;
        output[free - 1].prev.isNew = false;
        output[free].reset(-1);
        skipMerge = true;
        somethingMoved = true;
      } else {
        free++;
        skipMerge = false;
      }
    }
    for (; free < tiles.length; free++) {
      output[free].reset(-1);
    }
    return somethingMoved;
  }

  scheduleNextRender(now: number) {
    let elapsed = now - this.prevMoveTimeMs;
    if (this.animationRequest == undefined && elapsed < (kTranslateDuration + Math.max(kAppearDuration, kMergeOutroDuration))) {
      this.animationRequest = window.requestAnimationFrame(this.boundRender);
    }
  }

  spawnTile() {
    let sampleSize = 0;
    let randomr = 0;
    let randomc = 0;
    for (let r = 0; r < this.board.length; r++) {
      for (let c  = 0 ; c < this.board[r].length; c++) {
        let tile = this.board[r][c];
        if (tile.val == -1) {
          sampleSize += 1;
          if (Math.floor(Math.random()*Math.floor(sampleSize)) == 0) {
            randomr = r;
            randomc = c;
          }
        }
      }
    }
    if (sampleSize == 0) {
      return false;
    }
    this.board[randomr][randomc].reset(2);
    this.board[randomr][randomc].prev.isNew = true;
  }

  render(now: number) {
    let nowInMs = performance.now();
    this.animationRequest = undefined;
  
    gContext.clearRect(0, 0, gCanvas.width, gCanvas.height);
    gContext.fillStyle = kBackgroundStyle;
    gContext.fillRect(0, 0, gCanvas.width, gCanvas.height);

    this.renderTiles(nowInMs);
    this.scheduleNextRender(nowInMs);
  }

  renderTiles(nowInMs: number) {
    let elapsed = nowInMs-this.prevMoveTimeMs;
    for (let r = 0; r < this.board.length; r++) {
      for (let c  = 0 ; c < this.board[r].length; c++) {
        gContext.save();
        let curx = c*gTileSize + gTileSize/2;
        let cury = r*gTileSize + gTileSize/2;
        gContext.translate(curx, cury); // center of the tile.
        this.board[r][c].render(elapsed);
        gContext.restore();
      }
    }
  }
}

function resize() {
  // gContext.canvas.width = Math.min(window.innerWidth,window.innerHeight);
  // gContext.canvas.height = Math.min(window.innerWidth,window.innerHeight);
  gTileSize = gCanvas.width/kDimension;
  gFont = 0.082*gCanvas.width + "px Cabin";
  if (game) {
    game.render(performance.now());
  }
};

let game = new Game();
window.onresize = resize;
resize();