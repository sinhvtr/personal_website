// Âm thanh tự tổng hợp bằng Web Audio — không cần tải file, không lo bản quyền.
// iOS chỉ cho phát âm thanh sau lần chạm đầu tiên nên phải gọi unlock() trong sự kiện chạm/bấm.
(function () {
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);

    // Nhạc nền hộp nhạc: 4 ô nhịp, mỗi ô 8 nốt móc đơn (null = nghỉ)
    const MELODY = [
        76, 79, 81, 79, 76, 74, 72, 74,   76, 76, 79, null, 76, 74, 72, null,
        74, 76, 79, 76, 74, 72, 69, 72,   74, 74, 76, null, 74, 72, 69, null,
        72, 76, 79, 84, 81, 79, 76, 79,   81, 79, 76, 74, 76, null, 72, null,
        74, 76, 74, 72, 69, 72, 74, 76,   72, null, 67, null, 72, null, null, null
    ];
    const BASS_ROOTS = [48, 45, 41, 43];   // C, A, F, G

    const Audio = {
        ctx: null,
        muted: false,
        music: null,

        init() {
            try { this.muted = localStorage.getItem('suki.muted') === '1'; } catch (e) { /* bỏ qua */ }
            const unlock = () => this.unlock();
            ['pointerdown', 'keydown', 'touchend'].forEach(t => window.addEventListener(t, unlock, { capture: true }));
        },

        unlock() {
            if (!this.ctx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                this.ctx = new Ctx();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted ? 0 : 1;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        },

        setMuted(m) {
            this.muted = m;
            try { localStorage.setItem('suki.muted', m ? '1' : '0'); } catch (e) { /* bỏ qua */ }
            if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
        },

        get ready() { return this.ctx && this.ctx.state === 'running'; },

        // Một nốt có bao âm (attack ngắn, tắt dần), có thể trượt cao độ
        _tone(freq, t, dur, { type = 'sine', vol = 0.2, slide = null, vibrato = 0 } = {}) {
            const c = this.ctx;
            const o = c.createOscillator(), g = c.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
            if (vibrato) {
                const lfo = c.createOscillator(), lg = c.createGain();
                lfo.frequency.value = 9;
                lg.gain.value = vibrato;
                lfo.connect(lg).connect(o.frequency);
                lfo.start(t);
                lfo.stop(t + dur + 0.05);
            }
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(this.master);
            o.start(t);
            o.stop(t + dur + 0.05);
        },

        _notes(list, step, opts) {
            const t0 = this.ctx.currentTime + 0.01;
            list.forEach((n, i) => { if (n) this._tone(midi(n), t0 + i * step, step * 1.6, opts); });
        },

        play(name, level) {
            if (!this.ready) return;
            const t = this.ctx.currentTime + 0.005;
            switch (name) {
                case 'count': this._tone(660, t, 0.18, { type: 'triangle', vol: 0.22 }); break;
                case 'go':    this._notes([72, 76, 79, 84], 0.07, { type: 'triangle', vol: 0.22 }); break;
                case 'drop':  this._tone(700, t, 0.35, { type: 'triangle', vol: 0.07, slide: 320 }); break;
                case 'close': this._tone(240, t, 0.09, { type: 'square', vol: 0.06, slide: 150 }); break;
                case 'catch': this._notes([84, 88], 0.09, { vol: 0.25 }); break;
                case 'rare':  this._notes([84, 88, 91, 96], 0.07, { vol: 0.22 }); break;
                case 'photo': this._notes([72, 76, 79, 84, null, 79, 84, 88, 91, 96], 0.08, { type: 'triangle', vol: 0.22 }); break;
                case 'clock': this._notes([96, null, 91, null, 96], 0.06, { vol: 0.18 }); break;
                case 'gift':  this._tone(500, t, 0.4, { type: 'triangle', vol: 0.16, slide: 1600 }); break;
                case 'bad':   this._tone(520, t, 0.45, { type: 'triangle', vol: 0.25, slide: 180, vibrato: 30 }); break;
                case 'slip':  this._tone(440, t, 0.4, { vol: 0.2, slide: 140, vibrato: 18 }); break;
                case 'empty': this._notes([64, 60], 0.14, { type: 'triangle', vol: 0.14 }); break;
                case 'tick':  this._tone(1500, t, 0.04, { type: 'square', vol: 0.05 }); break;
                case 'combo': {
                    // combo càng cao nốt càng cao
                    const base = 72 + Math.min(12, (level || 2) * 2);
                    this._notes([base, base + 4, base + 7, base + 12], 0.055, { type: 'square', vol: 0.08 });
                    break;
                }
                case 'end':   this._notes([79, 76, 72, 76, 79, 84], 0.12, { type: 'triangle', vol: 0.2 }); break;
            }
        },

        // ---------- Nhạc nền ----------
        startMusic() {
            if (!this.ctx || this.music) return;
            this.music = { step: 0, next: this.ctx.currentTime + 0.1, fast: false };
            this.music.timer = setInterval(() => this._schedule(), 60);
        },

        stopMusic() {
            if (!this.music) return;
            clearInterval(this.music.timer);
            this.music = null;
        },

        setFast(fast) { if (this.music) this.music.fast = fast; },

        _schedule() {
            const m = this.music;
            if (!m || !this.ready) return;
            // Tab bị ẩn lâu → bỏ qua đoạn đã lỡ thay vì phát dồn
            if (m.next < this.ctx.currentTime - 0.2) m.next = this.ctx.currentTime + 0.05;
            while (m.next < this.ctx.currentTime + 0.25) {
                const eighth = 60 / (m.fast ? 150 : 116) / 2;
                const i = m.step % MELODY.length;
                const note = MELODY[i];
                if (note) this._tone(midi(note), m.next, eighth * 1.8, { type: 'triangle', vol: 0.055 });
                if (i % 4 === 0) {
                    const root = BASS_ROOTS[Math.floor(i / 16)];
                    const off = [0, 7, 12, 7][(i / 4) % 4];
                    this._tone(midi(root + off), m.next, eighth * 3, { vol: 0.07 });
                }
                m.next += eighth;
                m.step++;
            }
        }
    };

    Suki.Audio = Audio;
})();
