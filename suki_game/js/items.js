// Danh sách vật phẩm trong máy gắp.
// kind: toy (thú thường) | rare (thú hiếm) | clock (+giây) | gift (quà bí ẩn) | bad (trừ điểm) | photo (ảnh Suki)
Suki.ITEMS = [
    { id: 'bear',    kind: 'toy',   emoji: '🧸', name: 'Gấu bông', points: 10, color: '#FFD8B8', r: 38, weight: 1 },
    { id: 'bunny',   kind: 'toy',   emoji: '🐰', name: 'Thỏ', points: 10, color: '#FFD1DC', r: 36, weight: 1 },
    { id: 'cat',     kind: 'toy',   emoji: '🐱', name: 'Mèo', points: 10, color: '#FFF4C2', r: 36, weight: 1 },
    { id: 'dog',     kind: 'toy',   emoji: '🐶', name: 'Cún', points: 10, color: '#CDE7FF', r: 36, weight: 1 },
    { id: 'panda',   kind: 'toy',   emoji: '🐼', name: 'Gấu trúc', points: 10, color: '#E0D4FF', r: 38, weight: 1 },
    { id: 'chick',   kind: 'toy',   emoji: '🐥', name: 'Gà con', points: 10, color: '#C1F0DC', r: 32, weight: 1 },
    { id: 'frog',    kind: 'toy',   emoji: '🐸', name: 'Ếch', points: 10, color: '#D9F5CB', r: 34, weight: 1 },

    { id: 'unicorn', kind: 'rare',  emoji: '🦄', name: 'Kỳ lân', points: 25, color: '#F9D5F5', r: 38, weight: 0.45 },
    { id: 'rainbow', kind: 'rare',  emoji: '🌈', name: 'Cầu vồng', points: 25, color: '#FFF1D6', r: 38, weight: 0.3 },

    { id: 'clock',   kind: 'clock', emoji: '⏰', name: 'Đồng hồ', points: 0, seconds: 5, color: '#CDE7FF', r: 32, weight: 0.35 },
    { id: 'gift',    kind: 'gift',  emoji: '🎁', name: 'Hộp quà', points: 0, color: '#FFE3F1', r: 34, weight: 0.35 },

    // Vật phẩm phạt: nền xám để bé dễ nhận ra và né
    { id: 'shoe',    kind: 'bad',   emoji: '👟', name: 'Giày cũ', points: -5,  effect: 'shake', color: '#DAD5DE', r: 34, weight: 0.55 },
    { id: 'bug',     kind: 'bad',   emoji: '🐛', name: 'Sâu', points: -10, effect: 'slow',  color: '#DAD5DE', r: 32, weight: 0.4 }
];

// Thú bông ảnh Suki: không rơi ngẫu nhiên mà được thả có chủ đích (1–2 con/ván).
// Nếu chưa có ảnh thì dùng ngôi sao làm hình mặc định.
// heavy: nặng hơn, dễ chìm xuống đáy và khó gắp hơn (thông số trong config.js).
Suki.PHOTO_ITEM = { id: 'photo', kind: 'photo', emoji: '🌟', chip: '📸', name: 'Suki', points: 50, color: '#FFF4C2', r: 42, heavy: true };

// Kết quả hộp quà bí ẩn
Suki.GIFTS = [
    { id: 'double', text: 'Điểm ×2!',        seconds: 10 },
    { id: 'grip',   text: 'Càng siêu chắc!', seconds: 12 },
    { id: 'bonus',  text: '+20 điểm!',       points: 20 }
];

Suki.pickItem = function () {
    const total = Suki.ITEMS.reduce((s, it) => s + it.weight, 0);
    let r = Math.random() * total;
    for (const it of Suki.ITEMS) {
        r -= it.weight;
        if (r <= 0) return it;
    }
    return Suki.ITEMS[0];
};

// Những vật phẩm được ghi vào album sưu tập
Suki.COLLECTIBLES = Suki.ITEMS.filter(it => it.kind === 'toy' || it.kind === 'rare').concat([Suki.PHOTO_ITEM]);
