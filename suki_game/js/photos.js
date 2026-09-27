// Ảnh của Suki: chọn ảnh → chỉnh khung tròn → lưu vào IndexedDB trên chính thiết bị này.
// Ảnh KHÔNG bao giờ được gửi đi đâu (không có fetch/upload nào trong file này).
(function () {
    const DB_NAME = 'suki-game';
    const STORE = 'photos';
    const OUT_SIZE = 256;
    const MAX_PHOTOS = 6;

    let dbPromise = null;
    let imageCache = null;   // [{ id, img }]

    function openDb() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) { reject(new Error('no-indexeddb')); return; }
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            dbPromise.catch(() => { dbPromise = null; });
        }
        return dbPromise;
    }

    async function tx(mode, fn) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const t = db.transaction(STORE, mode);
            const result = fn(t.objectStore(STORE));
            t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error);
        });
    }

    function blobToImage(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => resolve(img);   // giữ object URL: ảnh còn được vẽ lại nhiều lần
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad-image')); };
            img.src = url;
        });
    }

    const Photos = {
        MAX: MAX_PHOTOS,

        async list() {
            try {
                return await tx('readonly', s => s.getAll()) || [];
            } catch (e) {
                return [];
            }
        },

        async add(blob) {
            await tx('readwrite', s => s.add({ blob, created: Date.now() }));
            imageCache = null;
        },

        async remove(id) {
            await tx('readwrite', s => s.delete(id));
            imageCache = null;
        },

        // Ảnh đã lưu dưới dạng <img> để vẽ lên canvas trong game
        async loadImages() {
            if (imageCache) return imageCache;
            const rows = await this.list();
            const out = [];
            for (const row of rows) {
                try { out.push({ id: row.id, img: await blobToImage(row.blob) }); } catch (e) { /* bỏ qua ảnh hỏng */ }
            }
            imageCache = out;
            return out;
        },

        // Đọc file người dùng chọn. Vẽ <img> lên canvas sẽ tự xoay đúng chiều theo EXIF.
        fileToImage(file) { return blobToImage(file); },

        // Cắt ảnh theo khung đang chỉnh, xuất JPEG 256×256.
        // Vẽ lại qua canvas nên toàn bộ metadata EXIF/GPS bị loại bỏ.
        render(img, view, viewSize) {
            const c = document.createElement('canvas');
            c.width = c.height = OUT_SIZE;
            const g = c.getContext('2d');
            const k = OUT_SIZE / viewSize;
            g.fillStyle = '#fff';
            g.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
            g.imageSmoothingQuality = 'high';
            g.drawImage(img,
                (viewSize / 2 + view.ox - img.naturalWidth * view.scale / 2) * k,
                (viewSize / 2 + view.oy - img.naturalHeight * view.scale / 2) * k,
                img.naturalWidth * view.scale * k,
                img.naturalHeight * view.scale * k);
            return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.88));
        }
    };

    // ---------- Khung chỉnh ảnh (kéo để di chuyển, thanh trượt để phóng to) ----------
    class Cropper {
        constructor(canvas, zoomInput) {
            this.canvas = canvas;
            this.g = canvas.getContext('2d');
            this.zoomInput = zoomInput;
            this.size = canvas.width;
            this.img = null;
            this.view = { scale: 1, ox: 0, oy: 0 };

            let drag = null;
            canvas.addEventListener('pointerdown', e => {
                e.preventDefault();
                try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
                drag = { x: e.clientX, y: e.clientY, ox: this.view.ox, oy: this.view.oy };
            });
            canvas.addEventListener('pointermove', e => {
                if (!drag || !this.img) return;
                const k = this.size / canvas.getBoundingClientRect().width;
                this.view.ox = drag.ox + (e.clientX - drag.x) * k;
                this.view.oy = drag.oy + (e.clientY - drag.y) * k;
                this._clamp();
                this.draw();
            });
            ['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, () => { drag = null; }));
            zoomInput.addEventListener('input', () => this._setZoom(parseFloat(zoomInput.value)));
            canvas.addEventListener('wheel', e => {
                e.preventDefault();
                const z = Math.min(3, Math.max(1, parseFloat(zoomInput.value) - e.deltaY * 0.002));
                zoomInput.value = z;
                this._setZoom(z);
            }, { passive: false });
        }

        load(img) {
            this.img = img;
            this.base = this.size / Math.min(img.naturalWidth, img.naturalHeight);
            this.zoomInput.value = 1;
            this.view = { scale: this.base, ox: 0, oy: 0 };
            this.draw();
        }

        _setZoom(z) {
            if (!this.img) return;
            this.view.scale = this.base * z;
            this._clamp();
            this.draw();
        }

        // Không cho kéo ảnh lộ khoảng trống trong khung
        _clamp() {
            const w = this.img.naturalWidth * this.view.scale, h = this.img.naturalHeight * this.view.scale;
            const mx = Math.max(0, (w - this.size) / 2), my = Math.max(0, (h - this.size) / 2);
            this.view.ox = Math.max(-mx, Math.min(mx, this.view.ox));
            this.view.oy = Math.max(-my, Math.min(my, this.view.oy));
        }

        draw() {
            const g = this.g, s = this.size, v = this.view, img = this.img;
            g.clearRect(0, 0, s, s);
            if (!img) return;
            const w = img.naturalWidth * v.scale, h = img.naturalHeight * v.scale;
            g.drawImage(img, s / 2 + v.ox - w / 2, s / 2 + v.oy - h / 2, w, h);
            // làm mờ phần ngoài vòng tròn
            g.fillStyle = 'rgba(255, 244, 250, .7)';
            g.beginPath();
            g.rect(0, 0, s, s);
            g.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2, true);
            g.fill();
            g.lineWidth = 6;
            g.strokeStyle = '#FFB6C8';
            g.beginPath();
            g.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
            g.stroke();
        }

        export() { return Photos.render(this.img, this.view, this.size); }
    }

    Photos.Cropper = Cropper;
    Suki.Photos = Photos;
})();
