export class Rect {
    constructor(left, top, right = left, bottom = top) {
        if (left instanceof Rect) {
            this.l = left.l;
            this.t = left.t;
            this.r = left.r;
            this.b = left.b;
        } else if (left instanceof Point) {
            this.l = left.x;
            this.t = left.y;
            this.r = left.x;
            this.b = left.y;
        } else {

            this.l = left;
            this.t = top;
            this.r = right;
            this.b = bottom;
        }
        return this;
    }

    get w() { return this.r - this.l; }
    get h() { return this.b - this.t; }
    get area() { return (this.r - this.l) * (this.b - this.t); }

    set w(value) { this.r = this.l + value; }
    set h(value) { this.b = this.t + value; }
    // Метод для проверки пустоты, как в Delphi
    //isEmpty() { return (this.l >= this.r) || (this.t >= this.b); }
    move(dx, dy = dx) {
        if (dx instanceof Point) {
            this.l += dx.x;
            this.r += dx.x;
            this.t += dx.y;
            this.b += dx.y;

        } else {
            this.l += dx;
            this.r += dx;
            this.t += dy;
            this.b += dy;
        }
    }

    multiply(mx, my = mx) {
        this.l *= mx;
        this.r *= mx;
        this.t *= my;
        this.b *= my;
    }

    intersects(other) { return !(other.l >= this.r || other.r <= this.l || other.t >= this.b || other.b <= this.t); }
    inRect(other) {
        // if (other instanceof Rect) {
        return this.l >= other.l && this.t >= other.t && this.r <= other.r && this.b <= other.b;

    }
    // assign(other) { this.l = other.l; this.r = other.r; this.t = other.t; this.b = other.b; }
    addPoint(point) {
        this.l = Math.min(this.l, point.x);
        this.r = Math.max(this.r, point.x);
        this.t = Math.min(this.t, point.y);
        this.b = Math.max(this.b, point.y);
    }

    union(figure) {

        if (figure instanceof Rect) {
            this.l = Math.min(this.l, figure.l);
            this.r = Math.max(this.r, figure.r);
            this.t = Math.min(this.t, figure.t);
            this.b = Math.max(this.b, figure.b);
        } else if (figure instanceof Point) {
            this.l = Math.min(this.l, figure.x);
            this.r = Math.max(this.r, figure.x);
            this.t = Math.min(this.t, figure.y);
            this.b = Math.max(this.b, figure.y);
        }
    }
    expand(dx, dy = dx) {


        this.l -= dx;
        this.r += dx;
        this.t -= dy;
        this.b += dy;

    }

}

export class Point {
    constructor(x, y) {
        if (x instanceof Array) {
            this.x = x[0];
            this.y = x[1];
        } else if (x instanceof Point) {
            this.x = x.x;
            this.y = x.y;
        } else {
            this.x = x;
            this.y = y;
        }
        return this;
    }
    move(dx, dy) {
        if (dx instanceof Point) {
            this.x += dx.x;
            this.y += dx.y;
        } else {
            this.x += dx;
            this.y += dy;
        }
    }
    subtract(dx, dy) {
        if (dx instanceof Point) {
            this.x -= dx.x;
            this.y -= dx.y;
        } else {
            this.x -= dx;
            this.y -= dy;
        }
    }
    multiply(mx, my = mx) {

        this.x *= mx;
        this.y *= my;
    }
    divide(mx, my = mx) {

        this.x /= mx;
        this.y /= my;
    }
    rotate(rotateIndex) {
        switch (rotateIndex) {
            case 0: break;
            case 1: [this.x, this.y] = [-this.y, this.x]; break;
            case 2: [this.x, this.y] = [-this.x, -this.y]; break;
            case 3: [this.x, this.y] = [this.y, -this.x]; break;
        }
    }
    inRect(rct) {
        return this.x >= rct.l && this.x <= rct.r && this.y >= rct.t && this.y <= rct.b;
    }
    round() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
    }
    toJSON() {
        return [this.x, this.y];
    }
    toFixed(decimals = 2) {
        return `${this.x.toFixed(decimals)},${this.y.toFixed(decimals)}`;

    }
}