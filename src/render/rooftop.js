const THOUGHT_INTERVAL = 5;
const DAY_END = 8;
const NIGHT_START = 14;
const DAWN_START = 24;
const CYCLE_SECONDS = 30;

const SKY_COLORS = {
  day: ['#417dbf', '#68aed3', '#9bd0db', '#e2d5b7', '#ba9ba8'],
  dusk: ['#4c4e80', '#77658c', '#b78099', '#f8a57f', '#83526c'],
  night: ['#080c24', '#1c2242', '#4d3c59', '#986478', '#442c49'],
};

const DAY_HOUSE_COLORS = {
  '#2c283f': '#65778d', '#8f695e': '#e4c395',
  '#282439': '#9a8079', '#3b3047': '#b99986', '#1e1c30': '#766475', '#534052': '#d0ad90',
  '#201d30': '#534a5a', '#a9746b': '#e0bd99', '#eab284': '#7f9fae', '#bd866f': '#9cb3b9', '#6c4d5c': '#c4af9c',
  '#242235': '#765d67', '#513c51': '#986e6a', '#ba9079': '#e8c491',
  '#2b2842': '#494b68', '#48405a': '#777089', '#372f47': '#5f5976',
  '#302a42': '#5e5972', '#3d344c': '#716780', '#736078': '#a999a5', '#181a2e': '#463d54',
  '#4b405a': '#75677d', '#40354d': '#8b6e7c', '#58465c': '#9f7d84', '#735b6b': '#b69494',
};
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

function paintHouse(ctx, w, h, day) {
  const p = (x, y) => [Math.round(w * x), Math.round(h * y)];
  function polygon(color, points) {
    ctx.fillStyle = (day && DAY_HOUSE_COLORS[color]) || color;
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
  // The picture window shows the workstation from the street.
  shape('#201d30', [.104, .851], [.309, .851], [.309, .973], [.104, .973]);
  shape('#a9746b', [.113, .86], [.300, .86], [.300, .965], [.113, .965]);
  shape('#eab284', [.120, .867], [.293, .867], [.293, .959], [.120, .959]);
  if (day) {
    shape('#49627b', [.120, .868], [.293, .868], [.293, .952], [.120, .952]);
    shape('#596b80', [.120, .922], [.293, .922], [.293, .956], [.120, .956]);
    shape('#72839a', [.129, .88], [.157, .88], [.157, .930], [.129, .930]);
    shape('#777c90', [.265, .879], [.288, .879], [.288, .930], [.265, .930]);
  } else {
    shape('#bd866f', [.120, .93], [.293, .93], [.293, .959], [.120, .959]);
  }
  shape('#6c4d5c', [.112, .955], [.300, .955], [.300, .963], [.112, .963]);

  const x = .476, center = x + .048;
  shape('#201d30', [x - .011, .863], [x + .106, .861], [x + .108, .963], [x - .01, .966]);
  shape('#a9746b', [x, .871], [x + .096, .871], [x + .096, .95], [x, .951]);
  shape('#eab284', [x + .006, .88], [x + .092, .88], [x + .092, .943], [x + .006, .943]);
  shape('#bd866f', [x + .006, .92], [x + .092, .92], [x + .092, .943], [x + .006, .943]);
  shape('#6c4d5c', [center - .002, .88], [center + .003, .88], [center + .003, .943], [center - .002, .943]);
  shape('#6c4d5c', [x, .906], [x + .096, .906], [x + .096, .911], [x, .911]);
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

}

function pixels(ctx, originX, originY, scale) {
  return (color, x, y, width, height) => {
    const left = Math.round(originX + x * scale);
    const top = Math.round(originY + y * scale);
    ctx.fillStyle = color;
    ctx.fillRect(left, top, Math.round(originX + (x + width) * scale) - left,
      Math.round(originY + (y + height) * scale) - top);
  };
}

function paintRooftopResident(ctx, w, h) {
  const scale = Math.max(1, Math.round(h / 240));
  const pixel = pixels(ctx, w * .269, h * .641, scale);
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

function paintWorkspace(ctx, w, h, seconds) {
  const pixel = pixels(ctx, .196 * w, .951 * h, Math.min(.15 * w / 34, .078 * h / 23));
  const hand = Math.floor(seconds * 6) % 3 === 0 ? 1 : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round(.120 * w), Math.round(.867 * h), Math.round(.173 * w), Math.round(.087 * h));
  ctx.clip();
  pixel('#32384f', -11, -11, 5, 12);
  pixel('#33384d', 4, -7, 27, 9);
  pixel('#a07b71', 4, -8, 28, 2);
  pixel('#323047', 18, -17, 10, 9);
  pixel('#91c5c1', 19, -16, 8, 6);
  pixel('#cbe5bf', 20, -15, 4, 1);
  pixel('#647f92', 21, -9, 4, 2);
  pixel('#e1b27f', 29, -12, 3, 4);
  pixel('#394959', -7, -13, 12, 14);
  pixel('#6d92a3', -6, -13, 9, 12);
  pixel('#4c6b85', 1, -9, 8, 4);
  pixel('#cf997e', 8, -7 - hand, 4, 2);
  pixel('#e2ab8f', -3, -22, 9, 9);
  pixel('#30283d', -5, -24, 10, 5);
  pixel('#30283d', -5, -21, 5, 6);
  pixel('#665065', -3, -24, 7, 1);
  pixel('#433545', 4, -19, 2, 1);
  pixel('#e2ab8f', 5, -17, 2, 2);
  ctx.restore();
}

function smoothstep(value, min, max) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function lightingAt(seconds) {
  const time = seconds % CYCLE_SECONDS;
  const daylight = time < DAWN_START ? 1 - smoothstep(time, DAY_END, NIGHT_START) : smoothstep(time, DAWN_START, CYCLE_SECONDS);
  const twilight = 4 * daylight * (1 - daylight);
  return { time, daylight, twilight };
}

function newLayer() {
  const canvas = document.createElement('canvas');
  return { canvas, context: canvas.getContext('2d') };
}

function paintSky(ctx, width, height, palette) {
  const background = ctx.createLinearGradient(0, 0, 0, height);
  [0, .33, .62, .82, 1].forEach((stop, i) => background.addColorStop(stop, palette[i]));
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
}

function paintStarHaze(ctx, width, height) {
  const noise = randomFrom(26);
  for (let i = 0; i < 1400; i++) {
    const x = noise(), band = (noise() + noise() + noise()) / 3;
    const y = .46 - x * .25 + (band - .5) * .47;
    ctx.fillStyle = i % 4 ? '#9e96cb0b' : '#d7bbe51c';
    ctx.fillRect(Math.round(x * width), Math.round(y * height), 1 + (i % 3 === 0), 1);
  }
}

function paintSun(ctx, width, height, time, daylight) {
  const morning = time >= DAWN_START;
  const progress = morning ? (time - DAWN_START) / (CYCLE_SECONDS - DAWN_START) : time / NIGHT_START;
  const x = width * (morning ? .05 + .095 * progress : .145 + .56 * progress);
  const y = height * (morning ? .68 - .43 * progress : .25 + .45 * progress ** 3);
  const scale = Math.max(.7, Math.min(width, height) / 290);
  const pixel = pixels(ctx, x, y, scale);
  ctx.globalAlpha = Math.min(1, daylight * 2.2) * .19;
  pixel('#fff0b2', -20, -10, 40, 20);
  pixel('#fff0b2', -10, -20, 20, 40);
  pixel('#fff0b2', -16, -16, 32, 32);
  ctx.globalAlpha = Math.min(1, daylight * 2.2) * .93;
  pixel('#fff2c4', -11, -7, 22, 14);
  pixel('#fff2c4', -7, -11, 14, 22);
  pixel('#fff2c4', -9, -9, 18, 18);
}

function paintClouds(ctx, width, height, seconds, daylight) {
  for (const [offset, elevation, speed, size] of [
    [.04, .33, .010, 1.15], [.72, .07, .006, .48], [.89, .41, .011, 1.17],
    [.35, .55, .005, .65], [.12, .59, .006, .7],
  ]) {
    const x = ((offset + seconds * speed + .16) % 1.32 - .16) * width;
    const pixel = pixels(ctx, x, height * elevation, Math.max(.7, width / 540) * size);
    ctx.globalAlpha = daylight * .63;
    pixel('#f3e8de', -23, 0, 59, 5);
    pixel('#f4ece6', -16, -4, 39, 6);
    pixel('#f7efea', -7, -8, 23, 9);
    pixel('#f9f0e5', 8, -12, 12, 9);
    ctx.globalAlpha = daylight * .32;
    pixel('#bfd2dd', -23, 3, 59, 3);
    pixel('#bfd2dd', -10, 6, 34, 2);
  }
}

function paintPlane(ctx, width, height, seconds, alpha) {
  const skyX = ((.76 + .062 * seconds) % 1.26 - .13) * width;
  const skyY = height * (.102 - .018 * Math.sin(seconds * .29));
  const scale = Math.max(.76, Math.min(width, height) / 250);
  const pixel = pixels(ctx, skyX, skyY, scale);
  for (let i = 1; i <= 15; i++) {
    ctx.globalAlpha = alpha * .52 * (1 - i / 16);
    pixel('#f8e8d8', -13 - i * 4, 1 + Math.floor(i / 5), 5, 1);
  }
  ctx.globalAlpha = alpha;
  pixel('#485d7e', -10, -1, 23, 3);
  pixel('#485d7e', -12, -6, 4, 6);
  pixel('#657b99', -6, 2, 8, 3);
  pixel('#4f6a8d', -2, -6, 5, 7);
  pixel('#fff1d5', -8, -2, 19, 2);
  pixel('#fff1d5', 11, -1, 4, 2);
  pixel('#c6dbe3', -2, 0, 11, 1);
}

function paintBirds(ctx, width, height, seconds, alpha) {
  const flock = ((.98 - seconds * .067) % 1.34 + 1.34) % 1.34 - .17;
  const scale = Math.max(.8, Math.min(width, height) / 250);
  ctx.globalAlpha = alpha;
  for (const [i, offset] of [0, 1, 1.65, 2.9, 4].entries()) {
    const x = width * (flock + offset * .043);
    const y = height * (.452 + Math.sin(seconds * .65 + i * .55) * .016 + i * .008);
    const pixel = pixels(ctx, x, y, scale * (1 - i * .055));
    const wing = Math.round(2 * Math.sin(seconds * 10 + i * 1.3));
    pixel('#3a4765', -1, 0, 3, 2);
    pixel('#414d6b', -4, wing, 4, 1);
    pixel('#414d6b', 2, -wing, 3, 1);
    pixel('#414d6b', -5, wing * 1.4, 2, 1);
    pixel('#414d6b', 4, -wing * 1.4, 2, 1);
  }
}

function paintStars(ctx, width, height, seconds, opacity, stars) {
  for (const star of stars) {
    const x = Math.round(star.x * width), y = Math.round(star.y * height);
    ctx.globalAlpha = opacity * (.28 + .60 * (.5 + .5 * Math.sin(star.pulse + seconds * (star.large ? 1.3 : .55))));
    ctx.fillStyle = star.tint > .83 ? '#ffe2b9' : star.tint > .4 ? '#cbd6ff' : '#aca7ed';
    ctx.fillRect(x, y, star.large ? 2 : 1, 1);
    if (star.large) {
      ctx.globalAlpha *= .48;
      ctx.fillRect(x - 2, y, 6, 1);
      ctx.fillRect(x, y - 2, 1, 5);
    }
  }
}

function paintMeteors(ctx, width, height, seconds, opacity) {
  for (const [lane, cadence, startOffset] of [[0, 2.45, .42], [1, 3.43, 1.6], [2, 5.7, 2.65]]) {
    const clock = seconds + startOffset;
    const cycle = Math.floor(clock / cadence);
    const phase = (clock % cadence) / (1.1 + lane * .13);
    if (phase >= 1) continue;
    const shot = randomFrom(918 + cycle * 97 + lane * 381);
    const startX = .43 + shot() * .56;
    const startY = [.018, .33, .48][lane] + shot() * .125;
    const x = startX - phase * (.37 - lane * .04);
    const y = startY + phase * (.12 + lane * .033);
    const shine = Math.sin(phase * Math.PI) * opacity;
    for (let i = 1; i < 29; i++) {
      ctx.globalAlpha = shine * .9 * (1 - i / 29);
      ctx.fillStyle = i < 6 ? '#f7e5d7' : '#b8baf1';
      ctx.fillRect(Math.round((x + i * .007) * width), Math.round((y - i * .0025) * height),
        Math.ceil(width * .007), i < 4 ? 2 : 1);
    }
    ctx.globalAlpha = shine;
    ctx.fillStyle = '#fff7d9';
    const headX = Math.round(x * width), headY = Math.round(y * height);
    ctx.fillRect(headX - 2, headY, 5, 1);
    ctx.fillRect(headX, headY - 2, 1, 5);
  }
}

export function startRooftop(canvas, thought) {
  const ctx = canvas.getContext('2d');
  const scene = canvas.parentElement;
  const dayHouse = newLayer(), nightHouse = newLayer();
  const sky = { day: newLayer(), dusk: newLayer(), night: newLayer() };
  const random = randomFrom(9208);
  const stars = Array.from({ length: 325 }, () => ({
    x: random(), y: random() * .81, pulse: random() * 6, large: random() > .945, tint: random(),
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  let width, height, frame, thoughtIndex = -1, previousMotion = false;
  let last = -Infinity;

  function resize() {
    const nextW = Math.max(180, Math.round(canvas.clientWidth / 2.75));
    const nextH = Math.max(180, Math.round(canvas.clientHeight / 2.75));
    if (nextW === width && nextH === height) return false;
    canvas.width = width = nextW;
    canvas.height = height = nextH;
    for (const layer of [...Object.values(sky), dayHouse, nightHouse]) {
      layer.canvas.width = width;
      layer.canvas.height = height;
    }
    for (const [name, layer] of Object.entries(sky)) paintSky(layer.context, width, height, SKY_COLORS[name]);
    paintStarHaze(sky.night.context, width, height);
    paintHouse(dayHouse.context, width, height, true);
    paintHouse(nightHouse.context, width, height, false);
    return true;
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const still = reduced.matches;
    if (now - last < 32 && width) return;
    const resized = resize();
    if (still && previousMotion && !resized) return;
    previousMotion = still;
    last = now;
    const seconds = still ? NIGHT_START : (now - start) / 1000;
    const { time, daylight, twilight } = lightingAt(seconds);
    const phase = daylight >= .88 ? 'day' : daylight <= .13 ? 'night' : 'twilight';
    if (scene.dataset.phase !== phase) scene.dataset.phase = phase;

    ctx.globalAlpha = 1;
    ctx.drawImage(sky.night.canvas, 0, 0);
    if (daylight > 0) {
      ctx.globalAlpha = daylight;
      ctx.drawImage(sky.day.canvas, 0, 0);
      ctx.globalAlpha = twilight * .84;
      ctx.drawImage(sky.dusk.canvas, 0, 0);
      paintSun(ctx, width, height, time, daylight);
      paintClouds(ctx, width, height, seconds, daylight);
      const skyTraffic = smoothstep(daylight, .35, .85);
      if (skyTraffic > 0 && !still) {
        paintPlane(ctx, width, height, seconds, skyTraffic);
        paintBirds(ctx, width, height, seconds, skyTraffic);
      }
    }

    const nightOpacity = 1 - smoothstep(daylight, .06, .68);
    if (nightOpacity > 0) {
      paintStars(ctx, width, height, seconds, nightOpacity, stars);
      if (!still) paintMeteors(ctx, width, height, seconds, nightOpacity ** 2);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(nightHouse.canvas, 0, 0);
    if (daylight > 0) {
      ctx.globalAlpha = daylight;
      ctx.drawImage(dayHouse.canvas, 0, 0);
    }

    const indoor = smoothstep(daylight, .45, .76);
    const rooftop = 1 - smoothstep(daylight, .045, .13);
    if (indoor > 0) {
      ctx.globalAlpha = indoor;
      paintWorkspace(ctx, width, height, seconds);
    }
    if (rooftop > 0) {
      ctx.globalAlpha = rooftop;
      paintRooftopResident(ctx, width, height);
    }
    ctx.globalAlpha = 1;

    const thoughtTime = Math.max(0, time - NIGHT_START);
    const index = (Math.floor(seconds / CYCLE_SECONDS) * 2 + Math.floor(thoughtTime / THOUGHT_INTERVAL)) % THOUGHTS.length;
    if (index !== thoughtIndex) {
      thought.textContent = THOUGHTS[index];
      thoughtIndex = index;
    }
    const showThought = rooftop > .9 && thoughtTime % THOUGHT_INTERVAL < THOUGHT_INTERVAL - .7;
    thought.classList.toggle('visible', showThought);
    if (thought.getAttribute('aria-hidden') !== String(!showThought)) thought.setAttribute('aria-hidden', String(!showThought));
  }

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
