// Lưu kỷ lục và album trên trình duyệt. Mọi truy cập đều bọc try/catch vì Safari ẩn danh có thể chặn localStorage.
Suki.Storage = {
    getBest() {
        try { return parseInt(localStorage.getItem('suki.best'), 10) || 0; } catch (e) { return 0; }
    },
    setBest(v) {
        try { localStorage.setItem('suki.best', String(v)); } catch (e) { /* bỏ qua */ }
    },

    getBestCombo() {
        try { return parseInt(localStorage.getItem('suki.bestCombo'), 10) || 0; } catch (e) { return 0; }
    },
    setBestCombo(v) {
        try { localStorage.setItem('suki.bestCombo', String(v)); } catch (e) { /* bỏ qua */ }
    },

    // Album: { itemId: số lần đã gắp được }
    getAlbum() {
        try { return JSON.parse(localStorage.getItem('suki.album')) || {}; } catch (e) { return {}; }
    },

    // Ghi các vật phẩm vừa gắp vào album, trả về danh sách id lần đầu có được
    addToAlbum(items) {
        const album = this.getAlbum();
        const collectible = new Set(Suki.COLLECTIBLES.map(it => it.id));
        const fresh = [];
        for (const it of items) {
            if (!collectible.has(it.id)) continue;
            if (!album[it.id] && !fresh.includes(it.id)) fresh.push(it.id);
            album[it.id] = (album[it.id] || 0) + 1;
        }
        try { localStorage.setItem('suki.album', JSON.stringify(album)); } catch (e) { /* bỏ qua */ }
        return fresh;
    }
};
