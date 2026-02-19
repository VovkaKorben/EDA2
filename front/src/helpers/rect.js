export class Rect {
  constructor(left, top, right, bottom) {
    this.l = left;
    this.t = top;
    this.r = right;
    this.b = bottom;
  }

  // Геттер для эмуляции свойства Width
  get w() {
    return this.r - this.l;
  }
  get h() {
    return this.b - this.t;
  }

  // Метод для проверки пустоты, как в Delphi
  isEmpty() {
    return (this.l >= this.r) || (this.t >= this.b);
  }

  area() {
    return (this.r - this.l) * (this.b - this.t);

  }

  intersects(other) {
    return !(
      other.left >= this.r ||
      other.right <= this.l ||
      other.top >= this.b ||
      other.bottom <= this.t
    );
  }

}