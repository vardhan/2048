import { Keyboard } from "./keyboard";

const kRows = 4;
const kColumns = 4;
const kBackgroundStyle = "#004643"; // https://www.happyhues.co/palettes/10
const kTileSize = 90;
const kTilePadding = 5;
const kTileStyle = "#f9bc60";

const kTranslateDuration = 100;
const kAppearDuration = 100;
const kMergeOutroDuration = 10;
const gCanvas = document.getElementById("canvas") as HTMLCanvasElement;
const gContext = gCanvas.getContext("2d");

interface Coord {
  x: number,
  y: number,
}
function isempty(c: Coord): boolean {
  return c.x == 0 && c.y == 0;
}
interface TileDiff {
  pos: Coord,
  mergedFrom: Coord,
  isNew: boolean
}
class Tile {
  val: number;
  prev: TileDiff;

  constructor(val: number)  {
    this.val = val;
    this.prev = {pos: {x:0, y: 0}, mergedFrom: {x:0, y:0}, isNew: true};
  }
}

// Board is an array of kRows. Each row is an array of column values.
type Board = Array<Array<Tile>>;
class Game {
  board: Board = Array<Array<Tile>>(kRows)
    .fill(undefined)
    .map((_, i) => Array(kColumns).fill(undefined));
  keyboard: Keyboard;
  prevMoveTime: Date = Date.now();

  constructor() {
    this.keyboard = new Keyboard({
      ArrowLeft: () => { this.move(-1, 0); },
      ArrowDown: () => { this.move(0, 1); },
      ArrowRight: () => { this.move(1, 0); },
      ArrowUp: () => { this.move(0, -1); }
    });

    this.spawnTile();
    this.spawnTile();
    this.render();
  }

  // map each row or each column of the board in an order dictated by `x` and `y`.
  //
  // if abs(y) > 0, then each col of the board is processed. if y > 0, then the col order is bottom tile first. otherwise top.
  // else if abs(x) > 0, then each row of the board is processed. if x > 0, then the row order is right tile first. otherwise left.
  //
  // the col/row returned by `processor` is used to update the board.
  //
  // requires: x,y in [-1,0,1] && abs(x) xor abs(y)
  map_board(x: number, y: number, processor: (input: Array<Tile>) => Array<Tile>) {
    if (x != 0) {
      for (let r = 0; r < this.board.length; r++) {
        if (x > 0) {
          this.board[r].reverse();
        }
        let output = processor(this.board[r]);
        if (x > 0) {
          output.reverse();
        }
        this.board[r] = output;
      }
    }
    else if (y != 0) {
      for (let c = 0; c < this.board.length; c++) {
        // extract column
        let col = this.board.map((row: Array<Tile>) => row[c]);
        if (y > 0) {
          col.reverse();
        }
        let output = processor(col);
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
    this.prevMoveTime = Date.now();
    let somethingMoved = false;
    this.map_board(x,y, (tiles: Array<Tile>): Array<Tile> => {
      let output = new Array<Tiles>(tiles.length).fill(undefined);
      let free = 0;
      let skipMerge = false;
      for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] == undefined) {
          continue;
        }
        tiles[i].prev = {pos: {x: 0, y: 0}, isNew: false, mergedFrom: {x:0, y:0}};
        // move to the left?
        output[free] = tiles[i];
        output[free].prev.pos = {x: x * (i-free), y: y * (i-free)};
        // merge?
        if (free > 0 && output[free-1].val == output[free].val && !skipMerge) {
          output[free - 1].val += output[free].val;
          output[free - 1].prev.mergedFrom = {x: output[free].prev.pos.x + x, y: output[free].prev.pos.y + y};
          output[free] = undefined;
          skipMerge = true;
        } else {
          free++;
          skipMerge = false;
        }
      }
      if (!somethingMoved) {
        somethingMoved = !output.every((_, index) => {
          if (tiles[index] == undefined || output[index] == undefined) {
            return tiles[index] == output[index]
          }
          return tiles[index].val == output[index].val
        });
      }
      return output;
    });

    if (somethingMoved) {
      this.spawnTile();
    }
    this.render();
  }

  // returns false if no space (e.g game over!).  otherwise true
  spawnTile(): boolean {
    let sampleSize = 0;
    let randomr = 0;
    let randomc = 0;
    for (let r = 0; r < this.board.length; r++) {
      for (let c  = 0 ; c < this.board[r].length; c++) {
        let tile = this.board[r][c];
        if (tile == undefined) {
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
    let tile = new Tile(2);
    tile.prev.isNew = true;
    this.board[randomr][randomc] = tile;
    return true;
  }

  render() {
    gContext.clearRect(0, 0, gCanvas.width, gCanvas.height);
    gContext.fillStyle = kBackgroundStyle;
    gContext.fillRect(0, 0, kColumns * kTileSize + kTilePadding, kRows * kTileSize + kTilePadding);

    let now = Date.now();
    this.renderTiles(now);

    // render()-Animate for the next second if we made a move.
    if (now - this.prevMoveTime < 300) {
      window.requestAnimationFrame((_) => { this.render(); });
    }
  }

  renderTiles(now: Date) {
    for (let r = 0; r < this.board.length; r++) {
      for (let c  = 0 ; c < this.board[r].length; c++) {
        this.renderTile(r, c, now);
      }
    }
  }

  drawTile(val: number) {
    const pad = kTilePadding;
    gContext.fillStyle = kTileStyle;
    gContext.fillRect(-kTileSize/2 + pad, -kTileSize/2 + pad, kTileSize - pad, kTileSize - pad);

    gContext.fillStyle = "black";
    gContext.font = "30px verdana";
    gContext.textAlign = "center";
    gContext.fillText(String(val), 0, 10);
  }

  renderTile(row: number, col: number, now: Date) {
    let tile = this.board[row][col];
    if (tile == undefined) {
      return;
    }

    gContext.save();
    let val = tile.val;
    let curx = col*kTileSize + kTileSize/2;
    let cury = row*kTileSize + kTileSize/2;
    gContext.translate(curx, cury);
    let translateFactor = (1 - (now-this.prevMoveTime)/kTranslateDuration);
    // translate animation for ghost tile that just got merged:
    if (translateFactor > 0 && (tile.prev.mergedFrom.x != 0 || tile.prev.mergedFrom.y != 0)) {
      val = val / 2;
      gContext?.save();
      let deltax = tile.prev.mergedFrom.x*kTileSize;
      let deltay = tile.prev.mergedFrom.y*kTileSize;
      gContext?.translate(-deltax * translateFactor, -deltay * translateFactor);
      this.drawTile(val);
      gContext?.restore();
    }
    // translate animation for any moving tile
    if (translateFactor > 0 && (tile.prev.pos.x != 0 || tile.prev.pos.y != 0)) {
      let deltax = tile.prev.pos.x*kTileSize;
      let deltay = tile.prev.pos.y*kTileSize;
      gContext.translate(-deltax * translateFactor, -deltay * translateFactor);
    }
    // Merge outro animation:
    // else if (now - this.prevMoveTime < kTranslateDuration + kMergeOutroDuration && !isempty(tile.prev.mergedFrom)) {
    //   let factor = (now - this.prevMoveTime - kTranslateDuration)/kMergeOutroDuration;
    //   gContext.scale(1+factor/2, 1+factor/2);
    // }
    // appear animation for new tiles:  
    else if (now - this.prevMoveTime < kTranslateDuration && tile.prev.isNew) {
      gContext.scale(0,0);
    } else if (now - this.prevMoveTime < kTranslateDuration + kAppearDuration && tile.prev.isNew) {
      let factor = (now - this.prevMoveTime - kTranslateDuration)/kAppearDuration;
      gContext.scale(factor, factor);
    }

    this.drawTile(val);

    gContext.restore();
  }

  stop() {
    // Stop any on going timers.
  }
}

let game = new Game();
// document.getElementById("new_game").addEventListener("click", (ev) => {
//   game.stop();
//   game = new Game();
// });