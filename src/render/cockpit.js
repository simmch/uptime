// The windshield frame and dashboard stay fixed to the driver's viewpoint.
export class Cockpit {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(speed, turn, parked) {
    const { canvas, ctx } = this;
    const width = Math.min(canvas.clientWidth, 1500);
    const height = Math.min(canvas.clientHeight, 900);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const aspect = width / height;
    ctx.setTransform(width / 1000, 0, 0, height / 560, 0, 0);
    ctx.clearRect(0, 0, 1000, 560);

    function shape(fill, ...points) {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    function gradient(top, bottom, ...colors) {
      const fill = ctx.createLinearGradient(0, top, 0, bottom);
      colors.forEach((color, i) => fill.addColorStop(i / (colors.length - 1), color));
      return fill;
    }

    const glass = ctx.createLinearGradient(0, 26, 0, 410);
    glass.addColorStop(0, '#222d5545');
    glass.addColorStop(0.68, '#a284a405');
    glass.addColorStop(1, '#edaa7738');
    shape(glass, [44, 35], [965, 35], [1000, 427], [0, 427]);
    shape('#f4c0a70a', [90, 43], [312, 43], [193, 366], [147, 366]);
    shape('#e4a2a909', [624, 37], [729, 37], [656, 341], [621, 341]);

    // Headliner, windshield pillars, and their lit trim.
    shape('#16141e', [0, 0], [1000, 0], [1000, 47], [811, 34], [480, 27], [181, 34], [0, 51]);
    shape('#382d39', [0, 46], [178, 31], [482, 24], [815, 31], [1000, 44],
      [1000, 48], [815, 35], [482, 28], [178, 35], [0, 51]);
    shape('#1d1a25', [29, 37], [57, 38], [36, 181], [16, 320], [32, 409], [0, 448], [0, 87]);
    shape('#51404a', [54, 39], [60, 39], [39, 184], [21, 319], [34, 398], [29, 399], [16, 320]);
    shape('#1d1a25', [941, 37], [964, 39], [1000, 141], [1000, 441], [971, 403], [984, 327]);
    shape('#51404a', [941, 38], [947, 38], [989, 327], [977, 406], [972, 404], [984, 327]);

    // Rear-view mirror, hood and wipers.
    shape('#24212d', [494, 27], [507, 27], [512, 43], [489, 43]);
    shape('#1a1924', [432, 44], [561, 44], [572, 51], [568, 79], [558, 85], [435, 83], [424, 75], [424, 53]);
    shape(gradient(49, 79, '#383c53', '#9a717c', '#424052'), [435, 49], [558, 49], [564, 55], [562, 74],
      [554, 79], [437, 77], [431, 72], [431, 54]);
    shape('#212334', [433, 68], [463, 63], [485, 73], [515, 71], [549, 61], [563, 64], [562, 74],
      [554, 79], [437, 77], [431, 72]);
    shape('#ffb79542', [488, 73], [508, 73], [527, 78], [466, 78]);
    shape('#5d5161', [34, 404], [129, 379], [365, 365], [666, 365], [875, 378], [963, 408], [997, 428], [0, 428]);
    shape('#8d6b74', [133, 379], [370, 365], [672, 365], [873, 378], [671, 368], [367, 368]);
    shape('#292530', [108, 391], [381, 364], [435, 363], [437, 365], [386, 369], [114, 395]);
    shape('#292530', [528, 390], [744, 371], [799, 369], [802, 371], [746, 376], [535, 394]);

    // Dashboard cap and lower passenger-side console.
    shape(gradient(384, 560, '#3b323e', '#211e2a', '#11121b'), [0, 418], [89, 397], [245, 384],
      [486, 387], [769, 382], [908, 391], [1000, 424], [1000, 560], [0, 560]);
    shape('#62515c', [0, 418], [88, 395], [236, 382], [486, 385], [771, 380], [909, 389],
      [1000, 423], [1000, 426], [909, 393], [765, 384], [486, 389], [238, 388], [89, 400], [0, 422]);
    shape('#13131d', [0, 450], [181, 411], [445, 420], [576, 440], [846, 424], [1000, 447],
      [1000, 461], [845, 439], [571, 452], [440, 434], [177, 424], [0, 469]);
    shape('#23212c', [650, 464], [859, 452], [1000, 472], [1000, 533], [868, 511], [688, 519]);
    shape('#4b3e49', [651, 463], [860, 450], [1000, 472], [1000, 475], [857, 454], [653, 466]);

    if (aspect > 1) {
      shape('#151620', [571, 420], [694, 418], [718, 430], [594, 434]);
      for (let i = 0; i < 4; i++) {
        const y = 423 + i * 2.4;
        shape('#61515b', [580 + i * 4, y], [702 + i * 3.8, y - 2.4], [705 + i * 3.8, y - 1.5], [583 + i * 4, y + 1]);
      }
      shape('#11131c', [531, 451], [650, 447], [664, 475], [539, 477]);
      shape('#353c3e', [540, 456], [616, 454], [624, 470], [545, 472]);
      ctx.fillStyle = '#a5ad80';
      ctx.font = '13px monospace';
      ctx.fillText('FM  92.0', 547, 468);
      shape('#584853', [639, 455], [648, 455], [654, 468], [645, 469]);
    }

    // Keep the instrument cluster and wheel in proportion on wide and tall screens.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = height / 560;
    ctx.translate(width * (aspect < 1 ? 0.34 : 0.30), height * 0.84);
    ctx.scale(scale, scale);
    shape('#15151e', [-124, -16], [-113, -48], [-82, -67], [81, -67], [112, -48], [123, -11], [100, 4], [-104, 4]);
    shape('#66525d', [-123, -17], [-112, -49], [-82, -69], [82, -69], [113, -49], [124, -14], [117, -14],
      [108, -45], [80, -64], [-80, -64], [-107, -45], [-116, -17]);
    ctx.fillStyle = '#322939';
    ctx.fillRect(-72, -55, 144, 32);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffca8c';
    ctx.font = '24px monospace';
    ctx.fillText(String(Math.round(speed)).padStart(2, '0'), -12, -31);
    ctx.fillStyle = '#cb9c79';
    ctx.font = '10px monospace';
    ctx.fillText('MPH', 21, -33);
    ctx.fillStyle = parked ? '#ffbf89' : '#bfc394';
    ctx.fillText(parked ? 'P' : 'D', 49, -33);
    ctx.textAlign = 'start';

    ctx.translate(0, 48);
    ctx.rotate(turn);
    ctx.beginPath();
    ctx.ellipse(0, 0, 115, 72, 0, 0, Math.PI * 2);
    ctx.lineWidth = 19;
    ctx.strokeStyle = '#11111b';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -3, 115, 72, 0, Math.PI, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#514451';
    ctx.stroke();
    shape('#211d28', [-108, -4], [-56, 6], [-30, 4], [30, 4], [56, 6], [108, -4], [106, 15], [48, 29],
      [21, 41], [15, 70], [-15, 70], [-21, 41], [-48, 29], [-106, 15]);
    shape('#4b3d49', [-44, 10], [44, 10], [51, 21], [32, 39], [-32, 39], [-51, 21]);
    shape('#292632', [-39, 12], [39, 12], [45, 21], [31, 35], [-31, 35], [-45, 21]);
  }
}
