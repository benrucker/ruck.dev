let ctx;
let prevFrameTime;
let delta;
let planets;
let mouse;
let sun;

function start() {
  const planetsCanvas = document.getElementById("planets");
  if (planetsCanvas.getContext) {
    ctx = planetsCanvas.getContext("2d");

    function resize() {
      ctx.canvas.width = window.innerWidth;
      ctx.canvas.height = window.innerHeight;
    }
    resize();

    document.body.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("resize", resize);

    const centerx = ctx.canvas.width / 2;
    const centery = ctx.canvas.height / 2;

    planets = new Set([
      new Planetoid(centerx * 1.3, centery, 0, 15),
      new Planetoid(centerx - centerx * 0.3, centery, 0, -15),
      new Planetoid(centerx + 10, centery * 1.5, -15, 0),
    ]);

    sun = {
      x: centerx,
      y: centery,
      mass: 10,
    };

    mouse = {
      x: centerx,
      y: centery,
      mass: 1,
    };

    startDrawing();
  }
}

function startDrawing() {
  prevFrameTime = Date.now();
  drawAgain();
}

function drawAgain() {
  const frameTime = Date.now();
  delta = frameTime - prevFrameTime;
  delta = Math.min(delta, 100);
  delta /= 100;
  window.requestAnimationFrame(draw);
  prevFrameTime = frameTime;
}

function draw() {
  clearBackground();

  for (const planet of planets) {
    for (const planet2 of planets) {
      if (planet2 != planet) {
        if (planet.getDistance(planet2) < 5) {
          planets.delete(planet);
          planets.delete(planet2);
          break;
        }
        planet.gravitateTowards(planet2, delta);
      }
    }
    planet.gravitateTowards(mouse);
    planet.gravitateTowards(sun);
  }

  for (const planet of planets) {
    planet.move(delta);
  }

  for (const planet of planets) {
    for (const planet2 of planets) {
      if (planet.x === planet2.x && planet.y === planet2.y) {
        continue;
      }

      drawGravityLine(planet, planet2);
    }
    drawGravityLine(planet, mouse);
  }

  ctx.fillStyle = "#dbcbb8";
  for (const planet of planets) {
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.fillStyle = "#f5b55b";
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 5, 0, 2 * Math.PI);
  ctx.fill();

  drawAgain();
}

function drawGravityLine(planet1, planet2) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(120, 80, 40, ${convertDistanceToOpacity(
    planet1.getDistance(planet2)
  )})`;
  ctx.beginPath();
  ctx.moveTo(planet1.x, planet1.y);
  ctx.lineTo(planet2.x, planet2.y);
  ctx.closePath();
  ctx.stroke();
}

Number.prototype.map = function (in_min, in_max, out_min, out_max) {
  return ((this - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
};

function convertDistanceToOpacity(distance) {
  if (distance > 200) {
    return 0;
  }
  return distance.map(0, 200, 1, 0);
}

function clearBackground() {
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function addPlanet(event) {
  planets.add(new Planetoid(event.clientX + 3, event.clientY + 3, 20, 0));
}

start();
