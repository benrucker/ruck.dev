class Planetoid {
  constructor(x, y, xvel, yvel) {
    this.x = x;
    this.y = y;
    this.xvel = xvel;
    this.yvel = yvel;
    this.mass = 3;
  }

  move(delta) {
    this.x += this.xvel * delta;
    this.y += this.yvel * delta;
  }

  gravitateTowards(other, delta) {
    let [dist, dx, dy] = this.getDistanceAndComponents(other);
    let mag = ((other.mass * -1) / dist ** 2) * 5;

    if (isNaN(mag)) {
      return;
    }

    if (!isNaN(dx)) {
      this.xvel += dx * mag;
    }

    if (!isNaN(dy)) {
      this.yvel += dy * mag;
    }
  }

  getDistanceAndComponents(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;

    return [Math.hypot(dx, dy), dx, dy];
  }

  getDistance(other) {
    return this.getDistanceAndComponents(other)[0];
  }
}
