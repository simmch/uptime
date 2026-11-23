import { ROOM_NAMES } from '../data/legacy.js';

const WIDTH = 6.35;
const DEPTH = 5.9;
const EDGE = 8.8;
const WALL = '#897688';

const ROOMS = {
  reading: { colors: ['#987060', '#795b83'], station: 'Reading chair', action: 'Read and unwind' },
  nursery: { colors: ['#a48173', '#7789a4'], station: 'Family room', action: 'Spend time with family' },
  dining: { colors: ['#b68a66', '#986573'], station: 'Family table', action: 'Spend time with family' },
  guest: { colors: ['#aa8b78', '#7a6287'], station: 'Guest room', action: 'Manage friends and visits' },
  server: { colors: ['#6c7686', '#46586e'], station: 'Server consoles', action: 'Manage your company' },
  play: { colors: ['#b29b76', '#64847c'], station: 'Playroom', action: 'Spend time with family' },
  boardroom: { colors: ['#8f6271', '#635978'], station: 'Boardroom', action: 'Manage your company' },
  terrace: { colors: ['#879279', '#5d7966'], station: 'Terrace seating', action: 'Sit outside and unwind' },
};

export function wingRooms(ids) {
  return ids.map((id, index) => {
    const left = EDGE + Math.floor(index / 2) * WIDTH;
    const front = index % 2 === 0;
    const top = front ? 0 : -DEPTH;
    return { id, index, left, right: left + WIDTH, top, bottom: top + DEPTH, front };
  });
}

export function paintWing(rooms, { box, wall, table, mat, sprite, roomLabel }) {
  const stations = [];
  for (const room of rooms) {
    const { id, index, left, right, top, bottom, front } = room;
    const x = (left + right) / 2;
    const z = (top + bottom) / 2;
    const { colors, station, action } = ROOMS[id];
    box(x, z, WIDTH + .19, DEPTH + .13, .26, '#33273c', -.35);
    box(x, z, WIDTH, DEPTH, .07, colors[0], -.07);
    for (let i = 1; i <= 6; i++) box(x, top + i * .81, WIDTH - .04, .022, .007, '#8e7379');

    // Doorways line up so each new room is reachable from the existing home.
    wall(x, front ? bottom : top, WIDTH, .15, WALL, front ? .32 : .98);
    if (front && rooms[index + 1]?.left === left) {
      wall(left + 1.05, top, 2.1, .15, WALL);
      wall(right - 1.05, top, 2.1, .15, WALL);
    } else if (front) wall(x, top, WIDTH, .15, WALL);
    if (rooms[index + 2]) {
      const door = front ? 3.7 : -3.1;
      for (const [a, b] of [[top, door - 1.10], [door + 1.10, bottom]]) {
        wall(right, (a + b) / 2, .14, b - a, WALL, .5);
      }
    } else wall(right, z, .14, DEPTH, WALL, .55);

    if (!front && index === 1) wall(left, z, .14, DEPTH, WALL, .55);
    mat(x, z + .35, 4.55, 3.76, colors[1], '#d6b59d');
    const alongWall = front ? top + .96 : top + 1.08;
    if (id === 'reading') {
      box(left + 1, alongWall, 1.12, .75, 1.16, '#65495b', .02, true);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) box(left + .68 + col * .22, alongWall + .39, .15, .35, .25,
          ['#d9a678', '#7994ab', '#b27481', '#9aad8c'][col], .23 + row * .44);
      }
      box(x + .78, z - .19, 1.73, 1.24, .57, '#627989', .045, true);
      box(x + .78, z - .63, 1.77, .35, .82, '#4f6377', .09);
      sprite('plant', right - .83, alongWall, .02, 1.04);
    }
    if (id === 'nursery' || id === 'guest') {
      const bed = left + 1.12;
      box(bed, alongWall + .52, 1.64, 2.3, .28, '#795567', .04, true);
      box(bed, alongWall + .5, 1.56, 2.21, .19, '#ead5bf', .32);
      box(bed, alongWall + .9, 1.58, 1.42, .11, id === 'nursery' ? '#839db3' : '#9b7495', .49);
      box(bed, alongWall - .14, 1.21, .46, .17, '#f3dfc3', .51);
      box(right - 1.34, alongWall + .24, 1.32, 1.1, .40, '#956864', .065, true);
      if (id === 'nursery') for (const dx of [-.57, .57]) box(right - 1.34 + dx, alongWall + .24, .1, 1.08, .54, '#c39383', .41);
      else sprite('plant', right - .9, z - .9, .02, .95);
    }
    if (id === 'dining' || id === 'boardroom') {
      table(x, z - .26, 2.54, 1.5, .79);
      for (const dx of [-.78, .78]) {
        sprite('officechair', x + dx, z + .69, .04, .8);
        sprite('officechair', x + dx, z - 1.2, .04, .8);
      }
      sprite(id === 'boardroom' ? 'laptop' : 'coffee', x, z - .27, .79, .42);
    }
    if (id === 'server') {
      for (const dx of [-1.6, -.47, .67]) {
        box(x + dx, alongWall, .86, .72, 1.64, '#404758', .04, true);
        for (const y of [.41, .67, .98, 1.22]) box(x + dx - .24, alongWall + .377, .18, .025, .064, '#92c6bd', y, false, true);
      }
      sprite('monitor', x + 1.56, z - .66, .58, 1.01);
    }
    if (id === 'play' || id === 'terrace') {
      for (const [dx, dz, size] of [[-2.1, -1.37, 1.0], [1.85, -1.52, 1.25], [1.78, 1.28, .7]]) {
        sprite(id === 'terrace' ? 'plant' : 'gamepad', x + dx, z + dz, .04, size);
      }
      if (id === 'terrace') table(x, z - .23, 1.54, 1.23, .67);
      else box(x - 1.16, z - .64, 1.38, .88, .35, '#b08372', .045, true);
    }
    roomLabel(ROOM_NAMES[id].toUpperCase(), x, front ? bottom - .39 : top + 2.15);
    stations.push({ id: `wing-${id}`, name: station, action, x: x - .2, z: z + (front ? 1.1 : 1.4) });
  }
  return stations;
}
