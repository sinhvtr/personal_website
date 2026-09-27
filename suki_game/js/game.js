// Vòng lặp game: vật lý, đồng hồ 60 giây, tính điểm, hiệu ứng, vẽ máy gắp.
// Pha: countdown (3-2-1) → play → grace (chờ lần gắp cuối) → over
(function () {
    const C = Suki.CFG;
    const { Engine, Bodies, Body, Composite, Query } = Matter;

    const TAU = Math.PI * 2;
    const FONT = '"Baloo 2", system-ui, sans-serif';
    const STEP = 1000 / 60;
    const CHUTE_CX = (C.wallL + C.chuteR) / 2;
    const PRAISE = ['Giỏi quá!', 'Tuyệt vời!', 'Yeah!', 'Siêu ghê!', 'Đỉnh quá!'];
    const PHOTO_PRAISE = ['Giỏi quá Suki ơi!', 'Suki siêu quá!', 'Suki tuyệt vời!'];
    const SPARKS = ['#FF9EB5', '#FFC94D', '#8FDDBB', '#9CCBF5', '#B9A6F0'];
    const BUBBLES = [[120, 160, 26], [760, 140, 18], [820, 330, 30], [300, 110, 14], [560, 220, 22], [240, 330, 16]];
    const MAX_PHOTO_TOYS = 2;
    const CELEBRATE_TIME = 2;

    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    function roundRect(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    function star(g, x, y, r, color) {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = color;
        g.fill();
    }

    // Vẽ emoji một lần ra canvas nhỏ rồi dùng lại (nhanh hơn fillText mỗi khung hình)
    const spriteCache = {};
    function emojiSprite(ch) {
        if (!spriteCache[ch]) {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const g = c.getContext('2d');
            g.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(ch, 64, 70);
            spriteCache[ch] = c;
        }
        return spriteCache[ch];
    }

    class Game {
        constructor(canvas, input, hooks) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.input = input;
            this.hooks = hooks;
            this.running = false;
            this.paused = false;
            this.phase = 'over';
            this.time = 0;
            this.toys = [];
            this.popups = [];
            this.sparks = [];
            this.effects = { double: 0, grip: 0, slow: 0 };
            this.claw = new Suki.Claw(this);
            this._bindPointer();
        }

        // ---------- Kích thước ----------
        resize(w, h) {
            if (w <= 0 || h <= 0) return;
            const s = Math.min(w / C.W, h / C.H);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.canvas.style.width = Math.floor(C.W * s) + 'px';
            this.canvas.style.height = Math.floor(C.H * s) + 'px';
            this.canvas.width = Math.round(C.W * s * dpr);
            this.canvas.height = Math.round(C.H * s * dpr);
            this.ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
            if (this.engine) this.draw();
        }

        _bindPointer() {
            const c = this.canvas;
            let down = false;
            const toX = e => {
                const r = c.getBoundingClientRect();
                return (e.clientX - r.left) / r.width * C.W;
            };
            c.addEventListener('pointerdown', e => {
                e.preventDefault();
                down = true;
                try { c.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
                if (this.phase === 'play' && !this.paused) this.input.targetX = toX(e);
            });
            c.addEventListener('pointermove', e => {
                if (down && this.phase === 'play' && !this.paused) this.input.targetX = toX(e);
            });
            ['pointerup', 'pointercancel'].forEach(t => c.addEventListener(t, () => { down = false; }));
        }

        // ---------- Vòng đời ván chơi ----------
        // photos: [{ id, img }] ảnh của Suki đã lưu trên máy (có thể rỗng)
        start(photos) {
            this.photos = photos || [];
            this.engine = Engine.create();
            this.engine.gravity.y = 1;
            this.engine.positionIterations = 8;
            this.engine.velocityIterations = 6;
            this.world = this.engine.world;

            const wall = { isStatic: true, friction: 0.4, restitution: 0.1 };
            Composite.add(this.world, [
                // sàn hố thú bông (ô thả không có sàn → thú rơi ra ngoài là được điểm)
                Bodies.rectangle((C.chuteR + C.wallR + 40) / 2, C.floorY + 30, C.wallR + 40 - C.chuteR, 60, wall),
                Bodies.rectangle(C.wallL - 30, C.H / 2, 60, C.H * 3, wall),
                Bodies.rectangle(C.wallR + 30, C.H / 2, 60, C.H * 3, wall),
                Bodies.rectangle(C.chuteR, (C.chuteTop + C.H + 100) / 2, C.wallT, C.H + 100 - C.chuteTop,
                    Object.assign({ chamfer: { radius: C.wallT / 2 - 1 } }, wall))
            ]);

            this.toys = [];
            this.popups = [];
            this.sparks = [];
            this.caught = [];
            this.score = 0;
            this.timeLeft = C.roundTime;
            this.phase = 'countdown';
            this.phaseT = 0;
            this.spawnT = 0;
            this.banner = null;
            this.celebrate = null;
            this.shake = 0;
            this.effects = { double: 0, grip: 0, slow: 0 };
            this.photoToys = 0;
            this.photoTimer = -1;
            this.lastCount = 0;
            this.lastTick = 0;
            this.combo = 0;
            this.bestCombo = 0;
            this.acc = 0;
            this.last = performance.now();
            this.claw.reset();
            this.input.targetX = null;

            // Xếp thú bông thành lưới rồi cho rơi tự nhiên trong lúc đếm ngược.
            // Một thú bông ảnh Suki nằm ở lớp trên để dễ nhìn thấy.
            const cols = 8, x0 = C.chuteR + 70, dx = (C.wallR - 50 - x0) / (cols - 1);
            const photoSlot = 2 * cols + Math.floor(rand(1, cols - 1));
            const items = Array.from({ length: C.startToys }, () => Suki.pickItem());
            // Luôn có ít nhất 2 vật phẩm phạt để bé tập né
            const bads = Suki.ITEMS.filter(it => it.kind === 'bad');
            let badCount = items.filter(it => it.kind === 'bad').length;
            for (let guard = 0; badCount < 2 && guard < 50; guard++) {
                const i = Math.floor(rand(0, items.length));
                if (i !== photoSlot && items[i].kind === 'toy') { items[i] = pick(bads); badCount++; }
            }
            for (let i = 0; i < C.startToys; i++) {
                const col = i % cols, row = Math.floor(i / cols);
                const x = x0 + col * dx + rand(-4, 4), y = C.floorY - 60 - row * 85 + rand(-4, 4);
                if (i === photoSlot) this._addPhotoToy(x, y);
                else this._addToy(x, y, items[i]);
            }

            this.running = true;
            this.paused = false;
        }

        stop() {
            this.running = false;
            Suki.Audio.stopMusic();
        }

        isActive() { return this.running && this.phase !== 'over'; }

        setPaused(p) {
            this.paused = p;
            if (p) Suki.Audio.stopMusic();
            else if (this.phase === 'play' || this.phase === 'grace') Suki.Audio.startMusic();
        }

        requestGrab() {
            if (this.phase === 'play' && !this.paused) this.claw.startDrop();
        }

        speedFactor() { return this.effects.slow > 0 ? 0.45 : 1; }

        _addToy(x, y, item) {
            item = item || Suki.pickItem();
            // Thú bông ảnh nặng và trơn nên dễ lọt qua khe, chìm xuống dưới
            const b = Bodies.circle(x, y, item.r, item.heavy ? {
                restitution: 0.05,
                friction: 0.05,
                frictionStatic: 0.1,
                frictionAir: 0.01,
                density: C.photoDensity
            } : {
                restitution: 0.15,
                friction: 0.5,
                frictionAir: 0.01,
                density: 0.0015
            });
            b.item = item;
            Body.setAngle(b, rand(-0.6, 0.6));
            Composite.add(this.world, b);
            this.toys.push(b);
            return b;
        }

        _addPhotoToy(x, y) {
            const b = this._addToy(x, y, Suki.PHOTO_ITEM);
            b.photo = this.photos.length ? pick(this.photos).img : null;
            this.photoToys++;
            return b;
        }

        _removeToy(b) {
            Composite.remove(this.world, b);
            const i = this.toys.indexOf(b);
            if (i >= 0) this.toys.splice(i, 1);
        }

        // ---------- Cập nhật ----------
        frame(now) {
            if (!this.running) return;
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            if (!this.paused) this.update(dt);
            this.draw();
        }

        update(dt) {
            this.time += dt;

            // Vật lý bước cố định 60Hz
            this.acc += dt * 1000;
            let n = 0;
            while (this.acc >= STEP && n < 4) {
                this.claw.syncHeld();
                this._sink();
                Engine.update(this.engine, STEP);
                this.acc -= STEP;
                n++;
            }
            if (n === 4) this.acc = 0;

            // Màn chúc mừng ảnh Suki: dừng đồng hồ và hiệu ứng cho tới khi xong
            const frozen = !!this.celebrate;

            this.phaseT += dt;
            if (this.phase === 'countdown') {
                const count = 3 - Math.floor(this.phaseT);
                if (count !== this.lastCount && count > 0) {
                    this.lastCount = count;
                    Suki.Audio.play('count');
                }
                if (this.phaseT >= 3) {
                    this.phase = 'play';
                    this.phaseT = 0;
                    this.banner = { text: 'Bắt đầu!', life: 1 };
                    Suki.Audio.play('go');
                    Suki.Audio.startMusic();
                }
            } else if (this.phase === 'play') {
                if (!frozen) this.timeLeft -= dt;
                const sec = Math.ceil(this.timeLeft);
                if (this.timeLeft <= C.hurryTime && sec !== this.lastTick && sec > 0) {
                    this.lastTick = sec;
                    Suki.Audio.play('tick');
                }
                Suki.Audio.setFast(this.timeLeft <= C.hurryTime);
                if (this.timeLeft <= 0) {
                    this.timeLeft = 0;
                    this.phase = 'grace';
                    this.phaseT = 0;
                    this.input.targetX = null;
                    this.banner = { text: 'Hết giờ!', life: 1.4 };
                }
            } else if (this.phase === 'grace') {
                const settled = !this.claw.busy && !this._chuteBusy() && !this.celebrate;
                if ((settled && this.phaseT > 1.4) || this.phaseT > C.graceMax + (frozen ? CELEBRATE_TIME : 0)) {
                    this._finish();
                    return;
                }
            }

            if (this.phase === 'play' && !frozen) {
                for (const k in this.effects) this.effects[k] = Math.max(0, this.effects[k] - dt);
            }

            this.claw.update(dt, this.phase === 'play');
            if (this.phase === 'play') {
                this._refill(dt);
                this._spawnPhoto(dt);
            }
            this._collect();
            this._updateFx(dt);

            this.hooks.onHud(this.score, Math.ceil(this.timeLeft),
                this.phase === 'play' && this.timeLeft <= C.hurryTime, this.effects, this.combo);
        }

        // Lực kéo xuống thêm cho thú bông nặng (lực bị xoá sau mỗi bước vật lý nên phải đặt lại)
        _sink() {
            for (const b of this.toys) {
                if (b.item.heavy) Body.applyForce(b, b.position, { x: 0, y: b.mass * 0.001 * C.photoSink });
            }
        }

        _chuteBusy() {
            return this.toys.some(b => b.position.x < C.chuteR && b.position.y > C.chuteTop - 80);
        }

        _findFreeSpot(y) {
            for (let tries = 0; tries < 6; tries++) {
                const x = rand(C.chuteR + 90, C.wallR - 60);
                if (Math.abs(x - this.claw.x) < 100) continue;
                const hits = Query.region(this.toys, { min: { x: x - 50, y: y - 50 }, max: { x: x + 50, y: y + 50 } });
                if (hits.length === 0) return x;
            }
            return null;
        }

        _refill(dt) {
            this.spawnT += dt;
            if (this.toys.length >= C.minToys || this.spawnT < C.spawnEvery) return;
            this.spawnT = 0;
            const x = this._findFreeSpot(150);
            if (x !== null) this._addToy(x, 150);
        }

        // Thú bông ảnh thứ hai rơi xuống sau khi con đầu tiên được gắp
        _spawnPhoto(dt) {
            if (this.photoTimer < 0) return;
            this.photoTimer -= dt;
            if (this.photoTimer > 0) return;
            const x = this._findFreeSpot(150);
            if (x === null) { this.photoTimer = 0.3; return; }
            this.photoTimer = -1;
            this._addPhotoToy(x, 150);
            this._popup(x, 110, 'Có quà mới! ⭐', '#E0A800', 32);
        }

        // Vật phẩm rơi ra khỏi đáy ô thả → áp dụng thưởng/phạt
        _collect() {
            for (const b of this.toys.slice()) {
                if (b.position.y < C.H + b.item.r + 10) continue;
                this._removeToy(b);
                if (b.position.x > C.chuteR + 20) continue;
                this.caught.push(b.item);
                this._award(b);
            }
        }

        _addScore(points) {
            if (points > 0 && this.effects.double > 0) points *= 2;
            this.score = Math.max(0, this.score + points);   // điểm không bao giờ âm
            return points;
        }

        _award(b) {
            const item = b.item;
            const px = CHUTE_CX, py = C.chuteTop - 40;
            const side = CHUTE_CX + 160;

            switch (item.kind) {
                case 'toy':
                case 'rare': {
                    const pts = this._addScore(item.points);
                    const rare = item.kind === 'rare';
                    this._popup(px, py, '+' + pts, '#E0607E', rare ? 56 : 44);
                    this._popup(side, py - 70, rare ? 'Thú hiếm! 🌟' : pick(PRAISE), '#8A6FD6', 36);
                    this._burst(px, py + 20, rare ? 40 : 22);
                    Suki.Audio.play(rare ? 'rare' : 'catch');
                    this.hooks.onCatch(item);
                    this._comboHit();
                    break;
                }
                case 'photo': {
                    const pts = this._addScore(item.points);
                    this.celebrate = { img: b.photo, life: CELEBRATE_TIME, points: pts, text: pick(PHOTO_PRAISE) };
                    this._burst(px, py + 20, 50);
                    Suki.Audio.play('photo');
                    this.hooks.onCatch(item, true);
                    this._comboHit();
                    if (this.photoToys < MAX_PHOTO_TOYS) this.photoTimer = 3;
                    break;
                }
                case 'clock': {
                    if (this.phase === 'grace') {
                        // Gắp được đồng hồ đúng lúc hết giờ → được chơi thêm
                        this.phase = 'play';
                        this.timeLeft = item.seconds;
                        this.lastTick = 0;
                    } else {
                        this.timeLeft += item.seconds;
                    }
                    this._popup(px, py, `+${item.seconds} giây`, '#3D8FD6', 42);
                    this._burst(px, py + 20, 22);
                    Suki.Audio.play('clock');
                    this.hooks.onCatch(item);
                    this._comboHit();
                    break;
                }
                case 'gift': {
                    const gift = pick(Suki.GIFTS);
                    if (gift.points) this._addScore(gift.points);
                    else this.effects[gift.id] = gift.seconds;
                    this._popup(px + 60, py, '🎁 ' + gift.text, '#D6559B', 40);
                    this._burst(px, py + 20, 30);
                    Suki.Audio.play('gift');
                    this.hooks.onCatch(item);
                    this._comboHit();
                    break;
                }
                case 'bad': {
                    this._addScore(item.points);
                    this.combo = 0;
                    this._popup(px, py, String(item.points), '#8E8499', 44);
                    this._popup(side, py - 70, '😝 Ối!', '#E0607E', 40);
                    if (item.effect === 'shake') this.shake = 0.5;
                    if (item.effect === 'slow') {
                        this.effects.slow = 3;
                        this._popup(side, py - 20, 'Càng chậm lại 🐌', '#8E8499', 28);
                    }
                    Suki.Audio.play('bad');
                    this.hooks.onBad(item);
                    break;
                }
            }
        }

        // Gắp trúng liên tiếp: lần thứ n được thêm comboStep × (n − 1) điểm
        _comboHit() {
            this.combo++;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
            if (this.combo < 2) return;
            const bonus = C.comboStep * (this.combo - 1);
            this.score += bonus;
            this._popup(C.W / 2 + 60, C.chuteTop - 180, `🔥 Combo ×${this.combo}! +${bonus}`, '#F08A24', 40);
            Suki.Audio.play('combo', this.combo);
        }

        _finish() {
            this.phase = 'over';
            this.running = false;
            Suki.Audio.stopMusic();
            Suki.Audio.play('end');
            this.draw();
            this.hooks.onEnd({ score: this.score, caught: this.caught, bestCombo: this.bestCombo });
        }

        // Gọi từ Claw
        onEmpty(x, y) {
            this.combo = 0;
            this._popup(x, y + 40, 'Trượt rồi, thử lại nhé!', '#8A6FD6', 30);
            Suki.Audio.play('empty');
        }
        onSlip(b) {
            this.combo = 0;
            this._popup(b.position.x, b.position.y - 50, 'Ối, tuột mất!', '#E0607E', 34);
            Suki.Audio.play('slip');
        }

        // ---------- Hiệu ứng ----------
        _popup(x, y, text, color, size) {
            x = Math.max(140, Math.min(C.W - 140, x));
            this.popups.push({ x, y, text, color, size, life: 1.3 });
        }

        _burst(x, y, n) {
            for (let i = 0; i < n; i++) {
                const a = rand(-Math.PI, 0), v = rand(180, 440);
                this.sparks.push({
                    x, y,
                    vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                    r: rand(4, 9), color: SPARKS[i % SPARKS.length], life: rand(0.6, 1.1),
                    star: Math.random() < 0.35
                });
            }
        }

        _updateFx(dt) {
            for (const p of this.popups) { p.life -= dt; p.y -= 50 * dt; }
            this.popups = this.popups.filter(p => p.life > 0);
            for (const s of this.sparks) {
                s.life -= dt; s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
            }
            this.sparks = this.sparks.filter(s => s.life > 0);
            if (this.banner) {
                this.banner.life -= dt;
                if (this.banner.life <= 0) this.banner = null;
            }
            if (this.celebrate) {
                this.celebrate.life -= dt;
                if (this.celebrate.life <= 0) this.celebrate = null;
            }
            this.shake = Math.max(0, this.shake - dt);
        }

        // ---------- Vẽ ----------
        draw() {
            const g = this.ctx;
            g.clearRect(0, 0, C.W, C.H);
            g.save();
            if (this.shake > 0) {
                const a = 14 * this.shake;
                g.translate(rand(-a, a), rand(-a, a));
            }
            this._drawMachine(g);

            const held = this.claw.held;
            for (const b of this.toys) if (b !== held) this._drawToy(g, b);
            if (held) this._drawToy(g, held);

            this._drawClaw(g);
            this._drawFx(g);
            this._drawFrame(g);
            g.restore();
            this._drawOverlayText(g);
            this._drawCelebrate(g);
        }

        _drawMachine(g) {
            // kính nền
            const bg = g.createLinearGradient(0, 0, 0, C.H);
            bg.addColorStop(0, '#EAF4FF');
            bg.addColorStop(1, '#F6EEFF');
            roundRect(g, 0, 0, C.W, C.H, 28);
            g.fillStyle = bg;
            g.fill();

            g.fillStyle = 'rgba(255,255,255,.55)';
            for (const [x, y, r] of BUBBLES) {
                g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            }
            // vệt sáng trên kính
            g.save();
            g.globalAlpha = 0.35;
            g.fillStyle = '#fff';
            g.beginPath();
            g.moveTo(640, 70); g.lineTo(700, 70); g.lineTo(560, 400); g.lineTo(520, 400);
            g.closePath(); g.fill();
            g.restore();

            // ô thả
            roundRect(g, C.wallL, C.chuteTop - 10, C.chuteR - C.wallL, C.H - C.chuteTop + 40, 18);
            g.fillStyle = 'rgba(255, 209, 220, .6)';
            g.fill();
            g.fillStyle = '#E48AA3';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.font = `800 34px ${FONT}`;
            g.fillText('⬇', CHUTE_CX, C.chuteTop + 55 + Math.sin(this.time * 5) * 6);
            g.font = `800 24px ${FONT}`;
            g.fillText('THẢ', CHUTE_CX, C.chuteTop + 110);
            g.fillText('VÀO ĐÂY', CHUTE_CX, C.chuteTop + 140);

            // sàn
            g.fillStyle = '#FFF4C2';
            g.fillRect(C.chuteR, C.floorY, C.wallR - C.chuteR, C.H - C.floorY);
            g.fillStyle = '#F5DE8A';
            g.fillRect(C.chuteR, C.floorY, C.wallR - C.chuteR, 4);

            // vách ngăn
            roundRect(g, C.chuteR - C.wallT / 2, C.chuteTop, C.wallT, C.H - C.chuteTop, C.wallT / 2);
            g.fillStyle = '#F4A7B9';
            g.fill();
        }

        _drawToy(g, b) {
            const r = b.item.r, x = b.position.x, y = b.position.y;
            if (b.item.kind === 'photo') { this._drawPhotoToy(g, b); return; }

            g.save();
            g.translate(x, y);
            g.rotate(b.angle);
            g.beginPath();
            g.arc(0, 0, r, 0, TAU);
            g.fillStyle = b.item.color;
            g.fill();
            g.lineWidth = 3;
            g.strokeStyle = b.item.kind === 'bad' ? '#B8AFC2' : 'rgba(255,255,255,.95)';
            g.stroke();
            const s = r * 1.6;
            g.drawImage(emojiSprite(b.item.emoji), -s / 2, -s / 2, s, s);
            g.restore();

            // thú hiếm có vài ngôi sao lấp lánh
            if (b.item.kind === 'rare') {
                const a = this.time * 2 + b.id;
                star(g, x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6), 7, '#FFC94D');
            }
        }

        // Ảnh Suki luôn đứng thẳng (không xoay theo vật lý) để nhìn rõ mặt
        _drawPhotoToy(g, b) {
            const r = b.item.r, x = b.position.x, y = b.position.y;
            g.save();
            g.beginPath();
            g.arc(x, y, r, 0, TAU);
            g.fillStyle = b.item.color;
            g.fill();
            if (b.photo) {
                g.save();
                g.clip();
                g.drawImage(b.photo, x - r, y - r, r * 2, r * 2);
                g.restore();
            } else {
                const s = r * 1.5;
                g.drawImage(emojiSprite(b.item.emoji), x - s / 2, y - s / 2, s, s);
            }
            // viền vàng lấp lánh
            const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
            g.lineWidth = 6;
            g.strokeStyle = `rgba(255, 201, 77, ${0.75 + 0.25 * pulse})`;
            g.beginPath();
            g.arc(x, y, r, 0, TAU);
            g.stroke();
            for (let i = 0; i < 3; i++) {
                const a = this.time * 1.8 + i * TAU / 3;
                star(g, x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9), 7 + 3 * pulse, '#FFC94D');
            }
            g.restore();
        }

        _drawClaw(g) {
            const k = this.claw, x = k.x, y = k.y, o = k.open;
            const obj = k.held || k.target;
            const r = obj ? obj.item.r : 0;

            // thanh ray + xe trượt + dây cáp
            roundRect(g, C.wallL + 6, C.railY - 7, C.wallR - C.wallL - 12, 14, 7);
            g.fillStyle = '#D6C8F7';
            g.fill();
            roundRect(g, x - 28, C.railY - 13, 56, 26, 10);
            g.fillStyle = '#B9A6F0';
            g.fill();
            g.strokeStyle = '#A996E0';
            g.lineWidth = 4;
            g.beginPath(); g.moveTo(x, C.railY + 12); g.lineTo(x, y - 14); g.stroke();

            // hai càng: khi khép quanh thú bông thì ôm theo kích thước của nó
            const L = lerp(obj ? 20 + r * 1.7 : Suki.Claw.ARM_OPEN, Suki.Claw.ARM_OPEN, o);
            const ex = lerp(obj ? r + 8 : 14, 40, o);
            const tx = lerp(obj ? r * 0.45 : 3, 22, o);
            g.lineCap = 'round';
            g.lineJoin = 'round';
            g.lineWidth = 9;
            g.strokeStyle = this.effects.grip > 0 ? '#E6A91A' : this.effects.slow > 0 ? '#A9A2B3' : '#9C88D9';
            for (const s of [-1, 1]) {
                g.beginPath();
                g.moveTo(x + s * 10, y + 6);
                g.lineTo(x + s * ex, y + L * 0.5);
                g.lineTo(x + s * tx, y + L);
                g.stroke();
            }

            // đầu càng
            roundRect(g, x - 27, y - 16, 54, 30, 12);
            g.fillStyle = '#C9B6F2';
            g.fill();
            const blink = k.busy && Math.floor(this.time * 8) % 2 === 0;
            g.beginPath();
            g.arc(x, y - 1, 6, 0, TAU);
            g.fillStyle = blink ? '#FF9EB5' : '#fff';
            g.fill();
        }

        _drawFx(g) {
            for (const s of this.sparks) {
                g.globalAlpha = Math.min(1, s.life * 2);
                if (s.star) star(g, s.x, s.y, s.r * 1.6, s.color);
                else {
                    g.fillStyle = s.color;
                    g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
                }
            }
            g.globalAlpha = 1;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineJoin = 'round';
            for (const p of this.popups) {
                g.globalAlpha = Math.min(1, p.life * 2);
                g.font = `800 ${p.size}px ${FONT}`;
                g.lineWidth = 7;
                g.strokeStyle = '#fff';
                g.strokeText(p.text, p.x, p.y);
                g.fillStyle = p.color;
                g.fillText(p.text, p.x, p.y);
            }
            g.globalAlpha = 1;
        }

        _drawFrame(g) {
            roundRect(g, 5, 5, C.W - 10, C.H - 10, 25);
            g.lineWidth = 10;
            g.strokeStyle = '#FFB6C8';
            g.stroke();
            // đèn nhấp nháy
            const tick = Math.floor(this.time * 3);
            for (let i = 0, x = 60; x < C.W - 40; x += 60, i++) {
                g.beginPath();
                g.arc(x, 16, 6, 0, TAU);
                g.fillStyle = (i + tick) % 2 ? '#FFF4C2' : '#FF9EB5';
                g.fill();
            }
        }

        _drawOverlayText(g) {
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineJoin = 'round';
            let text = null, size = 0, alpha = 1;
            if (this.phase === 'countdown') {
                const n = 3 - Math.floor(this.phaseT);
                const f = this.phaseT % 1;
                text = String(Math.max(1, n));
                size = 170 * (1.3 - 0.3 * Math.min(1, f * 4));
                alpha = 1 - Math.max(0, f - 0.7) / 0.3;
            } else if (this.banner) {
                text = this.banner.text;
                size = 96;
                alpha = Math.min(1, this.banner.life * 2);
            }
            if (!text) return;
            g.globalAlpha = alpha;
            g.font = `800 ${size}px ${FONT}`;
            g.lineWidth = 14;
            g.strokeStyle = '#fff';
            g.strokeText(text, C.W / 2, C.H / 2 - 40);
            g.fillStyle = '#E0607E';
            g.fillText(text, C.W / 2, C.H / 2 - 40);
            g.globalAlpha = 1;
        }

        // Phóng to ảnh Suki giữa màn hình kèm lời khen
        _drawCelebrate(g) {
            const c = this.celebrate;
            if (!c) return;
            const age = CELEBRATE_TIME - c.life;
            const fadeIn = Math.min(1, age / 0.25), fadeOut = Math.min(1, c.life / 0.3);
            const alpha = Math.min(fadeIn, fadeOut);
            // phóng to có nảy nhẹ
            const t = Math.min(1, age / 0.45);
            const bounce = 1 + Math.sin(t * Math.PI) * 0.15;
            const R = 150 * t * bounce;
            const cx = C.W / 2, cy = C.H / 2 - 30;

            g.save();
            g.globalAlpha = alpha;
            g.fillStyle = 'rgba(255, 240, 248, .8)';
            roundRect(g, 0, 0, C.W, C.H, 28);
            g.fill();

            // tia sáng xoay
            g.save();
            g.translate(cx, cy);
            g.rotate(this.time * 0.8);
            g.fillStyle = 'rgba(255, 214, 102, .35)';
            for (let i = 0; i < 12; i++) {
                g.rotate(TAU / 12);
                g.beginPath();
                g.moveTo(0, 0);
                g.lineTo(-24, -330);
                g.lineTo(24, -330);
                g.closePath();
                g.fill();
            }
            g.restore();

            g.beginPath();
            g.arc(cx, cy, R, 0, TAU);
            g.fillStyle = '#FFF4C2';
            g.fill();
            if (c.img) {
                g.save();
                g.clip();
                g.drawImage(c.img, cx - R, cy - R, R * 2, R * 2);
                g.restore();
            } else {
                const s = R * 1.4;
                g.drawImage(emojiSprite(Suki.PHOTO_ITEM.emoji), cx - s / 2, cy - s / 2, s, s);
            }
            g.lineWidth = 12;
            g.strokeStyle = '#FFC94D';
            g.beginPath();
            g.arc(cx, cy, R, 0, TAU);
            g.stroke();
            for (let i = 0; i < 8; i++) {
                const a = this.time * 1.5 + i * TAU / 8;
                star(g, cx + Math.cos(a) * (R + 30), cy + Math.sin(a) * (R + 30), 14, SPARKS[i % SPARKS.length]);
            }

            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineJoin = 'round';
            g.font = `800 60px ${FONT}`;
            g.lineWidth = 12;
            g.strokeStyle = '#fff';
            g.strokeText(c.text, cx, cy + 215);
            g.fillStyle = '#E0607E';
            g.fillText(c.text, cx, cy + 215);
            g.font = `800 54px ${FONT}`;
            g.strokeText('+' + c.points, cx + R + 70, cy - R + 10);
            g.fillStyle = '#E0A800';
            g.fillText('+' + c.points, cx + R + 70, cy - R + 10);
            g.restore();
        }
    }

    Suki.Game = Game;
})();
