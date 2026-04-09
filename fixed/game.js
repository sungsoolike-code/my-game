// ============================================================
//  Wave Survival – Phaser 3 (Fixed Screen)
// ============================================================

const VIEW_W = 1024;
const VIEW_H = 768;
const WORLD_W = VIEW_W;
const WORLD_H = VIEW_H;

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

// ============================================================
//  MenuScene
// ============================================================
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  preload() {
    this.load.image('titleImg', '../asset/images/title.jpg');
  }

  create() {
    const cx = VIEW_W / 2, cy = VIEW_H / 2;

    // 타이틀 이미지 (화면 중앙)
    const titleImg = this.add.image(cx, cy - 60, 'titleImg').setOrigin(0.5);
    const maxW = 700, maxH = 400;
    const scale = Math.min(maxW / titleImg.width, maxH / titleImg.height);
    titleImg.setScale(scale);

    this.add.text(cx, 60, 'WAVE SURVIVAL', {
      fontSize: '52px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 난이도 버튼 (가로 배치)
    const btnY = VIEW_H - 160;
    const btnW = 200, btnH = 50, btnGap = 30;
    const keys = ['easy', 'normal', 'hard'];
    const totalW = keys.length * btnW + (keys.length - 1) * btnGap;
    const startX = cx - totalW / 2 + btnW / 2;
    keys.forEach((key, i) => {
      const diff = DIFFICULTY[key];
      const bx = startX + i * (btnW + btnGap);

      const bg = this.add.rectangle(bx, btnY, btnW, btnH, diff.color, 0.25)
        .setStrokeStyle(2, diff.color)
        .setInteractive({ useHandCursor: true });

      this.add.text(bx, btnY, diff.label, {
        fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      bg.on('pointerover', () => bg.setFillStyle(diff.color, 0.5));
      bg.on('pointerout', () => bg.setFillStyle(diff.color, 0.25));
      bg.on('pointerdown', () => this.scene.start('GameScene', { difficulty: key }));
    });

    this.add.text(cx, VIEW_H - 40, 'WASD / 방향키로 이동  |  공격은 자동  |  R: 폭탄', {
      fontSize: '14px', fill: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }
}

// ============================================================
//  GameScene
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    this.load.image('playerShip', '../asset/images/player_ship.png');
  }

  init(data) {
    this.diffKey = data.difficulty || 'normal';
    this.diff = DIFFICULTY[this.diffKey];
  }

  create() {
    const d = this.diff;

    // --- 상태 초기화 ---
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
    this.fastSpawnCount = 0;

    // --- 파티클 텍스처 생성 ---
    if (!this.textures.exists('particle')) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture('particle', 8, 8);
      gfx.destroy();
    }

    // --- 월드 경계 ---
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // --- 배경 그리드 ---
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x222244, 0.4);
    for (let gx = 0; gx <= WORLD_W; gx += 64) { grid.lineBetween(gx, 0, gx, WORLD_H); }
    for (let gy = 0; gy <= WORLD_H; gy += 64) { grid.lineBetween(0, gy, WORLD_W, gy); }
    grid.lineStyle(2, 0x884444, 0.6);
    grid.strokeRect(0, 0, WORLD_W, WORLD_H);
    grid.setDepth(-1);

    // --- 플레이어 ---
    this.player = this.add.image(WORLD_W / 2, WORLD_H / 2, 'playerShip').setDisplaySize(48, 48);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // --- 카메라 (고정) ---
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

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

    // --- 적 스폰 타이머 ---
    this.spawnEvent = this.time.addEvent({
      delay: d.spawnDelay,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
    });

    // --- UI ---
    this.createUI();

    // --- 일시정지 (스페이스바) ---
    this.pauseMenuElements = [];
    this.input.keyboard.on('keydown-SPACE', () => {
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

    // --- 웨이브 타이머 (1초마다) ---
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

  // ---------- UI 생성 ----------
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
    this.healCountText = this.add.text(VIEW_W - 10, 90, '', { fontSize: '13px', fill: '#88aa88', fontFamily: 'monospace' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    const dc = this.diff.color;
    const dHex = '#' + dc.toString(16).padStart(6, '0');
    this.add.text(VIEW_W / 2, 10, this.diff.label, {
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
    this.healCountText.setText(`HEAL: ${this.healCollected % 100}/100`);
  }

  // ---------- 메인 업데이트 ----------
  update(time) {
    if (this.paused) return;
    this.movePlayer();
    this.autoFire(time);
    this.chasePlayer();
    this.attractPowerups();
    this.updateUI();
  }

  // ---------- 플레이어 이동 ----------
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

  // ---------- 자동 발사 ----------
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

  // ---------- 적 추적 ----------
  chasePlayer() {
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
      const spd = e.getData('speed');
      e.body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
    });
  }

  // ---------- 파워업 끌어당기기 ----------
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
        if (this.fastSpawnCount % 100 === 0) {
          isSuicider = true;
        }
      }
      const cfg = ENEMY_TYPES[type];

      const cam = this.cameras.main;
      const cl = cam.scrollX, ct = cam.scrollY;
      const cr = cl + VIEW_W, cb = ct + VIEW_H;
      let x, y;
      const side = Phaser.Math.Between(0, 3);
      const margin = 60;
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

  // ---------- 난이도 조절 ----------
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
        if (eGridX === c.gx && eGridY === c.gy) {
          toKill.push(e);
          break;
        }
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
    const milestone = Math.floor(this.kills / 100);
    if (milestone > this.lastHpUpgrade) {
      this.lastHpUpgrade = milestone;
      const bonus = Math.floor(this.maxHp * 0.1);
      this.maxHp += bonus;
      this.hp = Math.min(this.hp + bonus, this.maxHp);
      this.showBuffText(`MAX HP +10%  (${this.maxHp})`);
    }
  }

  // ---------- 충돌 콜백 ----------
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

      this.spawnDeathParticles(enemy.x, enemy.y, enemy.fillColor);
      this.addKill();
      const healOrb = this.add.circle(enemy.x, enemy.y, 5, 0x00ff88);
      this.physics.add.existing(healOrb);
      healOrb.setData('type', 'heal');
      this.powerups.add(healOrb);

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
    this.hp -= enemy.getData('damage');
    enemy.destroy();
    this.cameras.main.shake(100, 0.01);
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
        this.bombCount++;
        this.showBuffText('BOMB +1!');
      }
    } else if (type === 'speed') {
      this.playerSpeed *= 1.05;
      this.showBuffText('SPD +5%');
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
      callback: () => {
        this.killEnemiesInCells(cells);
      },
    });
  }

  killEnemiesInCells(cells) {
    const toKill = [];
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const eGridX = Math.floor(e.x / 64);
      const eGridY = Math.floor(e.y / 64);
      for (const c of cells) {
        if (eGridX === c.gx && eGridY === c.gy) {
          toKill.push(e);
          break;
        }
      }
    });

    toKill.forEach(e => {
      this.spawnDeathParticles(e.x, e.y, e.fillColor);
      this.addKill();
      const healOrb = this.add.circle(e.x, e.y, 5, 0x00ff88);
      this.physics.add.existing(healOrb);
      healOrb.setData('type', 'heal');
      this.powerups.add(healOrb);
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

  showBuffText(msg) {
    const txt = this.add.text(VIEW_W / 2, VIEW_H / 2 - 30, msg, {
      fontSize: '24px', fill: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 30, duration: 1000, onComplete: () => txt.destroy() });
  }

  // ---------- 일시정지 메뉴 ----------
  showPauseMenu() {
    this.paused = true;
    this.physics.pause();
    const els = [];

    const overlay = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(300);
    els.push(overlay);

    const title = this.add.text(VIEW_W / 2, VIEW_H / 2 - 100, 'PAUSED', {
      fontSize: '40px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    els.push(title);

    const hint = this.add.text(VIEW_W / 2, VIEW_H / 2 - 55, 'SPACE 를 눌러 계속', {
      fontSize: '14px', fill: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    els.push(hint);

    const resumeBg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2 + 10, 260, 50, 0x446644)
      .setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });
    const resumeLabel = this.add.text(VIEW_W / 2, VIEW_H / 2 + 10, '다시 시작', {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302);
    els.push(resumeBg, resumeLabel);
    resumeBg.on('pointerover', () => resumeBg.setFillStyle(0x66aa66));
    resumeBg.on('pointerout', () => resumeBg.setFillStyle(0x446644));
    resumeBg.on('pointerdown', () => this.resumeGame());

    const menuBg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2 + 75, 260, 50, 0x444466)
      .setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });
    const menuLabel = this.add.text(VIEW_W / 2, VIEW_H / 2 + 75, '메뉴로', {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302);
    els.push(menuBg, menuLabel);
    menuBg.on('pointerover', () => menuBg.setFillStyle(0x6666aa));
    menuBg.on('pointerout', () => menuBg.setFillStyle(0x444466));
    menuBg.on('pointerdown', () => { this.scene.stop(); this.scene.start('MenuScene'); });

    this.pauseMenuElements = els;
  }

  resumeGame() {
    this.pauseMenuElements.forEach(el => el.destroy());
    this.pauseMenuElements = [];
    this.paused = false;
    this.physics.resume();
  }

  // ---------- 게임오버 ----------
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
