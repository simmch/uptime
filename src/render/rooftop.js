const THOUGHT_INTERVAL = 6.4;
const THOUGHTS = [
  'How many nines does Rosa actually need?',
  'Could one server handle the lunch rush?',
  'A backup only counts if I can restore it.',
  'What happens if an entire region goes down?',
  'Why is my p95 so much higher than the average?',
  'Could I make the cloud bill a little smaller?',
];

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function paintHouse(ctx, w, h) {
  const p = (x, y) => [Math.round(w * x), Math.round(h * y)];
  function polygon(color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    points.slice(1).forEach(point => ctx.lineTo(...point));
    ctx.closePath();
    ctx.fill();
  }
  function shape(color, ...points) {
    polygon(color, points.map(([x, y]) => p(x, y)));
  }
  const skyline = randomFrom(132);
  for (let i = 0; i < 22; i++) {
    const x = i / 21 + (skyline() - .5) * .09;
    const width = .025 + skyline() * .077;
    const base = .81 + skyline() * .045;
    const top = base - (.025 + skyline() * .11);
    shape('#2c283f', [x - width / 2, top + .035], [x, top], [x + width / 2, top + .035],
      [x + width / 2, base + .12], [x - width / 2, base + .12]);
    if (i % 3 === 1) shape('#8f695e', [x - .006, top + .07], [x + .006, top + .07],
      [x + .006, top + .08], [x - .006, top + .08]);
  }

  // The lighted windows and siding underneath the roof carry through the game's dusk colors.
  shape('#282439', [.05, .79], [.56, .775], [.72, .85], [.72, 1.02], [.05, 1.02]);
  shape('#3b3047', [.077, .795], [.55, .785], [.63, .85], [.63, 1.02], [.077, 1.02]);
  shape('#1e1c30', [.63, .844], [.72, .85], [.72, 1.02], [.63, 1.02]);
  for (let y = .855; y < .995; y += .027) {
    shape('#534052', [.078, y], [.63, y - .008], [.63, y - .005], [.078, y + .003]);
  }
  for (const x of [.143, .476]) {
    const center = x + .048;
    shape('#201d30', [x - .011, .863], [x + .106, .861], [x + .108, .963], [x - .01, .966]);
    shape('#a9746b', [x, .871], [x + .096, .871], [x + .096, .95], [x, .951]);
    shape('#eab284', [x + .006, .88], [x + .092, .88], [x + .092, .943], [x + .006, .943]);
    shape('#bd866f', [x + .006, .92], [x + .092, .92], [x + .092, .943], [x + .006, .943]);
    shape('#6c4d5c', [center - .002, .88], [center + .003, .88], [center + .003, .943], [center - .002, .943]);
    shape('#6c4d5c', [x, .906], [x + .096, .906], [x + .096, .911], [x, .911]);
  }
  shape('#242235', [.315, .873], [.406, .872], [.407, 1.005], [.315, 1.005]);
  shape('#513c51', [.325, .879], [.393, .878], [.394, 1.004], [.327, 1.004]);
  shape('#ba9079', [.376, .936], [.382, .936], [.382, .943], [.376, .943]);

  const ridge = [.269, .631];
  shape('#2b2842', [.014, .815], ridge, [.566, .642], [.748, .848], [.62, .864]);
  shape('#48405a', [.027, .807], ridge, [.568, .647], [.621, .850]);
  shape('#372f47', [.269, .631], [.571, .641], [.748, .848], [.625, .850], [.505, .731]);
  for (let step = 1; step <= 7; step++) {
    const t = step / 8;
    const left = [.269 + (.024 - .269) * t, .635 + (.8 - .635) * t];
    const right = [.512 + (.62 - .512) * t, .722 + (.852 - .722) * t];
    shape(step % 2 ? '#302a42' : '#3d344c', left, right, [right[0], right[1] + .009], [left[0], left[1] + .007]);
  }
  shape('#736078', [.019, .805], [.257, .63], [.269, .626], [.566, .638], [.571, .643],
    [.269, .636], [.033, .812]);
  shape('#181a2e', [.014, .809], [.618, .85], [.747, .841], [.748, .851], [.619, .867], [.014, .827]);
  shape('#4b405a', [.014, .811], [.618, .852], [.748, .844], [.745, .853], [.618, .86], [.014, .822]);
  shape('#40354d', [.544, .685], [.573, .696], [.573, .604], [.543, .595]);
  shape('#58465c', [.519, .599], [.546, .595], [.546, .686], [.519, .682]);
  shape('#735b6b', [.513, .589], [.546, .581], [.579, .596], [.573, .608], [.516, .602]);

  // A seated figure with bent knees, one hand braced on the ridge, looking up.
  const [chairX, chairY] = p(.269, .641);
  const scale = Math.max(1, Math.round(h / 240));
  const pixel = (color, x, y, width, height) => {
    ctx.fillStyle = color;
    ctx.fillRect(chairX + x * scale, chairY + y * scale, width * scale, height * scale);
  };
  pixel('#241e35', -10, -1, 33, 4);
  pixel('#161b31', 2, -11, 15, 6);
  pixel('#353d5f', 3, -11, 15, 5);
  pixel('#3c476b', 13, -7, 5, 8);
  pixel('#20243a', 14, 0, 11, 3);
  pixel('#58607a', 20, 0, 4, 2);
  pixel('#1c2037', -6, -24, 13, 16);
  pixel('#4a6785', -6, -22, 12, 13);
  pixel('#718ca0', -5, -22, 3, 10);
  pixel('#384b6d', -9, -17, 3, 10);
  pixel('#4b5877', -11, -9, 4, 9);
  pixel('#bf8d80', -12, 0, 5, 2);
  pixel('#7291a1', 3, -20, 4, 7);
  pixel('#556a89', 7, -14, 6, 3);
  pixel('#cb9582', 12, -14, 4, 3);
  pixel('#624658', -1, -26, 6, 5);
  pixel('#e2ab8f', -1, -33, 10, 9);
  pixel('#f2c0a1', 6, -34, 4, 6);
  pixel('#2a233b', -3, -35, 8, 11);
  pixel('#3d3044', -1, -37, 9, 7);
  pixel('#665065', 0, -37, 6, 2);
  pixel('#46374b', 5, -35, 4, 3);
  pixel('#31263e', 8, -33, 2, 2);
  pixel('#e2ab8f', 9, -31, 2, 2);
}

export function startRooftop(canvas, thought) {
  const ctx = canvas.getContext('2d');
  const staticFrame = document.createElement('canvas');
  const staticCtx = staticFrame.getContext('2d');
  const random = randomFrom(9208);
  const stars = Array.from({ length: 325 }, () => ({
    x: random(), y: random() * .81, pulse: random() * 6, large: random() > .945, tint: random(),
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  let width, height, frame, thoughtIndex = -1;
  let last = -Infinity;

  function resize() {
    const nextW = Math.max(180, Math.round(canvas.clientWidth / 2.75));
    const nextH = Math.max(180, Math.round(canvas.clientHeight / 2.75));
    if (nextW === width && nextH === height) return false;
    canvas.width = staticFrame.width = width = nextW;
    canvas.height = staticFrame.height = height = nextH;
    const background = staticCtx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#080c24');
    background.addColorStop(.33, '#1c2242');
    background.addColorStop(.62, '#4d3c59');
    background.addColorStop(.82, '#986478');
    background.addColorStop(1, '#442c49');
    staticCtx.fillStyle = background;
    staticCtx.fillRect(0, 0, width, height);

    const mist = randomFrom(26);
    for (let i = 0; i < 1400; i++) {
      const x = mist(), band = (mist() + mist() + mist()) / 3;
      const y = .46 - x * .25 + (band - .5) * .47;
      staticCtx.fillStyle = i % 4 ? '#9e96cb0b' : '#d7bbe51c';
      staticCtx.fillRect(Math.round(x * width), Math.round(y * height), 1 + (i % 3 === 0), 1);
    }
    staticCtx.fillStyle = '#0d1227';
    staticCtx.fillRect(0, height - 1, width, 1);
    return true;
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (now - last < 32 && width) return;
    const resized = resize();
    if (reduced && !resized && last > -Infinity) return;
    last = now;
    const seconds = reduced ? .35 : (now - start) / 1000;
    ctx.drawImage(staticFrame, 0, 0);
    for (const star of stars) {
      const x = Math.round(star.x * width), y = Math.round(star.y * height);
      ctx.globalAlpha = .28 + .60 * (.5 + .5 * Math.sin(star.pulse + seconds * (star.large ? 1.3 : .55)));
      ctx.fillStyle = star.tint > .83 ? '#ffe2b9' : star.tint > .4 ? '#cbd6ff' : '#aca7ed';
      ctx.fillRect(x, y, star.large ? 2 : 1, 1);
      if (star.large) {
        ctx.globalAlpha *= .48;
        ctx.fillRect(x - 2, y, 6, 1);
        ctx.fillRect(x, y - 2, 1, 5);
      }
    }
    ctx.globalAlpha = 1;

    const meteorClock = seconds + .43;
    const cycle = Math.floor(meteorClock / 3.8);
    const phase = (meteorClock % 3.8) / 1.25;
    if (!reduced && phase < 1) {
      const shot = randomFrom(103 + cycle);
      const startX = .51 + shot() * .47, startY = .016 + shot() * .14;
      const x = startX - phase * .35, y = startY + phase * .14;
      const shine = Math.sin(phase * Math.PI);
      for (let i = 1; i < 25; i++) {
        ctx.globalAlpha = shine * .92 * (1 - i / 25);
        ctx.fillStyle = i < 6 ? '#f6e0d4' : '#b7b4ee';
        ctx.fillRect(Math.round((x + i * .006) * width), Math.round((y - i * .0024) * height), 2, 1);
      }
      ctx.globalAlpha = shine;
      ctx.fillStyle = '#fff7d9';
      const sx = Math.round(x * width), sy = Math.round(y * height);
      ctx.fillRect(sx - 2, sy, 5, 1);
      ctx.fillRect(sx, sy - 2, 1, 5);
      ctx.globalAlpha = 1;
    }

    paintHouse(ctx, width, height);
    const index = Math.floor(seconds / THOUGHT_INTERVAL) % THOUGHTS.length;
    if (index !== thoughtIndex) {
      thought.textContent = THOUGHTS[index];
      thoughtIndex = index;
    }
    thought.classList.toggle('visible', reduced || (seconds % THOUGHT_INTERVAL < THOUGHT_INTERVAL - .75));
  }

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
