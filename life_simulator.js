// ==========================
// PIXI SETUP
// ==========================
const app = new PIXI.Application({
    view: document.getElementById("cellCanvas"),
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true
});

// one layer that we can blur slightly
const metaballLayer = new PIXI.Container();
app.stage.addChild(metaballLayer);

const cellsContainer = new PIXI.Container();
metaballLayer.addChild(cellsContainer);

const transitions = new PIXI.Graphics();
metaballLayer.addChild(transitions);

const blurFilter = new PIXI.BlurFilter();
blurFilter.blur = 4;        // tweak 2–6 if you want
blurFilter.quality = 2;
metaballLayer.filters = [blurFilter];

function easeInOut(t) {
    return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ==========================
// CELL CLASS
// ==========================
class Cell {
    constructor(x, y, r, type = "small") {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.radius = r !== undefined ? r : 10 + Math.random() * 8;
        this.type = type; // "small" or "big"

        this.graphics = new PIXI.Graphics();
        cellsContainer.addChild(this.graphics);
    }

    update(mouse) {
        // energetic random wandering
        this.vx += (Math.random() - 0.5) * 0.16;
        this.vy += (Math.random() - 0.5) * 0.36;

        // all cells: soft repulsion from pointer/touch
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelDist = 150;

        if (dist < repelDist) {
            const force = (repelDist - dist) / repelDist;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * 0.8 * force;
            this.vy += Math.sin(angle) * 0.8 * force;
        }

        // damping + speed clamp
        this.vx *= 0.97;
        this.vy *= 0.97;
        const speed = Math.hypot(this.vx, this.vy);
        const maxSpeed = 3.0;
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // position update
        this.x += this.vx;
        this.y += this.vy;

        // wrap around edges
        const w = app.renderer.width;
        const h = app.renderer.height;
        if (this.x < -50) this.x = w + 50;
        if (this.x > w + 50) this.x = -50;
        if (this.y < -50) this.y = h + 50;
        if (this.y > h + 50) this.y = -50;
    }

    draw() {
        const g = this.graphics;
        g.clear();

        const fillColor = this.type === "big" ? 0xFFF5D9 : 0x88d4c7;

        g.lineStyle(2, 0xFFF5D9, 1);
        g.beginFill(fillColor, .1);
        g.drawCircle(0, 0, this.radius);
        g.endFill();

        g.position.set(this.x, this.y);
    }

    destroy() {
        cellsContainer.removeChild(this.graphics);
        this.graphics.destroy();
    }
}

// ==========================
// STATE
// ==========================
let cells = [];
const initialSmallCount = 25;

for (let i = 0; i < initialSmallCount; i++) {
    cells.push(
        new Cell(
            Math.random() * app.renderer.width,
            Math.random() * app.renderer.height,
            undefined,
            "small"
        )
    );
}

// merge animations – two small → one big
// { x1,y1,r1, x2,y2,r2, midVx,midVy, newR, progress }
let mergeEvents = [];

// simple death fade events
// { x,y,r, alpha, color }
let deathEvents = [];

// simple bubble-pop events
// { x, y, progress, maxRadius, particles: [{ angle, speed, radius }] }
let popEvents = [];

// ==========================
// INPUT
// ==========================
const canvas = app.view;
const mouse = { x: -9999, y: -9999 };
let pointerActive = false;

function resetMouse() {
    mouse.x = -9999;
    mouse.y = -9999;
}

function updateMouse(e) {
    if (!pointerActive) return;

    if (e.touches && e.touches.length) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        return;
    }

    mouse.x = e.clientX;
    mouse.y = e.clientY;
}

function spawnBubblePop(x, y, radius) {
    const particleCount = 8;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            angle: (Math.PI * 2 * i) / particleCount,
            speed: radius * (0.6 + Math.random() * 0.4),
            radius: Math.max(2, radius * 0.14)
        });
    }

    popEvents.push({
        x,
        y,
        progress: 0,
        maxRadius: radius * 1.8,
        particles
    });
}

function removeCellAtPointer(x, y) {
    for (let i = cells.length - 1; i >= 0; i--) {
        const cell = cells[i];
        const dx = x - cell.x;
        const dy = y - cell.y;

        if (Math.hypot(dx, dy) <= cell.radius) {
            deathEvents.push({
                x: cell.x,
                y: cell.y,
                r: cell.radius,
                alpha: 0.35,
                color: cell.type === "big" ? 0xFFF5D9 : 0x88d4c7
            });

            spawnBubblePop(cell.x, cell.y, cell.radius);
            cell.destroy();
            cells.splice(i, 1);
            return true;
        }
    }

    return false;
}

function activatePointer(e) {
    const point = e.touches && e.touches.length ? e.touches[0] : e;
    const hitCell = removeCellAtPointer(point.clientX, point.clientY);

    if (hitCell) {
        pointerActive = false;
        resetMouse();
        return;
    }

    pointerActive = true;
    updateMouse(e);
}

function deactivatePointer() {
    pointerActive = false;
    resetMouse();
}

canvas.addEventListener("pointerdown", activatePointer);
canvas.addEventListener("pointermove", updateMouse);
canvas.addEventListener("pointerleave", deactivatePointer);
window.addEventListener("pointerup", deactivatePointer);
window.addEventListener("pointercancel", deactivatePointer);

// ==========================
// COLLISIONS + SMALL → BIG MERGE
// ==========================
function handleCollisions() {
    for (let i = 0; i < cells.length; i++) {
        const a = cells[i];

        for (let j = i + 1; j < cells.length; j++) {
            const b = cells[j];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = a.radius + b.radius;

            if (dist < minDist) {
                const bothSmall = a.type === "small" && b.type === "small";
                const mergeChance = 0.2; // 10%

                if (bothSmall && Math.random() < mergeChance) {
                    const midX = (a.x + b.x) / 2;
                    const midY = (a.y + b.y) / 2;
                    const midVx = (a.vx + b.vx) / 2;
                    const midVy = (a.vy + b.vy) / 2;
                    const newR = (a.radius + b.radius) * 0.9;

                    // schedule merge animation
                    mergeEvents.push({
                        x1: a.x,
                        y1: a.y,
                        r1: a.radius,
                        x2: b.x,
                        y2: b.y,
                        r2: b.radius,
                        midVx,
                        midVy,
                        newR,
                        progress: 0
                    });

                    // add little fade ghosts where the parents were
                    deathEvents.push({
                        x: a.x,
                        y: a.y,
                        r: a.radius,
                        alpha: 0.7,
                        color: 0x88d4c7
                    });
                    deathEvents.push({
                        x: b.x,
                        y: b.y,
                        r: b.radius,
                        alpha: 0.7,
                        color: 0x88d4c7
                    });

                    a.destroy();
                    b.destroy();
                    cells.splice(j, 1);
                    cells.splice(i, 1);
                    i--;
                    break;
                }

                // basic bounce for non-merging collisions
                const angle = Math.atan2(dy, dx);
                const overlap = minDist - dist;

                a.x -= Math.cos(angle) * overlap / 2;
                a.y -= Math.sin(angle) * overlap / 2;
                b.x += Math.cos(angle) * overlap / 2;
                b.y += Math.sin(angle) * overlap / 2;

                const tvx = a.vx;
                const tvy = a.vy;
                a.vx = b.vx;
                a.vy = b.vy;
                b.vx = tvx;
                b.vy = tvy;
            }
        }
    }
}

// ==========================
// SMALL CELL REPRODUCTION (simple split)
// ==========================
function maybeSpawnSplits() {
    // bumped up a bit so you actually see splits
    const reproductionChance = 0.00035;

    for (let i = cells.length - 1; i >= 0; i--) {
        const c = cells[i];
        if (c.type !== "small") continue;

        if (Math.random() < reproductionChance) {
            const angle = Math.random() * Math.PI * 2;
            const offset = c.radius * 2.0;

            // positions of the two children
            const x1 = c.x + Math.cos(angle) * offset;
            const y1 = c.y + Math.sin(angle) * offset;
            const x2 = c.x - Math.cos(angle) * offset;
            const y2 = c.y - Math.sin(angle) * offset;

            const child1 = new Cell(x1, y1, c.radius, "small");
            const child2 = new Cell(x2, y2, c.radius, "small");

            // small extra kick away from each other
            const extraKick = 0.7;
            child1.vx = c.vx + Math.cos(angle) * extraKick;
            child1.vy = c.vy + Math.sin(angle) * extraKick;
            child2.vx = c.vx - Math.cos(angle) * extraKick;
            child2.vy = c.vy - Math.sin(angle) * extraKick;

            // fade-out ghost of the parent
            deathEvents.push({
                x: c.x,
                y: c.y,
                r: c.radius,
                alpha: 0.7,
                color: 0x88d4c7
            });

            c.destroy();
            cells.splice(i, 1);
        }
    }
}

// ==========================
// DEATH FADES
// ==========================
function updateAndDrawDeaths() {
    for (let i = deathEvents.length - 1; i >= 0; i--) {
        const d = deathEvents[i];

        transitions.lineStyle(2, 0xFFF5D9, d.alpha * 0.6);
        transitions.beginFill(d.color, d.alpha);
        transitions.drawCircle(d.x, d.y, d.r);
        transitions.endFill();

        d.alpha -= 0.02; // fade speed
        if (d.alpha <= 0) {
            deathEvents.splice(i, 1);
        }
    }
}

function updateAndDrawPops() {
    for (let i = popEvents.length - 1; i >= 0; i--) {
        const pop = popEvents[i];
        pop.progress += 0.08;

        const t = Math.min(pop.progress, 1);
        const ringRadius = pop.maxRadius * t;
        const alpha = 1 - t;

        transitions.lineStyle(2, 0xFFF5D9, alpha);
        transitions.drawCircle(pop.x, pop.y, ringRadius);

        for (let j = 0; j < pop.particles.length; j++) {
            const particle = pop.particles[j];
            const px = pop.x + Math.cos(particle.angle) * particle.speed * t;
            const py = pop.y + Math.sin(particle.angle) * particle.speed * t;

            transitions.beginFill(0xFFF5D9, alpha * 0.8);
            transitions.drawCircle(px, py, particle.radius * (1 - t * 0.35));
            transitions.endFill();
        }

        if (pop.progress >= 1) {
            popEvents.splice(i, 1);
        }
    }
}

// ==========================
// MERGE EVENTS (two small → one big)
// ==========================
function updateAndDrawMerges() {
    for (let i = mergeEvents.length - 1; i >= 0; i--) {
        const m = mergeEvents[i];

        m.progress += 0.02;
        if (m.progress > 1) m.progress = 1;

        const t = easeInOut(m.progress);

        const midX = (m.x1 + m.x2) / 2;
        const midY = (m.y1 + m.y2) / 2;

        const cx1 = m.x1 + (midX - m.x1) * t;
        const cy1 = m.y1 + (midY - m.y1) * t;
        const cx2 = m.x2 + (midX - m.x2) * t;
        const cy2 = m.y2 + (midY - m.y2) * t;

        let smallAlpha, bigAlpha;
        if (t < 0.4) {
            smallAlpha = 1;
            bigAlpha = 0;
        } else if (t < 0.7) {
            smallAlpha = 1;
            bigAlpha = (t - 0.4) / 0.3;
        } else {
            smallAlpha = 1 - (t - 0.7) / 0.3;
            bigAlpha = 1;
        }

        // draw the two parent circles (no connector, blur does the magic)
        transitions.lineStyle(2, 0xFFF5D9, .3);
        transitions.beginFill(0x88d4c7, .3);
        transitions.drawCircle(cx1, cy1, m.r1);
        transitions.endFill();

        transitions.beginFill(0x88d4c7, .3);
        transitions.drawCircle(cx2, cy2, m.r2);
        transitions.endFill();

        // big cell at midpoint – use *constant* radius m.newR so no size jump
        const bigR = m.newR;

        transitions.lineStyle(2, 0xFFF5D9, .3);
        transitions.beginFill(0xFFF5D9, .3);
        transitions.drawCircle(midX, midY, bigR);
        transitions.endFill();

        if (m.progress >= 1) {
            const big = new Cell(midX, midY, m.newR, "big");
            big.vx = m.midVx;
            big.vy = m.midVy;
            cells.push(big);
            mergeEvents.splice(i, 1);
        }
    }
}

// ==========================
// MAIN ANIMATION LOOP
// ==========================
app.ticker.add(() => {
    transitions.clear();

    handleCollisions();

    // update normal cells
    for (let i = 0; i < cells.length; i++) {
        cells[i].update(mouse);
    }

    // schedule simple splits (no connector, just two cells flying apart)
    maybeSpawnSplits();

    // draw death fades & merge animations
    updateAndDrawDeaths();
    updateAndDrawPops();
    updateAndDrawMerges();

    // draw all normal cells
    for (let i = 0; i < cells.length; i++) {
        cells[i].draw();
    }
});
