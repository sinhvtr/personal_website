// Máy gắp: di chuyển, hạ càng, khép càng, kéo lên, mang về ô thả, nhả, quay lại.
// Trạng thái: idle → down → closing → up → carry → release → return → idle
//                                        └→ reopen (gắp trượt / tuột) → idle
(function () {
    const C = Suki.CFG;
    const { Composite, Constraint, Query, Body } = Matter;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ARM_OPEN = 58;   // chiều dài càng khi mở

    class Claw {
        constructor(game) {
            this.game = game;
            this.reset();
        }

        reset() {
            this.x = 300;
            this.y = C.clawRestY;
            this.open = 1;          // 1 = mở hẳn, 0 = khép hẳn
            this.state = 'idle';
            this.t = 0;
            this.held = null;       // thú bông đang giữ
            this.target = null;     // thú bông đang nhắm khi khép càng
            this.link = null;
            this.returnX = this.x;
            this.slipTimer = -1;
            this.slipped = false;
        }

        get tipY() { return this.y + ARM_OPEN; }
        get minX() { return (C.wallL + C.chuteR) / 2; }
        get maxX() { return C.wallR - 46; }
        get busy() { return this.state !== 'idle'; }

        startDrop() {
            if (this.state !== 'idle') return false;
            this.state = 'down';
            this.returnX = this.x;
            this.slipped = false;
            this.game.input.targetX = null;
            Suki.Audio.play('drop');
            return true;
        }

        update(dt, canMove) {
            const input = this.game.input;
            switch (this.state) {
                case 'idle': {
                    if (!canMove) break;
                    const d = input.dir;
                    const speed = C.clawMove * this.game.speedFactor();
                    if (d) {
                        this.x += d * speed * dt;
                        input.targetX = null;
                    } else if (input.targetX !== null) {
                        const tx = clamp(input.targetX, this.minX, this.maxX);
                        const step = speed * dt;
                        if (Math.abs(tx - this.x) <= step) {
                            this.x = tx;
                            input.targetX = null;
                        } else {
                            this.x += Math.sign(tx - this.x) * step;
                        }
                    }
                    this.x = clamp(this.x, this.minX, this.maxX);
                    break;
                }
                case 'down':
                    this.y += C.clawDown * dt;
                    if (this.tipY >= C.floorY - 4 || this._touching()) {
                        this.state = 'closing';
                        this.t = 0;
                        this.target = this._findTarget();
                        Suki.Audio.play('close');
                    }
                    break;
                case 'closing':
                    this.t += dt;
                    this.open = Math.max(0, 1 - this.t / C.closeTime);
                    if (this.t >= C.closeTime) {
                        this._attach();
                        this.state = 'up';
                    }
                    break;
                case 'up':
                    this.y -= C.clawUp * this._liftFactor() * dt;
                    if (this.y <= C.clawRestY) {
                        this.y = C.clawRestY;
                        this.t = 0;
                        if (this.held) {
                            this.state = 'carry';
                        } else {
                            this.state = 'reopen';
                            if (!this.slipped) this.game.onEmpty(this.x, this.tipY);
                        }
                    }
                    break;
                case 'carry':
                    if (!this.held) { this.state = 'reopen'; this.t = 0; break; }
                    this.x -= C.clawCarry * this._liftFactor() * dt;
                    if (this.x <= this.minX) {
                        this.x = this.minX;
                        this.state = 'release';
                        this.t = 0;
                        this._detach(false);
                    }
                    break;
                case 'release':
                    this.t += dt;
                    this.open = Math.min(1, this.t / C.openTime);
                    if (this.t >= C.openTime + 0.25) this.state = 'return';
                    break;
                case 'return': {
                    const step = C.clawReturn * dt;
                    if (Math.abs(this.returnX - this.x) <= step) {
                        this.x = this.returnX;
                        this.state = 'idle';
                    } else {
                        this.x += Math.sign(this.returnX - this.x) * step;
                    }
                    break;
                }
                case 'reopen':
                    this.t += dt;
                    this.open = Math.min(1, this.t / C.openTime);
                    if (this.open >= 1) this.state = 'idle';
                    break;
            }

            // Tuột tay giữa chừng
            if (this.held && this.slipTimer >= 0) {
                this.slipTimer -= dt;
                if (this.slipTimer < 0) this._detach(true);
            }
        }

        // Gọi trước mỗi bước vật lý: kéo thú bông đang giữ theo càng
        syncHeld() {
            if (!this.link) return;
            this.link.pointA.x = this.x;
            this.link.pointA.y = this.holdY(this.held);
        }

        holdY(body) { return this.y + 20 + body.item.r; }

        // Kéo thú bông nặng thì càng đi chậm hơn
        _liftFactor() {
            return this.held && this.held.item.heavy ? C.photoLift : 1;
        }

        _touching() {
            const bounds = {
                min: { x: this.x - 20, y: this.tipY - 6 },
                max: { x: this.x + 20, y: this.tipY + 4 }
            };
            return Query.region(this.game.toys, bounds).length > 0;
        }

        _findTarget() {
            let best = null, bestScore = Infinity;
            for (const b of this.game.toys) {
                const dx = Math.abs(b.position.x - this.x);
                const dy = b.position.y - this.tipY;
                const r = b.item.r;
                if (dx < C.grabRangeX && dy > -r * 0.9 && dy < r * 1.4) {
                    const s = dx + Math.abs(dy) * 0.3;
                    if (s < bestScore) { bestScore = s; best = b; }
                }
            }
            return best;
        }

        _attach() {
            const b = this.target;
            this.target = null;
            if (!b || !this.game.toys.includes(b)) return;

            // Gắp càng lệch tâm càng dễ tuột
            const dx = Math.abs(b.position.x - this.x);
            let hold = C.baseHold - C.holdPenalty * (dx / C.grabRangeX);
            if (b.item.heavy) hold *= C.photoHold;          // thú bông ảnh nặng nên dễ tuột hơn
            if (this.game.effects.grip > 0) hold = 1;       // quà "càng siêu chắc" thì không bao giờ tuột
            this.slipTimer = Math.random() < hold ? -1 : 0.3 + Math.random() * 1.4;

            this.held = b;
            b.frictionAir = 0.06;
            this.link = Constraint.create({
                pointA: { x: this.x, y: this.holdY(b) },
                bodyB: b,
                pointB: { x: 0, y: 0 },
                length: 0,
                stiffness: 0.18,
                damping: 0.1
            });
            Composite.add(this.game.world, this.link);
        }

        _detach(isSlip) {
            const b = this.held;
            if (this.link) Composite.remove(this.game.world, this.link);
            this.link = null;
            this.held = null;
            this.slipTimer = -1;
            if (!b) return;
            b.frictionAir = 0.01;
            Body.setVelocity(b, { x: b.velocity.x * 0.5, y: Math.max(b.velocity.y, 1) });
            if (isSlip) {
                this.slipped = true;
                this.game.onSlip(b);
            }
        }
    }

    Claw.ARM_OPEN = ARM_OPEN;
    Suki.Claw = Claw;
})();
