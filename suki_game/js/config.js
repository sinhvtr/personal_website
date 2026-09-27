// Các thông số chỉnh độ khó — đổi ở đây sau khi cho Suki chơi thử.
window.Suki = window.Suki || {};

Suki.CFG = {
    // Kích thước logic của máy gắp (canvas tự co giãn theo màn hình)
    W: 900,
    H: 720,

    // Bố cục trong máy
    wallL: 20,          // mép trái ô thả
    wallR: 880,         // vách phải
    chuteR: 170,        // vách ngăn giữa ô thả và hố thú bông
    chuteTop: 440,      // đỉnh vách ngăn
    wallT: 16,          // độ dày vách ngăn
    floorY: 690,        // mặt sàn
    railY: 46,          // thanh ray phía trên
    clawRestY: 100,     // độ cao càng khi nghỉ

    // Tốc độ càng (px/giây)
    clawMove: 400,
    clawDown: 420,
    clawUp: 330,
    clawCarry: 360,
    clawReturn: 520,
    closeTime: 0.35,    // giây
    openTime: 0.3,

    // Độ chắc tay của càng
    grabRangeX: 44,     // lệch tâm tối đa vẫn gắp được
    baseHold: 0.9,      // xác suất giữ được khi gắp đúng tâm
    holdPenalty: 0.3,   // bị trừ khi gắp lệch hết cỡ

    // Thú bông ảnh Suki: nặng, dễ chìm xuống đáy và khó gắp hơn thú thường
    photoDensity: 0.005,  // thú thường là 0.0015
    photoSink: 1.2,       // lực kéo xuống thêm (1 = gấp đôi trọng lực)
    photoHold: 0.65,      // nhân vào xác suất giữ được
    photoLift: 0.6,       // tốc độ kéo lên / mang về khi đang giữ

    // Combo: gắp trúng liên tiếp, lần thứ n được thưởng thêm comboStep × (n − 1)
    comboStep: 5,

    // Ván chơi
    roundTime: 60,
    hurryTime: 10,
    graceMax: 5,        // thời gian tối đa chờ lần gắp cuối sau khi hết giờ
    startToys: 26,
    minToys: 18,
    spawnEvery: 0.7,

    stars: [50, 120, 200]
};
