import { Input } from "./input";

const kRows = 4;
const kColumns = 4;
const kBackgroundStyle = "#004643"; // https://www.happyhues.co/palettes/10
const kTilePadding = 2;
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
const kAppearDuration = 100;
const kMergeOutroDuration = 60;

const gCanvas = document.getElementById("canvas")! as HTMLCanvasElement;
const gContext = gCanvas.getContext("2d", { alpha: false })!;
let gTileSize = gCanvas.width/kRows;

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
}
// Board is an array of kRows. Each row is an array of column values.
type TileRow = Array<Tile>;
type Board = Array<TileRow>;
class Game {
  board: Board;
  Input: Input;
  prevMoveTimeMs: number = performance.now();
  scratchRow: TileRow = new Array<Tile>(kRows);
  swipeDiff: Coord = {x: 0, y: 0};
  animationRequest: number | undefined = undefined;
  
  boundRender = this.render.bind(this);

  constructor() {
    this.board = new Array<Array<Tile>>();
    for (let r = 0; r < kRows; r++) {
      let row = new Array<Tile>();
      for (let c = 0; c < kColumns; c++) {
        row.push(new Tile(-1));
      }
      this.board.push(row);
    }
    this.Input = new Input({
        ArrowLeft: () => { this.move(-1, 0); },
        ArrowDown: () => { this.move(0, 1); },
        ArrowRight: () => { this.move(1, 0); },
        ArrowUp: () => { this.move(0, -1); }
      }
    );

    this.spawnTile();
    this.spawnTile();

    this.render(performance.now());
  }

  swipe(x: number, y: number) {
    if (Math.abs(x) > Math.abs(y)) {
      this.swipeDiff.x = x;
      this.swipeDiff.y = 0;
    } else {
      this.swipeDiff.x = 0;
      this.swipeDiff.y = y;
    }
    this.scheduleNextRender(performance.now());
  }
  copyBoardColumnIntoScratchRow(c: number) {
    let i = 0;
    for (let r of this.board) {
      this.scratchRow[i++] = r[c];
    }
  }

  // map each row or each column of the board in an order dictated by `x` and `y`.
  //
  // if abs(y) > 0, then each col of the board is processed. if y > 0, then the col order is bottom tile first. otherwise top.
  // else if abs(x) > 0, then each row of the board is processed. if x > 0, then the row order is right tile first. otherwise left.
  //
  // the col/row returned by `processor` is used to update the board. `processor` may update the supplied input in-place and return
  // it instead of a new copy.
  //
  // requires: x,y in [-1,0,1] && abs(x) xor abs(y)
  map_board(x: number, y: number, processor: (input: TileRow) => TileRow) {
    if (x != 0) {
      for (let r = 0; r < this.board.length; r++) {
        if (x > 0) {
          this.board[r].reverse();
        }
        let output = processor(this.board[r]!);
        if (x > 0) {
          output.reverse();
        }
        this.board[r] = output;
      }
    }
    else if (y != 0) {
      for (let c = 0; c < this.board.length; c++) {
        // extract column
        this.copyBoardColumnIntoScratchRow(c);
        if (y > 0) {
          this.scratchRow.reverse();
        }
        let output = processor(this.scratchRow);
        if (y > 0) {
          output.reverse();
        }
        // put the column back in.
        for (let i = 0; i < this.board.length; i++) {
          this.board[i][c] = output[i];
        }
      }
    }
  }

  // move the board towards direction (x,y).
  move(x:number, y: number) {
    let now = performance.now();
    this.prevMoveTimeMs = now;
    let somethingMoved = false;
    this.map_board(x,y, (tiles: TileRow): TileRow => {
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
        // output[free].prev.mergedFrom = tiles[i].prev.mergedFrom.x;  TODO
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
      return output;
    });

    if (somethingMoved) {
      this.spawnTile();
    }

    this.scheduleNextRender(now);
  }

  scheduleNextRender(now: number) {
    if (this.animationRequest == undefined && now - this.prevMoveTimeMs < 300) {
      this.animationRequest = window.requestAnimationFrame(this.boundRender);
    }
  }

  spawnTile(): boolean {
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
    this.animationRequest = undefined;
  
    gContext.clearRect(0, 0, gCanvas.width, gCanvas.height);
    gContext.fillStyle = kBackgroundStyle;
    gContext.fillRect(0, 0, gCanvas.width, gCanvas.height);

    this.renderTiles(now);
    this.scheduleNextRender(now);
  }

  renderTiles(nowInMs: number) {
    for (let r = 0; r < this.board.length; r++) {
      for (let c  = 0 ; c < this.board[r].length; c++) {
        this.renderTile(r, c, nowInMs);
      }
    }
  }

  drawTile(val: number) {
    const pad = kTilePadding;
    gContext.fillStyle = val in kTileStyle ? kTileStyle[val] : kTileStyle[2048];
    gContext.fillRect(-gTileSize/2 + pad, -gTileSize/2 + pad, gTileSize - 2*pad, gTileSize - 2*pad);

    // const font = 0.082*gCanvas.width + "px arial";
    const font = "78px arial";
    gContext.fillStyle = "black";
    gContext.font = font;
    gContext.textAlign = "center";
    gContext.fillText(val.toString(), 0, 3*pad, (gTileSize-kTilePadding*2)*.8);
  }

  // renders the animation frame at duration `now` of the given tile.
  renderTile(row: number, col: number, nowMs: number) {
    let tile = this.board[row][col];
    if (tile.val == -1) {
      return;
    }

    gContext.save();
    let val = tile.val;
    let curx = col*gTileSize + gTileSize/2;
    let cury = row*gTileSize + gTileSize/2;
    gContext.translate(curx, cury); // center of the tile.
    let translateFactor = (1 - (nowMs-this.prevMoveTimeMs)/kTranslateDuration); // pct left of translation animation.
    let wasMerged = tile.prev.mergedFrom.x != 0 || tile.prev.mergedFrom.y != 0;
    // translate animation for ghost tile that just got merged:
    if (translateFactor > 0 && wasMerged) {
      val = val / 2;
      gContext?.save();
      let deltax = tile.prev.mergedFrom.x*gTileSize;
      let deltay = tile.prev.mergedFrom.y*gTileSize;
      gContext?.translate(-deltax * translateFactor, -deltay * translateFactor); // center of the ghost tile.
      this.drawTile(val);
      gContext?.restore();
    }
    // translate animation for any moving tile
    if (translateFactor > 0 && (tile.prev.pos.x != 0 || tile.prev.pos.y != 0)) {
      let deltax = tile.prev.pos.x*gTileSize;
      let deltay = tile.prev.pos.y*gTileSize;
      gContext.translate(-deltax * translateFactor, -deltay * translateFactor); // animation position of the tile
    }
    // Merge outro animation (the part where they grind against each other and become one):
    else if (nowMs - this.prevMoveTimeMs < kTranslateDuration + kMergeOutroDuration && wasMerged) {
      let factor = (nowMs - this.prevMoveTimeMs - kTranslateDuration)/kMergeOutroDuration;
      gContext.scale(1 + 0.14*factor, 1 + 0.14*factor);
    }
    // appear animation for new tiles:  
    else if (nowMs - this.prevMoveTimeMs < kTranslateDuration && tile.prev.isNew) {
      gContext.scale(0,0);
    } else if (nowMs - this.prevMoveTimeMs < kTranslateDuration + kAppearDuration && tile.prev.isNew) {
      let factor = (nowMs - this.prevMoveTimeMs - kTranslateDuration)/kAppearDuration;
      gContext?.scale(factor,factor);
    }

    this.drawTile(val);

    gContext.restore();
  }

  stop() {
    // Stop any on going timers.
  }
}

function resizeCanvas() {
  let resize = () => {
    gContext.canvas.width = Math.min(window.innerWidth,window.innerHeight);
    gContext.canvas.height = Math.min(window.innerWidth,window.innerHeight);
    gTileSize = gCanvas.width/kRows;
    if (game) {
      game.render();
    }
  };
  window.onresize = resize;
  resize();
}

let game = new Game();
resizeCanvas();