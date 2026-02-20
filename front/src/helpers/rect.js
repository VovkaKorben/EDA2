export class Rect {
  constructor(left, top, right, bottom) {
    this.l = left;
    this.t = top;
    this.r = right;
    this.b = bottom;
  }

  get w() { return this.r - this.l; }
  get h() { return this.b - this.t; }
  get area() { return (this.r - this.l) * (this.b - this.t); }

  set w(value) { this.r = this.l + value; }
  set h(value) { this.b = this.t + value; }
  // Метод для проверки пустоты, как в Delphi
  isEmpty() { return (this.l >= this.r) || (this.t >= this.b); }


  intersects(other) { return !(other.l >= this.r || other.r <= this.l || other.t >= this.b || other.b <= this.t); }
  inRect(other) { return this.l >= other.l && this.t >= other.t && this.r <= other.r && this.b <= other.b; }
  // assign(other) { this.l = other.l; this.r = other.r; this.t = other.t; this.b = other.b; }
}