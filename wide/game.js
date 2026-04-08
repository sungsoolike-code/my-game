// ============================================================
//  Wave Survival – Wide Mode (넓은 화면)
// ============================================================

const VIEW_W = 1024;
const VIEW_H = 768;
const WORLD_W = 2048;             // 뷰포트의 2배
const WORLD_H = 1536;

// ---------- 설정 상수 ----------
const PLAYER_SPEED = 200;
const PLAYER_MAX_HP = 100;
const BULLET_SPEED = 500;
const FIRE_RATE = 300;
const WAVE_DURATION = 30;

const ENEMY_TYPES = {
  fast:      { hp: 20, speed: 120, size: 12, color: 0xff4444, xp: 10, damage: 8,  shape: 'circle', drop: null },
  tank:      { hp: 60, speed: 70,  size: 18, color: 0xff8800, xp: 25, damage: 20, shape: 'rect',   drop: null },
  goldCircle:{ hp: 20, speed: 120, size: 12, color: 0xffdd00, xp: 10, damage: 8,  shape: 'circle', drop: 'speed' },
  goldRect:  { hp: 60, speed: 70,  size: 18, color: 0xffdd00, xp: 25, damage: 20, shape: 'rect',   drop: 'fireRate' },
};

// ---------- 난이도 프리셋 ----------
const DIFFICULTY = {
  easy: {
    label: '쉬움',
    color: 0x44cc44,
    desc: '체력 많고 적 느림 — 입문용',
    playerHp: 200, playerSpeed: 220, fireRate: 250, bulletDamage: 30,
    enemyHpMul: 0.6, enemySpeedMul: 0.7, spawnCountMul: 0.6, spawnDelay: 1600,
    waveHpBonus: 2, waveSpeedBonus: 4,
  },
  normal: {
    label: '보통',
    color: 0xddaa22,
    desc: '균형 잡힌 기본 난이도',
    playerHp: 100, playerSpeed: 200, fireRate: 300, bulletDamage: 20,
    enemyHpMul: 1.0, enemySpeedMul: 1.0, spawnCountMul: 1.0, spawnDelay: 1200,
    waveHpBonus: 5, waveSpeedBonus: 8,
  },
  hard: {
    label: '어려움',
    color: 0xdd4444,
    desc: '적이 빠르고 많음 — 숙련자용',
    playerHp: 80, playerSpeed: 190, fireRate: 350, bulletDamage: 15,
    enemyHpMul: 1.4, enemySpeedMul: 1.3, spawnCountMul: 1.5, spawnDelay: 900,
    waveHpBonus: 8, waveSpeedBonus: 12,
  },
};

// ---------- 음악 트랙 목록 ----------
const MUSIC_TRACKS = [
  'music/Crossing_the_Great_Pass.mp3',
  'music/Last_Token_In.mp3',
  'music/far from earth.mp3',
  'music/fire for heart (1).mp3',
  'music/fire for heart.mp3',
  'music/nice day rest (1).mp3',
  'music/nice day rest (2).mp3',
  'music/nice day rest (3).mp3',
  'music/nice day rest (4).mp3',
  'music/nice day rest (5).mp3',
  'music/nice day rest.mp3',
  'music/peace day (1).mp3',
  'music/peace day.mp3',
  'music/peace in space (1).mp3',
  'music/peace in space (2).mp3',
  'music/peace in space.mp3',
  'music/play with friends (1).mp3',
  'music/play with friends.mp3',
  'music/running on desert (1).mp3',
  'music/running on desert.mp3',
  'music/space journey (1).mp3',
  'music/space journey (2).mp3',
  'music/space journey.mp3',
  'music/storm in the galaxy.mp3',
  'music/storm of the moon.mp3',
];

// ---------- 글로벌 설정 (씬 간 공유) ----------
const SETTINGS = {
  soundOn: true,
  musicOn: true,
};

// ============================================================
//  SFX — Web Audio API 기반 효과음 생성
// ============================================================
const SFX = {
  _ctx: null,
  _getCtx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  },

  // 적 사망: 짧고 부드러운 "퍅"
  enemyDeath() {
    if (!SETTINGS.soundOn) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },

  // 폭탄 폭발: 묵직한 "쾅"
  bombExplode() {
    if (!SETTINGS.soundOn) return;
    const ctx = this._getCtx();
    // 노이즈 버스트
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);
    // 저음 베이스
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);
    oscGain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },

  // 플레이어 피격
  playerHit() {
    if (!SETTINGS.soundOn) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  },
};

// ============================================================
//  MusicManager — 음악 로테이션 관리
// ============================================================
const MusicManager = {
  _scene: null,
  _tracks: [],
  _currentIndex: -1,
  _currentSound: null,
  _shuffled: [],
  _loaded: false,

  init(scene) {
    this._scene = scene;
    if (this._loaded) return;
    this._loaded = true;
    this._shuffled = [...MUSIC_TRACKS].sort(() => Math.random() - 0.5);
  },

  play() {
    if (!SETTINGS.musicOn || !this._scene) return;
    if (this._currentSound && this._currentSound.isPlaying) return;
    this._playNext();
  },

  _playNext() {
    if (!SETTINGS.musicOn) return;
    this._currentIndex = (this._currentIndex + 1) % this._shuffled.length;
    const key = 'music_' + this._currentIndex;
    const scene = this._scene;

    if (!scene.cache.audio.exists(key)) {
      scene.load.audio(key, this._shuffled[this._currentIndex]);
      scene.load.once('complete', () => {
        this._startTrack(scene, key);
      });
      scene.load.start();
    } else {
      this._startTrack(scene, key);
    }
  },

  _startTrack(scene, key) {
    if (this._currentSound) {
      this._currentSound.stop();
      this._currentSound.destroy();
    }
    this._currentSound = scene.sound.add(key, { volume: 0.3 });
    this._currentSound.once('complete', () => {
      this._playNext();
    });
    if (SETTINGS.musicOn) {
      this._currentSound.play();
    }
  },

  stop() {
    if (this._currentSound && this._currentSound.isPlaying) {
      this._currentSound.stop();
    }
  },

  toggle(on) {
    SETTINGS.musicOn = on;
    if (on) {
      this.play();
    } else {
      this.stop();
    }
  },

  skip() {
    if (!this._scene) return;
    if (this._currentSound) {
      this._currentSound.stop();
      this._currentSound.destroy();
      this._currentSound = null;
    }
    this._playNext();
  },

  updateScene(scene) {
    this._scene = scene;
  },
};

// ============================================================
//  설정 UI 헬퍼 (메뉴/일시정지 공용)
// ============================================================
function createSettingsPanel(scene, cx, cy, els, onBack) {
  const panelBg = scene.add.rectangle(cx, cy, 380, 300, 0x111133, 0.95)
    .setStrokeStyle(2, 0x4444aa).setScrollFactor(0).setDepth(400);
  els.push(panelBg);

  const title = scene.add.text(cx, cy - 110, 'SETTINGS', {
    fontSize: '28px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
  els.push(title);

  // Sound 토글
  const soundLabel = scene.add.text(cx - 120, cy - 50, 'SOUND', {
    fontSize: '20px', fill: '#cccccc', fontFamily: 'monospace',
  }).setScrollFactor(0).setDepth(401);
  els.push(soundLabel);

  const soundBtn = scene.add.rectangle(cx + 80, cy - 42, 100, 36, SETTINGS.soundOn ? 0x44aa44 : 0x664444)
    .setStrokeStyle(1, 0x888888).setScrollFactor(0).setDepth(401)
    .setInteractive({ useHandCursor: true });
  const soundBtnText = scene.add.text(cx + 80, cy - 42, SETTINGS.soundOn ? 'ON' : 'OFF', {
    fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(402);
  els.push(soundBtn, soundBtnText);

  soundBtn.on('pointerdown', () => {
    SETTINGS.soundOn = !SETTINGS.soundOn;
    soundBtn.setFillStyle(SETTINGS.soundOn ? 0x44aa44 : 0x664444);
    soundBtnText.setText(SETTINGS.soundOn ? 'ON' : 'OFF');
  });

  // Music 토글
  const musicLabel = scene.add.text(cx - 120, cy + 10, 'MUSIC', {
    fontSize: '20px', fill: '#cccccc', fontFamily: 'monospace',
  }).setScrollFactor(0).setDepth(401);
  els.push(musicLabel);

  const musicBtn = scene.add.rectangle(cx + 80, cy + 18, 100, 36, SETTINGS.musicOn ? 0x44aa44 : 0x664444)
    .setStrokeStyle(1, 0x888888).setScrollFactor(0).setDepth(401)
    .setInteractive({ useHandCursor: true });
  const musicBtnText = scene.add.text(cx + 80, cy + 18, SETTINGS.musicOn ? 'ON' : 'OFF', {
    fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(402);
  els.push(musicBtn, musicBtnText);

  musicBtn.on('pointerdown', () => {
    SETTINGS.musicOn = !SETTINGS.musicOn;
    musicBtn.setFillStyle(SETTINGS.musicOn ? 0x44aa44 : 0x664444);
    musicBtnText.setText(SETTINGS.musicOn ? 'ON' : 'OFF');
    MusicManager.toggle(SETTINGS.musicOn);
  });

  // 뒤로가기
  const backBg = scene.add.rectangle(cx, cy + 90, 200, 44, 0x444466)
    .setScrollFactor(0).setDepth(401).setInteractive({ useHandCursor: true });
  const backLabel = scene.add.text(cx, cy + 90, '뒤로', {
    fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(402);
  els.push(backBg, backLabel);
  backBg.on('pointerover', () => backBg.setFillStyle(0x6666aa));
  backBg.on('pointerout', () => backBg.setFillStyle(0x444466));
  backBg.on('pointerdown', onBack);
}

// ============================================================
//  MenuScene
// ============================================================
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const cx = VIEW_W / 2, cy = VIEW_H / 2;

    // 음악 시작
    MusicManager.init(this);
    MusicManager.updateScene(this);
    MusicManager.play();

    this.add.text(cx, 120, 'WAVE SURVIVAL', {
      fontSize: '52px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 175, '[ Wide Mode ]', {
      fontSize: '18px', fill: '#44aaff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 210, '난이도를 선택하세요', {
      fontSize: '20px', fill: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const keys = ['easy', 'normal', 'hard'];
    this.diffButtons = [];
    keys.forEach((key, i) => {
      const diff = DIFFICULTY[key];
      const y = 310 + i * 100;

      const bg = this.add.rectangle(cx, y, 400, 72, diff.color, 0.25)
        .setStrokeStyle(2, diff.color)
        .setInteractive({ useHandCursor: true });

      this.add.text(cx, y - 12, diff.label, {
        fontSize: '26px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(cx, y + 18, diff.desc, {
        fontSize: '14px', fill: '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5);

      bg.on('pointerover', () => bg.setFillStyle(diff.color, 0.5));
      bg.on('pointerout', () => bg.setFillStyle(diff.color, 0.25));
      bg.on('pointerdown', () => this.scene.start('GameScene', { difficulty: key }));
      this.diffButtons.push(bg);
    });

    // 설정 버튼
    const settingsBg = this.add.rectangle(cx, VIEW_H - 80, 160, 44, 0x333355)
      .setStrokeStyle(1, 0x6666aa)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, VIEW_H - 80, 'SETTINGS', {
      fontSize: '18px', fill: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    settingsBg.on('pointerover', () => settingsBg.setFillStyle(0x4444aa));
    settingsBg.on('pointerout', () => settingsBg.setFillStyle(0x333355));
    settingsBg.on('pointerdown', () => this.showSettings());

    // 1키: 메뉴에서도 음악 스킵 가능
    this.input.keyboard.on('keydown-ONE', () => MusicManager.skip());

    this.add.text(cx, VIEW_H - 40, 'WASD: 이동  R: 폭탄  F: 아머  1: 다음곡  SPACE: 일시정지', {
      fontSize: '14px', fill: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.settingsEls = [];
  }

  showSettings() {
    if (this.settingsEls.length > 0) return;
    const els = [];
    createSettingsPanel(this, VIEW_W / 2, VIEW_H / 2, els, () => {
      this.settingsEls.forEach(e => e.destroy());
      this.settingsEls = [];
    });
    this.settingsEls = els;
  }
}

// ============================================================
//  GameScene
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.diffKey = data.difficulty || 'normal';
    this.diff = DIFFICULTY[this.diffKey];
  }

  create() {
    const d = this.diff;

    // 음악 씬 업데이트
    MusicManager.updateScene(this);
    MusicManager.play();

    // --- 상태 ---
    this.hp = d.playerHp;
    this.maxHp = d.playerHp;
    this.kills = 0;
    this.wave = 1;
    this.waveTimer = WAVE_DURATION;
    this.elapsed = 0;
    this.fireRate = d.fireRate;
    this.bulletDamage = d.bulletDamage;
    this.playerSpeed = d.playerSpeed;
    this.bulletSize = 5;
    this.bulletPierce = 1;
    this.lastFired = 0;
    this.paused = false;
    this.totalBulletsFired = 0;
    this.healCollected = 0;
    this.bombCount = 0;
    this.lastHpUpgrade = 0;
    this.lastBombReward = 0;
    this.fastSpawnCount = 0;
    this.armorCount = 0;
    this.invincible = false;

    // --- 파티클 텍스처 생성 ---
    if (!this.textures.exists('particle')) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture('particle', 8, 8);
      gfx.destroy();
    }

    // --- 월드 ---
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // =====================================================
    //  우주 배경 (별 + 성운)
    // =====================================================
    const space = this.add.graphics();
    space.setDepth(-2);

    // 성운 (은은한 색 구름 3~5개)
    const nebulae = [
      { x: 400, y: 300, r: 300, color: 0x1a0a3a, alpha: 0.3 },
      { x: 1500, y: 800, r: 400, color: 0x0a1a2a, alpha: 0.25 },
      { x: 800, y: 1200, r: 350, color: 0x1a1030, alpha: 0.2 },
      { x: 1800, y: 300, r: 250, color: 0x0a0a2a, alpha: 0.2 },
      { x: 300, y: 1000, r: 280, color: 0x150a28, alpha: 0.25 },
    ];
    nebulae.forEach(n => {
      for (let i = 5; i >= 1; i--) {
        space.fillStyle(n.color, n.alpha * (i / 5));
        space.fillCircle(n.x, n.y, n.r * (i / 5));
      }
    });

    // 작은 별들 (먼 거리감 — 희미하고 작은 점)
    const starCount = 120;
    for (let i = 0; i < starCount; i++) {
      const sx = Math.random() * WORLD_W;
      const sy = Math.random() * WORLD_H;
      const brightness = 0.15 + Math.random() * 0.25;
      const size = 0.5 + Math.random() * 1.2;
      const colors = [0xffffff, 0xccccff, 0xffffcc, 0xaaccff];
      const color = colors[Math.floor(Math.random() * colors.length)];
      space.fillStyle(color, brightness);
      space.fillCircle(sx, sy, size);
    }

    // 약간 더 밝은 별 몇 개 (포인트)
    for (let i = 0; i < 15; i++) {
      const sx = Math.random() * WORLD_W;
      const sy = Math.random() * WORLD_H;
      space.fillStyle(0xffffff, 0.4 + Math.random() * 0.2);
      space.fillCircle(sx, sy, 1.5 + Math.random() * 0.8);
    }

    // =====================================================
    //  격자 + 맵 경계선
    // =====================================================
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x445588, 0.3);
    for (let gx = 0; gx <= WORLD_W; gx += 64) grid.lineBetween(gx, 0, gx, WORLD_H);
    for (let gy = 0; gy <= WORLD_H; gy += 64) grid.lineBetween(0, gy, WORLD_W, gy);
    grid.lineStyle(6, 0xff4444, 1.0);
    grid.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6);
    grid.setDepth(-1);

    const outside = this.add.graphics();
    outside.fillStyle(0x000000, 0.6);
    const pad = 800;
    outside.fillRect(-pad, -pad, WORLD_W + pad * 2, pad);
    outside.fillRect(-pad, WORLD_H, WORLD_W + pad * 2, pad);
    outside.fillRect(-pad, 0, pad, WORLD_H);
    outside.fillRect(WORLD_W, 0, pad, WORLD_H);
    outside.setDepth(0);

    // --- 플레이어 ---
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 28, 28, 0x4488ff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // --- 카메라 ---
    this.cameras.main.setBounds(-pad, -pad, WORLD_W + pad * 2, WORLD_H + pad * 2);
    this.cameras.main.startFollow(this.player, true, 0.04, 0.04);
    this.cameras.main.setDeadzone(VIEW_W * 0.55, VIEW_H * 0.55);
    this.cameras.main.setRoundPixels(true);

    // --- 그룹 ---
    this.bullets = this.physics.add.group({ runChildUpdate: true });
    this.bombs = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.powerups = this.physics.add.group();

    // --- 입력 ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // --- 충돌 ---
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.bombs, this.enemies, this.onBombHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyHitPlayer, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.onCollectPowerup, null, this);

    // --- 적 스폰 ---
    this.spawnEvent = this.time.addEvent({
      delay: d.spawnDelay,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
    });

    // --- UI ---
    this.createUI();

    // --- 일시정지 ---
    this.pauseMenuElements = [];
    this.settingsEls = [];
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.settingsEls.length > 0) return;
      if (this.paused) this.resumeGame();
      else this.showPauseMenu();
    });

    // --- 폭탄 수동 발사 (R키) ---
    this.input.keyboard.on('keydown-R', () => {
      if (this.paused) return;
      if (this.bombCount <= 0) return;
      const nearest = this.findNearestEnemy();
      if (!nearest) return;
      this.bombCount--;
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);
      this.fireTriangleBomb(angle, 'manual');
    });

    // --- 1키: 다음 음악 스킵 ---
    this.input.keyboard.on('keydown-ONE', () => {
      MusicManager.skip();
    });

    // --- F키: 아머 활성화 (2초 무적) ---
    this.input.keyboard.on('keydown-F', () => {
      if (this.paused || this.invincible) return;
      if (this.armorCount <= 0) return;
      this.armorCount--;
      this.activateArmor();
    });

    // --- 웨이브 타이머 ---
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.paused) return;
        this.elapsed++;
        this.waveTimer--;
        if (this.waveTimer <= 0) {
          this.wave++;
          this.waveTimer = WAVE_DURATION;
          this.adjustDifficulty();
        }
      },
      loop: true,
    });
  }

  // ---------- UI ----------
  createUI() {
    const barW = 200, barH = 18;
    this.hpBarBg = this.add.rectangle(120, 24, barW, barH, 0x333333).setScrollFactor(0).setDepth(100);
    this.hpBar = this.add.rectangle(120, 24, barW, barH, 0x44dd44).setScrollFactor(0).setDepth(101);

    const style = { fontSize: '16px', fill: '#fff', fontFamily: 'monospace' };
    this.waveText = this.add.text(VIEW_W - 10, 10, '', style).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.timerText = this.add.text(VIEW_W - 10, 30, '', style).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.killText = this.add.text(VIEW_W - 10, 50, '', style).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.buffText = this.add.text(20, 48, '', { fontSize: '13px', fill: '#ffdd00', fontFamily: 'monospace' }).setScrollFactor(0).setDepth(100);
    this.bombText = this.add.text(VIEW_W - 10, 70, '', { fontSize: '16px', fill: '#ff8844', fontFamily: 'monospace' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.armorText = this.add.text(VIEW_W - 10, 90, '', { fontSize: '16px', fill: '#44aaff', fontFamily: 'monospace' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.healCountText = this.add.text(VIEW_W - 10, 110, '', { fontSize: '13px', fill: '#88aa88', fontFamily: 'monospace' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    const dc = this.diff.color;
    const dHex = '#' + dc.toString(16).padStart(6, '0');
    this.add.text(VIEW_W / 2, 10, `${this.diff.label}  [Wide]`, {
      fontSize: '14px', fill: dHex, fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
  }

  updateUI() {
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.width = 200 * hpRatio;
    this.hpBar.x = 20 + this.hpBar.width / 2;
    this.hpBar.fillColor = hpRatio > 0.5 ? 0x44dd44 : hpRatio > 0.25 ? 0xdddd44 : 0xdd4444;
    this.hpBarBg.x = 120;

    const mm = String(Math.floor(this.elapsed / 60)).padStart(2, '0');
    const ss = String(this.elapsed % 60).padStart(2, '0');
    this.waveText.setText(`WAVE ${this.wave}`);
    this.timerText.setText(`${mm}:${ss}  (다음 ${this.waveTimer}s)`);
    this.killText.setText(`KILLS ${this.kills}`);

    const spdBoost = Math.round((this.playerSpeed / this.diff.playerSpeed - 1) * 100);
    const frBoost = Math.round((1 - this.fireRate / this.diff.fireRate) * 100);
    let buffStr = '';
    if (spdBoost > 0) buffStr += `SPD+${spdBoost}%  `;
    if (frBoost > 0) buffStr += `ATK.SPD+${frBoost}%`;
    this.buffText.setText(buffStr);
    this.bombText.setText(`BOMBS: ${this.bombCount} (R)`);
    this.armorText.setText(`ARMOR: ${this.armorCount} (F)${this.invincible ? '  ★ACTIVE★' : ''}`);
    this.healCountText.setText(`HEAL: ${this.healCollected % 100}/100`);
  }

  // ---------- 업데이트 ----------
  update(time) {
    if (this.paused) return;
    this.movePlayer();
    this.autoFire(time);
    this.chasePlayer();
    this.attractPowerups();
    this.updateUI();
  }

  movePlayer() {
    const body = this.player.body;
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    body.setVelocity((vx / len) * this.playerSpeed, (vy / len) * this.playerSpeed);
  }

  autoFire(time) {
    if (time < this.lastFired + this.fireRate) return;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    this.lastFired = time;
    this.totalBulletsFired++;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);

    if (this.totalBulletsFired % 100 === 0) {
      this.fireTriangleBomb(angle, 'auto');
      this.showBuffText('AUTO BOMB!');
    } else {
      const b = this.add.rectangle(this.player.x, this.player.y, 14, 5, 0xffff00);
      b.setRotation(angle);
      this.physics.add.existing(b);
      b.body.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
      b.setData('damage', this.bulletDamage);
      b.setData('pierce', this.bulletPierce);
      this.bullets.add(b);
      this.time.delayedCall(3000, () => { if (b.active) b.destroy(); });
    }
  }

  findNearestEnemy() {
    let nearest = null, dist = Infinity;
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < dist) { dist = d; nearest = e; }
    });
    return nearest;
  }

  chasePlayer() {
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
      const spd = e.getData('speed');
      e.body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
    });
  }

  attractPowerups() {
    this.powerups.getChildren().forEach(p => {
      if (!p.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (d < 80) {
        const angle = Phaser.Math.Angle.Between(p.x, p.y, this.player.x, this.player.y);
        p.body.setVelocity(Math.cos(angle) * 250, Math.sin(angle) * 250);
      }
    });
  }

  // ---------- 적 스폰 ----------
  spawnEnemy() {
    if (this.paused) return;
    const count = Math.min(Math.floor((2 + this.wave) * this.diff.spawnCountMul), 12);
    for (let i = 0; i < count; i++) {
      const goldChance = Math.min(0.05 + (this.wave - 1) * 0.02, 0.30);
      let type;
      const r = Math.random();
      if (r < 0.6) {
        type = Math.random() < goldChance ? 'goldCircle' : 'fast';
      } else {
        type = Math.random() < goldChance ? 'goldRect' : 'tank';
      }
      let isSuicider = false;
      if (type === 'fast') {
        this.fastSpawnCount++;
        if (this.fastSpawnCount % 100 === 0) isSuicider = true;
      }
      const cfg = ENEMY_TYPES[type];

      const cam = this.cameras.main;
      const cl = cam.scrollX, ct = cam.scrollY;
      const cr = cl + VIEW_W, cb = ct + VIEW_H;
      let x, y;
      const side = Phaser.Math.Between(0, 3);
      const margin = 80;
      switch (side) {
        case 0: x = Phaser.Math.Between(cl - margin, cr + margin); y = ct - margin; break;
        case 1: x = Phaser.Math.Between(cl - margin, cr + margin); y = cb + margin; break;
        case 2: x = cl - margin; y = Phaser.Math.Between(ct - margin, cb + margin); break;
        case 3: x = cr + margin; y = Phaser.Math.Between(ct - margin, cb + margin); break;
      }
      x = Phaser.Math.Clamp(x, 0, WORLD_W);
      y = Phaser.Math.Clamp(y, 0, WORLD_H);

      let enemy;
      if (isSuicider) {
        enemy = this.add.circle(x, y, cfg.size + 4, 0xff8888);
        enemy.setAlpha(0.7);
      } else if (cfg.shape === 'circle') {
        enemy = this.add.circle(x, y, cfg.size, cfg.color);
      } else {
        enemy = this.add.rectangle(x, y, cfg.size * 2, cfg.size * 2, cfg.color);
      }
      this.physics.add.existing(enemy);
      const baseHp = cfg.shape === 'rect'
        ? Math.floor(this.bulletDamage * 1.8)
        : Math.floor(cfg.hp * this.diff.enemyHpMul);
      enemy.setData('hp', baseHp + (this.wave - 1) * this.diff.waveHpBonus);
      enemy.setData('speed', Math.floor(cfg.speed * this.diff.enemySpeedMul) + (this.wave - 1) * this.diff.waveSpeedBonus);
      enemy.setData('xp', cfg.xp);
      enemy.setData('damage', cfg.damage);
      enemy.setData('type', type);
      enemy.setData('drop', cfg.drop);
      enemy.setData('suicider', isSuicider);
      this.enemies.add(enemy);

      if (isSuicider) {
        this.tweens.add({ targets: enemy, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
        this.time.delayedCall(10000, () => {
          if (enemy.active) this.suiciderExplode(enemy);
        });
      }
    }
  }

  adjustDifficulty() {
    const newDelay = Math.max(400, this.diff.spawnDelay - (this.wave - 1) * 100);
    this.spawnEvent.delay = newDelay;

    const txt = this.add.text(VIEW_W / 2, VIEW_H / 2 - 60, `⚠ WAVE ${this.wave} ⚠`, {
      fontSize: '36px', fill: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 40, duration: 1500, onComplete: () => txt.destroy() });
  }

  // ---------- 자폭형 폭발 ----------
  suiciderExplode(enemy) {
    const gridX = Math.floor(enemy.x / 64);
    const gridY = Math.floor(enemy.y / 64);
    const cells = [
      { gx: gridX,     gy: gridY },
      { gx: gridX + 1, gy: gridY },
      { gx: gridX,     gy: gridY + 1 },
      { gx: gridX + 1, gy: gridY + 1 },
    ];

    SFX.bombExplode();

    const fx = this.add.graphics();
    fx.setDepth(50);
    cells.forEach(c => {
      fx.fillStyle(0xff2222, 0.4);
      fx.fillRect(c.gx * 64, c.gy * 64, 64, 64);
      fx.lineStyle(2, 0xff4444, 0.8);
      fx.strokeRect(c.gx * 64, c.gy * 64, 64, 64);
    });
    this.tweens.add({ targets: fx, alpha: 0, duration: 600, onComplete: () => fx.destroy() });

    const toKill = [];
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const eGridX = Math.floor(e.x / 64);
      const eGridY = Math.floor(e.y / 64);
      for (const c of cells) {
        if (eGridX === c.gx && eGridY === c.gy) { toKill.push(e); break; }
      }
    });

    toKill.forEach(e => {
      this.spawnDeathParticles(e.x, e.y, e.fillColor);
      this.addKill();
      e.destroy();
    });
  }

  addKill() {
    this.kills++;
    // kills 100마다 최대 체력 +10%
    const hpMilestone = Math.floor(this.kills / 100);
    if (hpMilestone > this.lastHpUpgrade) {
      this.lastHpUpgrade = hpMilestone;
      const bonus = Math.floor(this.maxHp * 0.1);
      this.maxHp += bonus;
      this.hp = Math.min(this.hp + bonus, this.maxHp);
      this.showBuffText(`MAX HP +10%  (${this.maxHp})`);
    }
    // kills 50마다 폭탄 +1
    const bombMilestone = Math.floor(this.kills / 50);
    if (bombMilestone > this.lastBombReward) {
      this.lastBombReward = bombMilestone;
      this.bombCount++;
      this.showBuffText('BOMB +1!');
    }
  }

  // ---------- 충돌 ----------
  onBulletHitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    let hp = enemy.getData('hp') - bullet.getData('damage');
    enemy.setData('hp', hp);

    let pierce = bullet.getData('pierce') - 1;
    if (pierce <= 0) bullet.destroy();
    else bullet.setData('pierce', pierce);

    this.tweens.add({ targets: enemy, alpha: 0.3, yoyo: true, duration: 60 });

    if (hp <= 0) {
      if (enemy.getData('suicider')) {
        this.suiciderExplode(enemy);
        return;
      }

      SFX.enemyDeath();
      this.spawnDeathParticles(enemy.x, enemy.y, enemy.fillColor);
      this.addKill();
      if (Math.random() < 0.4) {
        const healOrb = this.add.circle(enemy.x, enemy.y, 5, 0x00ff88);
        this.physics.add.existing(healOrb);
        healOrb.setData('type', 'heal');
        this.powerups.add(healOrb);
      }

      const dropType = enemy.getData('drop');
      if (dropType) {
        let powerup;
        if (dropType === 'speed') {
          powerup = this.add.circle(enemy.x, enemy.y, 7, 0xffff44);
        } else {
          powerup = this.add.rectangle(enemy.x, enemy.y, 14, 14, 0xffff44);
        }
        this.physics.add.existing(powerup);
        powerup.setData('type', dropType);
        this.powerups.add(powerup);
        this.tweens.add({ targets: powerup, alpha: 0.4, yoyo: true, repeat: -1, duration: 300 });
        this.time.delayedCall(15000, () => { if (powerup.active) powerup.destroy(); });
      }
      enemy.destroy();
    }
  }

  onEnemyHitPlayer(player, enemy) {
    if (!enemy.active) return;
    if (this.invincible) {
      // 무적 상태: 적을 파괴하고 킬 카운트
      SFX.enemyDeath();
      this.spawnDeathParticles(enemy.x, enemy.y, enemy.fillColor);
      this.addKill();
      enemy.destroy();
      return;
    }
    this.hp -= enemy.getData('damage');
    enemy.destroy();
    SFX.playerHit();
    this.cameras.main.shake(100, 0.008);
    this.tweens.add({ targets: player, alpha: 0.3, yoyo: true, duration: 80 });
    if (this.hp <= 0) { this.hp = 0; this.gameOver(); }
  }

  onCollectPowerup(player, powerup) {
    if (!powerup.active) return;
    const type = powerup.getData('type');
    if (type === 'heal') {
      this.hp = Math.min(this.hp + 5, this.maxHp);
      this.healCollected++;
      if (this.healCollected % 100 === 0) {
        this.armorCount++;
        this.showBuffText('ARMOR +1!');
      }
    } else if (type === 'speed') {
      const maxSpeed = this.diff.playerSpeed * 1.28;
      if (this.playerSpeed < maxSpeed) {
        this.playerSpeed = Math.min(this.playerSpeed * 1.05, maxSpeed);
        this.showBuffText('SPD +5%');
      }
    } else if (type === 'fireRate') {
      this.fireRate *= 0.95;
      this.showBuffText('ATK.SPD +5%');
    }
    powerup.destroy();
  }

  // ---------- 폭탄 ----------
  fireTriangleBomb(angle, bombType) {
    const isManual = bombType === 'manual';
    const color = isManual ? 0xff4400 : 0xff6600;
    const size = isManual ? 22 : 18;
    const bomb = this.add.triangle(this.player.x, this.player.y, 0, size, size / 2, 0, size, size, color);
    bomb.setDepth(10);
    this.physics.add.existing(bomb);
    bomb.body.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
    bomb.setData('detonated', false);
    bomb.setData('bombType', bombType);
    bomb.setData('planted', false);
    this.bombs.add(bomb);

    this.tweens.add({ targets: bomb, angle: 360, duration: 600, repeat: -1 });

    if (isManual) {
      this.time.delayedCall(3000, () => {
        if (!bomb.active || bomb.getData('detonated')) return;
        if (!bomb.getData('planted')) this.plantBomb(bomb);
      });
    } else {
      this.time.delayedCall(3000, () => {
        if (bomb.active && !bomb.getData('detonated')) this.detonateBomb(bomb);
      });
    }
  }

  plantBomb(bomb) {
    if (bomb.getData('planted') || bomb.getData('detonated')) return;
    bomb.setData('planted', true);
    bomb.body.setVelocity(0, 0);
    this.tweens.killTweensOf(bomb);
    this.tweens.add({ targets: bomb, scaleX: 1.3, scaleY: 1.3, yoyo: true, repeat: -1, duration: 300 });
    this.time.delayedCall(3000, () => {
      if (bomb.active && !bomb.getData('detonated')) this.detonateBomb(bomb);
    });
  }

  onBombHitEnemy(bomb, enemy) {
    if (!bomb.active || bomb.getData('detonated')) return;
    const isManual = bomb.getData('bombType') === 'manual';
    if (isManual) {
      if (!bomb.getData('planted')) this.plantBomb(bomb);
    } else {
      this.detonateBomb(bomb);
    }
  }

  detonateBomb(bomb) {
    if (bomb.getData('detonated')) return;
    bomb.setData('detonated', true);

    const bx = bomb.x, by = bomb.y;
    const gridX = Math.floor(bx / 64);
    const gridY = Math.floor(by / 64);
    const isManual = bomb.getData('bombType') === 'manual';

    const cells = [];
    if (isManual) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          cells.push({ gx: gridX + dx, gy: gridY + dy });
        }
      }
    } else {
      cells.push({ gx: gridX,     gy: gridY });
      cells.push({ gx: gridX + 1, gy: gridY });
      cells.push({ gx: gridX,     gy: gridY + 1 });
      cells.push({ gx: gridX + 1, gy: gridY + 1 });
    }

    SFX.bombExplode();

    const fx = this.add.graphics();
    fx.setDepth(50);
    cells.forEach(c => {
      fx.fillStyle(0xff6600, 0.35);
      fx.fillRect(c.gx * 64, c.gy * 64, 64, 64);
      fx.lineStyle(2, 0xff8800, 0.8);
      fx.strokeRect(c.gx * 64, c.gy * 64, 64, 64);
    });
    this.tweens.add({ targets: fx, alpha: 0, duration: 500, onComplete: () => fx.destroy() });

    bomb.destroy();

    this.time.addEvent({
      delay: 50,
      repeat: 9,
      callback: () => { this.killEnemiesInCells(cells); },
    });
  }

  killEnemiesInCells(cells) {
    const toKill = [];
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const eGridX = Math.floor(e.x / 64);
      const eGridY = Math.floor(e.y / 64);
      for (const c of cells) {
        if (eGridX === c.gx && eGridY === c.gy) { toKill.push(e); break; }
      }
    });

    toKill.forEach(e => {
      SFX.enemyDeath();
      this.spawnDeathParticles(e.x, e.y, e.fillColor);
      this.addKill();
      if (Math.random() < 0.4) {
        const healOrb = this.add.circle(e.x, e.y, 5, 0x00ff88);
        this.physics.add.existing(healOrb);
        healOrb.setData('type', 'heal');
        this.powerups.add(healOrb);
      }
      const dropType = e.getData('drop');
      if (dropType) {
        let powerup;
        if (dropType === 'speed') {
          powerup = this.add.circle(e.x, e.y, 7, 0xffff44);
        } else {
          powerup = this.add.rectangle(e.x, e.y, 14, 14, 0xffff44);
        }
        this.physics.add.existing(powerup);
        powerup.setData('type', dropType);
        this.powerups.add(powerup);
        this.tweens.add({ targets: powerup, alpha: 0.4, yoyo: true, repeat: -1, duration: 300 });
        this.time.delayedCall(15000, () => { if (powerup.active) powerup.destroy(); });
      }
      e.destroy();
    });
  }

  spawnDeathParticles(x, y, color) {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 180 },
      scale: { start: 0.7, end: 0 },
      lifespan: 350,
      quantity: 10,
      tint: color,
      emitting: false,
    });
    emitter.explode(10);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  activateArmor() {
    this.invincible = true;
    // 플레이어 시각 효과: 파란 쉴드 느낌
    this.player.setFillStyle(0x44ffff);
    this.player.setAlpha(0.8);
    this.showBuffText('ARMOR ACTIVE! (2s)');

    // 깜빡임으로 종료 임박 표시 (1.5초 후)
    this.time.delayedCall(1500, () => {
      if (!this.invincible) return;
      this.tweens.add({
        targets: this.player, alpha: 0.3, yoyo: true, repeat: 3, duration: 60,
        onComplete: () => { if (this.player.active) this.player.setAlpha(1); }
      });
    });

    // 2초 후 무적 해제
    this.time.delayedCall(2000, () => {
      this.invincible = false;
      this.player.setFillStyle(0x4488ff);
      this.player.setAlpha(1);
    });
  }

  showBuffText(msg) {
    const txt = this.add.text(VIEW_W / 2, VIEW_H / 2 - 30, msg, {
      fontSize: '24px', fill: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 30, duration: 1000, onComplete: () => txt.destroy() });
  }

  // ---------- 일시정지 ----------
  showPauseMenu() {
    this.paused = true;
    this.physics.pause();
    const els = [];

    const overlay = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(300);
    els.push(overlay);

    const title = this.add.text(VIEW_W / 2, VIEW_H / 2 - 120, 'PAUSED', {
      fontSize: '40px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    els.push(title);

    const hint = this.add.text(VIEW_W / 2, VIEW_H / 2 - 75, 'SPACE 를 눌러 계속', {
      fontSize: '14px', fill: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    els.push(hint);

    // 계속하기
    const resumeBg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2 - 20, 260, 50, 0x446644)
      .setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });
    const resumeLabel = this.add.text(VIEW_W / 2, VIEW_H / 2 - 20, '다시 시작', {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302);
    els.push(resumeBg, resumeLabel);
    resumeBg.on('pointerover', () => resumeBg.setFillStyle(0x66aa66));
    resumeBg.on('pointerout', () => resumeBg.setFillStyle(0x446644));
    resumeBg.on('pointerdown', () => this.resumeGame());

    // 설정
    const settingsBg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2 + 45, 260, 50, 0x335555)
      .setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });
    const settingsLabel = this.add.text(VIEW_W / 2, VIEW_H / 2 + 45, '설정', {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302);
    els.push(settingsBg, settingsLabel);
    settingsBg.on('pointerover', () => settingsBg.setFillStyle(0x55aaaa));
    settingsBg.on('pointerout', () => settingsBg.setFillStyle(0x335555));
    settingsBg.on('pointerdown', () => this.showSettingsFromPause());

    // 메뉴로
    const menuBg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2 + 110, 260, 50, 0x444466)
      .setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });
    const menuLabel = this.add.text(VIEW_W / 2, VIEW_H / 2 + 110, '메뉴로', {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302);
    els.push(menuBg, menuLabel);
    menuBg.on('pointerover', () => menuBg.setFillStyle(0x6666aa));
    menuBg.on('pointerout', () => menuBg.setFillStyle(0x444466));
    menuBg.on('pointerdown', () => { this.scene.stop(); this.scene.start('MenuScene'); });

    this.pauseMenuElements = els;
  }

  showSettingsFromPause() {
    if (this.settingsEls.length > 0) return;
    // 일시정지 메뉴 숨기기
    this.pauseMenuElements.forEach(el => el.setVisible(false));
    const els = [];
    createSettingsPanel(this, VIEW_W / 2, VIEW_H / 2, els, () => {
      this.settingsEls.forEach(e => e.destroy());
      this.settingsEls = [];
      this.pauseMenuElements.forEach(el => el.setVisible(true));
    });
    this.settingsEls = els;
  }

  resumeGame() {
    this.pauseMenuElements.forEach(el => el.destroy());
    this.pauseMenuElements = [];
    this.settingsEls.forEach(el => el.destroy());
    this.settingsEls = [];
    this.paused = false;
    this.physics.resume();
  }

  gameOver() {
    this.paused = true;
    this.physics.pause();
    this.scene.launch('GameOverScene', {
      kills: this.kills, wave: this.wave, time: this.elapsed, difficulty: this.diffKey,
    });
  }
}

// ============================================================
//  GameOverScene
// ============================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  init(data) { this.stats = data; }

  create() {
    const cx = VIEW_W / 2, cy = VIEW_H / 2;
    this.add.rectangle(cx, cy, VIEW_W, VIEW_H, 0x000000, 0.75);

    const mm = String(Math.floor(this.stats.time / 60)).padStart(2, '0');
    const ss = String(this.stats.time % 60).padStart(2, '0');

    this.add.text(cx, cy - 100, 'GAME OVER', {
      fontSize: '48px', fill: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 20, [
      `생존 시간: ${mm}:${ss}`,
      `웨이브: ${this.stats.wave}`,
      `킬: ${this.stats.kills}`,
    ].join('\n'), {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);

    const restartBg = this.add.rectangle(cx, cy + 120, 240, 50, 0x446644)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 120, '다시 시작', {
      fontSize: '24px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    restartBg.on('pointerover', () => restartBg.setFillStyle(0x66aa66));
    restartBg.on('pointerout', () => restartBg.setFillStyle(0x446644));
    restartBg.on('pointerdown', () => {
      this.scene.stop('GameOverScene');
      this.scene.stop('GameScene');
      this.scene.start('GameScene', { difficulty: this.stats.difficulty });
    });

    const menuBg = this.add.rectangle(cx, cy + 180, 240, 50, 0x444466)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 180, '메뉴로', {
      fontSize: '24px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    menuBg.on('pointerover', () => menuBg.setFillStyle(0x6666aa));
    menuBg.on('pointerout', () => menuBg.setFillStyle(0x444466));
    menuBg.on('pointerdown', () => {
      this.scene.stop('GameOverScene');
      this.scene.stop('GameScene');
      this.scene.start('MenuScene');
    });
  }
}

// ============================================================
//  Config
// ============================================================
const config = {
  type: Phaser.AUTO,
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#1a1a2e',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [MenuScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);
