// Gộp cảm ứng + bàn phím + tay cầm PS4 thành một lớp điều khiển chung.
// - dir: hướng di chuyển liên tục (-1..1)
// - targetX: vị trí càng cần tới khi chạm/kéo trên màn hình
// - sự kiện 'grab', 'pause', 'padconnected'
(function () {
    const KEY_DIR = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    const GRAB_KEYS = ['Space', 'Enter', 'NumpadEnter', 'ArrowDown', 'KeyS'];
    const PAUSE_KEYS = ['Escape', 'KeyP'];
    const DEADZONE = 0.25;

    // Gamepad API standard mapping (tay cầm PS4)
    const BTN_CROSS = 0, BTN_OPTIONS = 9, BTN_LEFT = 14, BTN_RIGHT = 15;

    class Input {
        constructor() {
            this.keys = { left: false, right: false };
            this.touch = { left: false, right: false };
            this.pad = { left: false, right: false, x: 0 };
            this.targetX = null;
            this.handlers = {};
            this.prevButtons = [];
            this.padIndex = null;

            window.addEventListener('keydown', e => this._key(e, true));
            window.addEventListener('keyup', e => this._key(e, false));
            window.addEventListener('blur', () => this.releaseAll());
            window.addEventListener('gamepadconnected', e => {
                if (this.padIndex === null) {
                    this.padIndex = e.gamepad.index;
                    this.emit('padconnected', e.gamepad);
                }
            });
            window.addEventListener('gamepaddisconnected', e => {
                if (this.padIndex === e.gamepad.index) this.padIndex = null;
            });
        }

        on(name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); }
        emit(name, arg) { (this.handlers[name] || []).forEach(fn => fn(arg)); }

        _key(e, down) {
            const code = e.code;
            if (KEY_DIR[code]) {
                this.keys[KEY_DIR[code]] = down;
                e.preventDefault();
            } else if (GRAB_KEYS.includes(code)) {
                // chặn cả keyup để Space/Enter không "bấm" nhầm nút đang được focus
                e.preventDefault();
                if (down && !e.repeat) this.emit('grab');
            } else if (PAUSE_KEYS.includes(code)) {
                e.preventDefault();
                if (down && !e.repeat) this.emit('pause');
            }
        }

        releaseAll() {
            this.keys.left = this.keys.right = false;
            this.touch.left = this.touch.right = false;
        }

        // Nút giữ để di chuyển (◀ ▶ trên màn hình)
        bindHold(el, dir) {
            const set = v => {
                this.touch[dir] = v;
                el.classList.toggle('pressed', v);
            };
            el.addEventListener('pointerdown', e => {
                e.preventDefault();
                try { el.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
                set(true);
            });
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t =>
                el.addEventListener(t, () => set(false)));
            el.addEventListener('contextmenu', e => e.preventDefault());
        }

        // Nút bấm một lần (GẮP)
        bindPress(el, action) {
            el.addEventListener('pointerdown', e => {
                e.preventDefault();
                el.classList.add('pressed');
                this.emit(action);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
                el.addEventListener(t, () => el.classList.remove('pressed')));
            el.addEventListener('contextmenu', e => e.preventDefault());
        }

        get dir() {
            let d = 0;
            if (this.keys.left || this.touch.left || this.pad.left) d -= 1;
            if (this.keys.right || this.touch.right || this.pad.right) d += 1;
            if (d === 0 && Math.abs(this.pad.x) > DEADZONE) {
                d = Math.sign(this.pad.x) * (Math.abs(this.pad.x) - DEADZONE) / (1 - DEADZONE);
            }
            return d;
        }

        _gamepad() {
            if (!navigator.getGamepads) return null;
            const pads = navigator.getGamepads();
            if (this.padIndex !== null && pads[this.padIndex]) return pads[this.padIndex];
            for (const p of pads) {
                if (p) {
                    // Safari đôi khi không bắn gamepadconnected
                    this.padIndex = p.index;
                    this.emit('padconnected', p);
                    return p;
                }
            }
            return null;
        }

        // Gọi mỗi khung hình
        poll() {
            const gp = this._gamepad();
            if (!gp) {
                this.pad.left = this.pad.right = false;
                this.pad.x = 0;
                return;
            }
            const pressed = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
            this.pad.left = pressed(BTN_LEFT);
            this.pad.right = pressed(BTN_RIGHT);
            this.pad.x = gp.axes[0] || 0;

            const edge = i => pressed(i) && !this.prevButtons[i];
            if (edge(BTN_CROSS)) this.emit('grab');
            if (edge(BTN_OPTIONS)) this.emit('pause');
            this.prevButtons = gp.buttons.map(b => b.pressed);
        }

        rumble(ms) {
            const gp = this._gamepad();
            const act = gp && gp.vibrationActuator;
            if (act && act.playEffect) {
                act.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.5, weakMagnitude: 0.6 })
                    .catch(() => {});
            }
        }
    }

    Suki.Input = Input;
})();
