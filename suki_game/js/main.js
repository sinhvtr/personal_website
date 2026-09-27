// Khởi tạo và chuyển màn hình: menu → chơi → kết thúc, và màn hình ảnh của Suki.
(function () {
    const $ = id => document.getElementById(id);

    if (!window.Matter) {
        $('boot-error').hidden = false;
        return;
    }

    const C = Suki.CFG;
    const Audio = Suki.Audio;
    const Photos = Suki.Photos;
    const input = new Suki.Input();
    const canvasWrap = $('canvas-wrap');
    const game = new Suki.Game($('game-canvas'), input, { onHud, onEnd, onCatch, onBad });
    const cropper = new Photos.Cropper($('crop-canvas'), $('crop-zoom'));

    let screen = 'menu';
    let starting = false;
    let endLockUntil = 0;
    let hud = {};

    Audio.init();

    // ---------- Màn hình ----------
    function show(name) {
        screen = name;
        document.querySelectorAll('.screen').forEach(s =>
            s.classList.toggle('active', s.id === 'screen-' + name));
    }

    function fitCanvas() {
        game.resize(canvasWrap.clientWidth, canvasWrap.clientHeight);
    }

    async function startGame() {
        if (starting) return;
        starting = true;
        Audio.unlock();
        game.stop();
        $('pause-overlay').hidden = true;
        const photos = await Photos.loadImages();
        hud = { score: -1, time: -1, hurry: null, effects: '' };
        show('game');
        fitCanvas();
        game.start(photos);
        starting = false;
    }

    function goMenu() {
        game.stop();
        $('pause-overlay').hidden = true;
        $('menu-best').textContent = Suki.Storage.getBest();
        show('menu');
    }

    function setPaused(p) {
        game.setPaused(p);
        $('pause-overlay').hidden = !p;
        input.releaseAll();
    }

    // ---------- Hook từ game ----------
    function onHud(score, time, hurry, effects, combo) {
        if (score !== hud.score) {
            $('score').textContent = score;
            if (hud.score >= 0) bump($('score').parentElement);
            hud.score = score;
        }
        if (time !== hud.time) {
            $('time').textContent = time;
            if (hud.time >= 0 && time > hud.time) bump($('hud-time'));
            hud.time = time;
        }
        if (hurry !== hud.hurry) {
            $('hud-time').classList.toggle('hurry', hurry);
            hud.hurry = hurry;
        }
        renderEffects(effects, combo);
    }

    // Huy hiệu hiệu ứng đang chạy: 🔥×3, ×2 8s, 💪 10s, 🐌 3s
    function renderEffects(effects, combo) {
        const list = [];
        if (combo >= 2) list.push(['🔥', 0, 'combo', `🔥×${combo}`]);
        if (effects.double > 0) list.push(['×2', effects.double, '']);
        if (effects.grip > 0) list.push(['💪', effects.grip, '']);
        if (effects.slow > 0) list.push(['🐌', effects.slow, 'bad']);
        const key = list.map(([l, s, , t]) => (t || l) + Math.ceil(s)).join('|');
        if (key === hud.effects) return;
        hud.effects = key;
        const box = $('hud-effects');
        const prev = new Set([...box.children].map(el => el.dataset.label));
        box.innerHTML = '';
        for (const [label, sec, cls, text] of list) {
            const el = document.createElement('span');
            el.className = 'effect ' + cls;
            el.dataset.label = label;
            if (prev.has(label) && label !== '🔥') el.style.animation = 'none';
            el.textContent = text || `${label} ${Math.ceil(sec)}s`;
            box.appendChild(el);
        }
    }

    function onCatch(item, big) {
        input.rumble(big ? 400 : 150);
    }

    function onBad() {
        input.rumble(300);
    }

    function onEnd({ score, caught, bestCombo }) {
        const best = Suki.Storage.getBest();
        const isRecord = score > best && score > 0;
        if (isRecord) Suki.Storage.setBest(score);
        if (bestCombo > Suki.Storage.getBestCombo()) Suki.Storage.setBestCombo(bestCombo);

        $('end-combo').hidden = bestCombo < 2;
        $('end-combo').textContent = `🔥 Combo cao nhất: ×${bestCombo}`;

        // Thú bông lần đầu có trong album
        const fresh = Suki.Storage.addToAlbum(caught);
        const newBox = $('end-new');
        newBox.hidden = fresh.length === 0;
        newBox.textContent = '🆕 Thú mới trong album: ' +
            fresh.map(id => Suki.COLLECTIBLES.find(it => it.id === id)).map(it => it.chip || it.emoji).join(' ');

        const stars = C.stars.filter(t => score >= t).length;
        const titles = ['Cố lên lần sau nhé!', 'Giỏi lắm Suki!', 'Giỏi quá Suki ơi!', 'Tuyệt vời Suki ơi!'];
        $('end-title').textContent = titles[stars];
        $('end-score').textContent = score;
        $('end-best').textContent = Math.max(best, score);
        $('end-record').hidden = !isRecord;

        const starEls = $('end-stars').children;
        for (let i = 0; i < starEls.length; i++) {
            starEls[i].classList.remove('on');
            if (i < stars) setTimeout(() => starEls[i].classList.add('on'), 300 + i * 350);
        }

        // Gom vật phẩm đã gắp: 📸×1 🧸×3 🐰×2
        const counts = new Map();
        for (const it of caught) {
            const label = it.chip || it.emoji;
            counts.set(label, (counts.get(label) || 0) + 1);
        }
        const box = $('end-caught');
        box.innerHTML = '';
        for (const [label, n] of counts) {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = `${label}×${n}`;
            box.appendChild(chip);
        }

        endLockUntil = performance.now() + 1200;   // tránh bấm nhầm chơi lại ngay
        show('end');
    }

    function bump(el) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
    }

    let toastTimer = null;
    function toast(text) {
        const el = $('toast');
        el.textContent = text;
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
    }

    // ---------- Âm thanh ----------
    function renderMute() {
        document.querySelectorAll('.mute-btn').forEach(b => { b.textContent = Audio.muted ? '🔇' : '🔊'; });
    }
    document.querySelectorAll('.mute-btn').forEach(b => b.addEventListener('click', () => {
        Audio.unlock();
        Audio.setMuted(!Audio.muted);
        renderMute();
    }));

    // ---------- Ảnh của Suki ----------
    let tileUrls = [];

    function photoError(msg) {
        $('photo-error').textContent = msg || '';
        $('photo-error').hidden = !msg;
    }

    async function renderPhotos() {
        tileUrls.forEach(u => URL.revokeObjectURL(u));
        tileUrls = [];
        const rows = await Photos.list();
        const grid = $('photo-grid');
        grid.innerHTML = '';
        for (const row of rows) {
            const url = URL.createObjectURL(row.blob);
            tileUrls.push(url);
            const tile = document.createElement('div');
            tile.className = 'photo-tile';
            tile.style.backgroundImage = `url("${url}")`;
            const del = document.createElement('button');
            del.className = 'del';
            del.setAttribute('aria-label', 'Xoá ảnh');
            del.textContent = '✕';
            del.addEventListener('click', async () => {
                if (!confirm('Xoá ảnh này?')) return;
                await Photos.remove(row.id);
                renderPhotos();
            });
            tile.appendChild(del);
            grid.appendChild(tile);
        }
        if (rows.length < Photos.MAX) {
            const add = document.createElement('button');
            add.className = 'photo-add';
            add.innerHTML = '+<small>Thêm ảnh</small>';
            add.addEventListener('click', () => $('photo-input').click());
            grid.appendChild(add);
        }
    }

    async function openPhotos() {
        photoError('');
        show('photos');
        try {
            await renderPhotos();
        } catch (e) {
            photoError('Trình duyệt này không lưu được ảnh (có thể đang ở chế độ ẩn danh).');
        }
    }

    $('photo-input').addEventListener('change', async e => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';   // cho phép chọn lại cùng một ảnh
        if (!file) return;
        photoError('');
        try {
            const img = await Photos.fileToImage(file);
            $('crop-overlay').hidden = false;
            cropper.load(img);
        } catch (err) {
            photoError('Không mở được ảnh này, thử ảnh khác nhé.');
        }
    });

    $('btn-crop-cancel').addEventListener('click', () => { $('crop-overlay').hidden = true; });
    $('btn-crop-save').addEventListener('click', async () => {
        try {
            const blob = await cropper.export();
            await Photos.add(blob);
            $('crop-overlay').hidden = true;
            await renderPhotos();
        } catch (err) {
            $('crop-overlay').hidden = true;
            photoError('Không lưu được ảnh trên trình duyệt này (có thể đang ở chế độ ẩn danh).');
        }
    });

    // ---------- Album sưu tập ----------
    async function openAlbum() {
        const album = Suki.Storage.getAlbum();
        const photos = await Photos.loadImages();
        const grid = $('album-grid');
        grid.innerHTML = '';
        let owned = 0;
        for (const it of Suki.COLLECTIBLES) {
            const n = album[it.id] || 0;
            if (n) owned++;
            const card = document.createElement('div');
            card.className = `album-item ${it.kind}` + (n ? '' : ' locked');
            card.style.setProperty('--item-bg', it.color);
            const pic = document.createElement('div');
            pic.className = 'pic';
            if (it.kind === 'photo' && photos.length) pic.style.backgroundImage = `url("${photos[0].img.src}")`;
            else pic.textContent = it.emoji;
            const name = document.createElement('div');
            name.className = 'name';
            name.textContent = n ? it.name : '???';
            const count = document.createElement('div');
            count.className = 'count';
            count.textContent = n ? `Đã gắp ×${n}` : 'Chưa có';
            card.append(pic, name, count);
            grid.appendChild(card);
        }
        const total = Suki.COLLECTIBLES.length;
        $('album-progress').innerHTML =
            `Đã sưu tập <b>${owned}/${total}</b> loại thú bông` +
            `<div class="progress"><div style="width:${Math.round(owned / total * 100)}%"></div></div>`;
        const bestCombo = Suki.Storage.getBestCombo();
        $('album-combo').textContent = bestCombo >= 2 ? `🔥 Combo cao nhất từ trước tới giờ: ×${bestCombo}` : '';
        show('album');
    }

    // ---------- Điều khiển ----------
    input.on('grab', () => {
        Audio.unlock();
        if (screen === 'menu') startGame();
        else if (screen === 'end') { if (performance.now() > endLockUntil) startGame(); }
        else if (screen === 'game') {
            if (game.paused) setPaused(false);
            else game.requestGrab();
        }
    });
    input.on('pause', () => {
        if (screen === 'game' && game.isActive()) setPaused(!game.paused);
        else if (screen === 'album' || (screen === 'photos' && $('crop-overlay').hidden)) goMenu();
    });
    input.on('padconnected', () => toast('🎮 Đã kết nối tay cầm!'));

    document.querySelectorAll('[data-hold]').forEach(el => input.bindHold(el, el.dataset.hold));
    input.bindPress($('btn-grab'), 'grab');

    $('btn-play').addEventListener('click', startGame);
    $('btn-photos').addEventListener('click', openPhotos);
    $('btn-photos-back').addEventListener('click', goMenu);
    $('btn-album').addEventListener('click', openAlbum);
    $('btn-album-back').addEventListener('click', goMenu);
    $('btn-pause').addEventListener('click', () => { if (game.isActive()) setPaused(true); });
    $('btn-resume').addEventListener('click', () => setPaused(false));
    $('btn-restart').addEventListener('click', startGame);
    $('btn-home').addEventListener('click', goMenu);
    $('btn-again').addEventListener('click', startGame);
    $('btn-menu').addEventListener('click', goMenu);

    // Tự tạm dừng khi chuyển ứng dụng / tắt màn hình
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && screen === 'game' && game.isActive()) setPaused(true);
    });

    new ResizeObserver(fitCanvas).observe(canvasWrap);

    // ---------- Vòng lặp chính ----------
    function frame(now) {
        input.poll();
        if (screen === 'game') game.frame(now);
        requestAnimationFrame(frame);
    }

    renderMute();
    $('menu-best').textContent = Suki.Storage.getBest();
    // Đợi font tải xong để chữ vẽ trên canvas đúng kiểu
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(frame));
})();
