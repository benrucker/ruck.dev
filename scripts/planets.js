var ctx;
var prevFrame;

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
    gravitate(other, delta) {
        let [dist, dx, dy] = this.distanceAndComponents(other);
        let mag = other.mass * -1 / (dist ** 2) * 5;

        if (isNaN(mag))
            return
        
        if (!isNaN(dx))
            this.xvel += dx * mag;
        if (!isNaN(dy))
            this.yvel += dy * mag;

        // this.xvel = isNaN(this.xvel) ? 0 : this.xvel
        // this.yvel = isNaN(this.yvel) ? 0 : this.yvel
    }
    distanceAndComponents(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;

        return [Math.hypot(dx, dy), dx, dy];
    }
    distance(other) {
        return this.distanceAndComponents(other)[0]
    }
}

let planets;
let mouse;
let sun;

function start() {
    var planetsCanvas = document.getElementById('planets');
    if (planetsCanvas.getContext) {
        ctx = planetsCanvas.getContext('2d');
        ctx.canvas.width  = window.innerWidth;
        ctx.canvas.height = window.innerHeight;

        document.body.addEventListener('mousemove', e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        var centerx = ctx.canvas.width / 2;
        var centery = ctx.canvas.height / 2;

        planets = new Set([
            new Planetoid(centerx + 100, centery, 0, 15),
            new Planetoid(centerx - 100, centery, 0, -15),
            new Planetoid(centerx + 30, centery - 150, 15, 0),
        ]);

        sun = {
            x: centerx,
            y: centery,
            mass: 10,
        }
        
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
    frameTime = Date.now();
    delta = frameTime - prevFrameTime;
    delta = Math.min(delta, 100)
    delta /= 100;
    window.requestAnimationFrame(draw);
    prevFrameTime = frameTime;
}

function draw() {
    // TODO:
    // make the rest of the screen move in parallax

    clearBackground();

    let toRemove = [];
    for (planet of planets) {
        for (planet2 of planets) {
            if (planet2 != planet) {
                if (planet.distance(planet2) < 5) {
                    // toRemove.push(planet);
                    // toRemove.push(planet2);
                    planets.delete(planet);
                    planets.delete(planet2)
                    break;
                }
                planet.gravitate(planet2, delta);
            }
        }
        planet.gravitate(mouse);
        planet.gravitate(sun);
    }

    // for(planet of toRemove) {
    //     planets.splice(planets.indexOf(planet), 1);
    //     console.log('splicing', planet)
    // }

    for (planet of planets) {
        planet.move(delta);
    }

    ctx.fillStyle = 'white';
    for (planet of planets) {
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, 3, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    ctx.fillStyle = '#f5b55b';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 5, 0, 2 * Math.PI);
    ctx.fill();

    drawAgain();
}

function clearBackground() {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function addPlanet(event) {
    planets.add(new Planetoid(event.clientX + 3, event.clientY + 3, 20, 0))
}

start();