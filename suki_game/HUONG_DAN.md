# Suki Gắp Thú — Tài liệu thiết kế & hướng dẫn

> File này ghi lại các quyết định đã chốt với phụ huynh. Mọi thay đổi code trong `suki_game/` phải tuân theo tài liệu này; khi có yêu cầu mới thì cập nhật lại file này trước.

---

## 1. Thông tin đã chốt

| Mục | Quyết định |
|---|---|
| Người chơi | **Suki**, 7 tuổi, học lớp 2 (đọc được chữ tiếng Việt đơn giản) |
| Thời lượng | **1 phút / ván** (đồng hồ đếm ngược 60 giây) |
| Thiết bị chính | **iPad** (cảm ứng, Safari) |
| Thiết bị phụ | PC với **tay cầm PS4** hoặc **bàn phím** |
| Nơi chạy | Online, là đường dẫn phụ của web cá nhân: `/suki_game/` |
| Phong cách | **Pastel dễ thương** |
| Ảnh của Suki | **Upload ngay trong game**, chỉ lưu trên trình duyệt của thiết bị, **không bao giờ đưa lên repo hay server** |

---

## 2. Quy tắc quyền riêng tư (bắt buộc)

- **Không commit bất kỳ ảnh thật nào của Suki** vào repo. Repo có thể public nên thư mục `suki_game/` chỉ chứa code và tài nguyên chung (icon, âm thanh, hình thú bông).
- Ảnh được chọn bằng `<input type="file" accept="image/*">`. Trên iPad có thể chụp trực tiếp hoặc chọn từ thư viện ảnh.
- Ảnh được xử lý hoàn toàn trên thiết bị:
  - Đọc bằng `createImageBitmap` (tự xoay đúng theo EXIF).
  - Cắt vuông ở giữa, resize về **256×256**, rồi vẽ lại lên canvas. Bước này cũng loại bỏ metadata EXIF/GPS.
  - Lưu dạng Blob vào **IndexedDB**. Không dùng localStorage cho ảnh.
- Không có bất kỳ `fetch`/upload nào gửi ảnh ra ngoài.
- Có nút **"Xoá ảnh"** trong màn hình cài đặt ảnh.
- Trang game có `<meta name="robots" content="noindex, nofollow">` và **không link từ trang chủ**.
- Nếu chưa có ảnh thì game vẫn chơi bình thường, dùng hình thú bông mặc định.

---

## 3. Gameplay

### Vòng chơi
1. **Màn hình chính:** logo "Suki Gắp Thú", nút **Chơi**, nút **Ảnh của Suki**, nút **Album**, và điểm cao nhất.
2. **Ván chơi 60 giây:** di chuyển càng gắp ngang → nhấn **Gắp** → càng hạ xuống, khép lại, kéo lên → mang vật phẩm về ô thả ở góc trái thì mới được tính điểm.
   - Mỗi lần gắp mất khoảng 4–5 giây, nên một ván được khoảng 10–14 lần gắp.
   - 10 giây cuối: đồng hồ nhấp nháy, nhạc nhanh hơn.
3. **Màn kết thúc:** tổng điểm, **1–3 ngôi sao**, kỷ lục mới (nếu có), danh sách vật phẩm vừa gắp được, và nút **Chơi lại**.

### Vật phẩm, điểm thưởng và điểm phạt

| Vật phẩm | Tần suất | Hiệu ứng |
|---|---|---|
| 🧸 Thú bông thường (gấu, thỏ, mèo, cún…) | Phổ biến | **+10** |
| 🦄 Thú bông hiếm (kỳ lân, cầu vồng) | Ít | **+25** |
| ⭐ **Thú bông ảnh Suki** (khung tròn lấp lánh) | Hiếm, 1–2 con/ván | **+50**, phóng to ảnh kèm lời khen "Giỏi quá Suki ơi!". **Nặng, dễ chìm xuống đáy, khó gắp hơn** (xem bên dưới) |
| ⏰ Đồng hồ | Ít | **+5 giây** |
| 🎁 Hộp quà bí ẩn | Ít | Ngẫu nhiên: ×2 điểm trong 10 giây / càng chắc tay / +20 |
| 👟 Chiếc giày cũ | Thỉnh thoảng | **−5**, màn hình rung nhẹ, âm thanh "ối" |
| 🐛 Sâu đồ chơi | Thỉnh thoảng | **−10**, càng bị chậm trong 3 giây |

**Nguyên tắc điểm phạt cho trẻ 7 tuổi:**
- Điểm **không bao giờ âm** (thấp nhất là 0).
- Hình phạt có tính hài hước, không đáng sợ: vật phẩm "lè lưỡi" rồi nảy đi.
- Vật phẩm phạt phải nhận ra dễ dàng để bé học được cách né.

### Thú bông ảnh Suki nặng hơn (theo yêu cầu của phụ huynh)
- Mật độ cao gấp khoảng 3 lần, ít ma sát và có thêm lực kéo xuống, nên nó lọt qua khe và **chìm xuống dưới** đống thú. Suki phải gắp các thú phía trên ra trước.
- Khi gắp thì **dễ tuột hơn** (xác suất giữ được nhân 0.65) và càng **kéo lên chậm hơn** (0.6 lần tốc độ).
- Quà "Càng siêu chắc" vẫn giữ chắc 100%, kể cả thú ảnh.
- Tất cả thông số nằm trong nhóm `photo*` ở `config.js`.

### Cơ chế tạo hứng thú
- **Vật lý thật** (Matter.js): thú bông chồng lên nhau, lăn, và có thể tuột khỏi càng.
- **Độ chắc của càng** ngẫu nhiên nhưng rộng rãi: khoảng 75% giữ được. Không làm khó như máy thật.
- **Combo:** gắp trúng thú bông 2 lần liên tiếp thì được +5, 3 lần liên tiếp thì được +10… Combo mất khi gắp trượt, bị tuột, hoặc gắp phải vật phẩm phạt. Điểm thưởng combo không bị nhân ×2.
- **Album sưu tập:** lưu các loại thú bông đã từng gắp được, mỗi loại hiện số lần gắp.
- Kỷ lục điểm và album được lưu bằng `localStorage`.

### Sao đánh giá (tham khảo, chỉnh sau khi chơi thử)
- ⭐ ≥ 50 điểm, ⭐⭐ ≥ 120 điểm, ⭐⭐⭐ ≥ 200 điểm.

---

## 4. Điều khiển

| Hành động | iPad (cảm ứng) | Bàn phím | Tay cầm PS4 |
|---|---|---|---|
| Di chuyển trái/phải | Giữ nút ◀ ▶ trên màn hình **hoặc** kéo càng bằng ngón tay | `←` `→` hoặc `A` `D` | D-pad hoặc cần analog trái |
| Gắp | Nút tròn to **GẮP** | `Space` / `Enter` / `↓` | Nút **✕** (button 0) |
| Tạm dừng | Nút ⏸ góc trên | `Esc` / `P` | Nút **Options** (button 9) |
| Chọn trong menu | Chạm | `Enter` | ✕ |

**Ghi chú kỹ thuật cho điều khiển:**
- Dùng **Gamepad API** (`navigator.getGamepads()`) với standard mapping, đọc trong vòng lặp `requestAnimationFrame`. Hiện thông báo "Đã kết nối tay cầm 🎮" khi có sự kiện `gamepadconnected`.
- Cần analog có vùng chết (deadzone) là 0.25.
- Thêm rung tay cầm (`vibrationActuator`) khi gắp trúng, nếu trình duyệt hỗ trợ.
- iPad:
  - Đặt `touch-action: none` trên vùng chơi, chặn zoom khi chạm đúp và chặn cuộn trang.
  - Nút bấm tối thiểu **64×64 px**, nút GẮP khoảng **110 px**.
  - Không dùng hiệu ứng hover.

---

## 5. Giao diện & phong cách

- **Màu pastel:** hồng `#FFD1DC`, xanh bạc hà `#C1F0DC`, tím oải hương `#E0D4FF`, vàng kem `#FFF4C2`, xanh da trời `#CDE7FF`. Chữ màu nâu tím đậm `#5B4B6B` để dễ đọc.
- **Font:** tròn, dễ đọc, hỗ trợ tiếng Việt, ví dụ **Baloo 2** hoặc **Nunito** (Google Fonts). Chữ trong game tối thiểu 22 px.
- Máy gắp vẽ bằng canvas/SVG: khung bo tròn, kính trong, đèn nhấp nháy.
- Thú bông: ưu tiên SVG tự vẽ hoặc emoji lớn. Ảnh Suki hiển thị trong khung tròn có viền lấp lánh.
- **Hiệu ứng:** pháo giấy khi gắp được, sao bay lên kèm số điểm (+10), màn hình rung nhẹ khi bị trừ điểm.
- **Bố cục:** ưu tiên **iPad nằm ngang**. Khi iPad dựng dọc vẫn chơi được, với nút điều khiển đặt ở dưới. Canvas tự co giãn theo màn hình, có xử lý `devicePixelRatio` để hình sắc nét.
- **Âm thanh:** nhạc nền vui nhẹ, tiếng "ting" khi được điểm, "ối" khi bị trừ, tiếng tích tắc ở 10 giây cuối.
  - Có nút tắt/bật âm thanh.
  - Trên iOS phải mở khóa AudioContext ở lần chạm đầu tiên.
  - Toàn bộ âm thanh và nhạc nền được **tổng hợp bằng Web Audio** trong `audio.js`, nên không cần file âm thanh và không lo bản quyền. Nếu sau này thêm file âm thanh thì chỉ dùng loại có giấy phép CC0.

---

## 6. Kỹ thuật

- **HTML + CSS + JavaScript thuần**, không cần build, giống phần còn lại của web cá nhân.
- Thư viện: **Matter.js** qua CDN jsDelivr. Ngoài ra không dùng thư viện nào khác.
- Chỉ cần mở `index.html` là chạy, và phải chạy được khi deploy tại `/suki_game/`. **Dùng đường dẫn tương đối.**
- Thêm các meta `apple-mobile-web-app-capable` để có thể "Thêm vào Màn hình chính" trên iPad và chơi toàn màn hình.

### Cấu trúc thư mục
```
suki_game/
├── HUONG_DAN.md      # file này
├── index.html        # các màn hình: menu, chơi, kết thúc, ảnh, album
├── style.css         # giao diện pastel, nút cảm ứng
├── js/
│   ├── config.js     # thông số chỉnh độ khó (tốc độ càng, độ chắc tay, thời gian…)
│   ├── main.js       # khởi tạo, chuyển màn hình
│   ├── game.js       # vòng lặp game, đồng hồ 60 giây, tính điểm
│   ├── claw.js       # máy gắp và trạng thái càng
│   ├── items.js      # định nghĩa vật phẩm thưởng/phạt, tỉ lệ xuất hiện
│   ├── input.js      # cảm ứng + bàn phím + gamepad gộp chung một lớp
│   ├── photos.js     # chọn ảnh, cắt, resize, lưu IndexedDB
│   ├── audio.js      # âm thanh, mở khóa iOS
│   └── storage.js    # kỷ lục, album (localStorage)
└── assets/
    ├── sounds/
    └── toys/         # SVG thú bông (KHÔNG chứa ảnh thật của Suki)
```

---

## 7. Lộ trình

- [x] **V1 – Lõi** (xong 2026-09-27): máy gắp, di chuyển, gắp/nhả có vật lý, đồng hồ 60 giây, tính điểm, màn kết thúc. Điều khiển đủ 3 kiểu (cảm ứng, bàn phím, PS4).
- [x] **V2 – Thưởng/phạt & ảnh Suki** (xong 2026-09-27): đủ bảng vật phẩm, upload ảnh bằng IndexedDB, hiệu ứng, âm thanh.
- [x] **V3 – Gắn kết** (xong 2026-09-27): combo, sao, kỷ lục, album sưu tập, hoàn thiện giao diện pastel.
- [ ] **Chơi thử với Suki:** ghi lại chỗ quá khó hoặc quá dễ để chỉnh tỉ lệ vật phẩm, độ chắc càng và ngưỡng sao.
- [ ] **Deploy:** kiểm tra trên iPad Safari thật. Kiểm tra lại rằng không có ảnh thật nào trong `git status` trước khi commit.

---

## 8. Checklist trước mỗi lần commit

- [ ] `git status` không có file ảnh cá nhân nào (`.jpg`, `.heic`, `.png` ngoài `assets/`).
- [ ] Chạy thử trên iPad (hoặc Safari responsive mode), bàn phím và tay cầm PS4.
- [ ] Không có lỗi trong console.
- [ ] Đường dẫn tương đối vẫn chạy đúng khi mở ở `/suki_game/`.
