# BÁO CÁO RÀ SOÁT VÀ HƯỚNG DẪN CHỈNH SỬA SLIDE THUYẾT TRÌNH (CANVA)

> **Tài liệu tham chiếu:**
> - Báo cáo Luận văn tốt nghiệp: `d:\DACN-main\DATN-253\`
> - Nhận xét Giảng viên phản biện: `d:\DACN-main\contracts\md-design\professor_comment.md`
> - Link Canva Slide: [Canva Presentation](https://canva.link/w3q6g2fl7239fod)
> - Thời lượng mục tiêu: **10 – 15 phút (Đúng chuẩn 15 slide)**

---

## 1. TỔNG QUAN ĐÁNH GIÁ SLIDE HIỆN TẠI

- **Ưu điểm:** Thiết kế hiện đại, bố cục rõ ràng, chuyên nghiệp, thể hiện đầy đủ các thành phần kiến trúc từ Phase 2 sang Phase 3.
- **2 Vấn đề cần khắc phục ngay trước khi ra Hội đồng:**
  1. **Số lượng slide quá dài (25 slide):** 
     - Nhận xét của Thầy tại `professor_comment.md` (dòng 7): *"thuyết trình 15p (15slide)"*.
     - 25 slide cho 15 phút đồng nghĩa bạn chỉ có **~25–30 giây/slide** (chưa tính 2-3 phút demo trực tiếp). Rất dễ bị cháy giáo án.
  2. **Một số số liệu & công thức mật mã bị lệch so với Báo cáo Luận văn** (nếu Hội đồng đối chiếu sách báo cáo và slide sẽ bị bắt bẻ).

---

## 2. CHI TIẾT CÁC LỖI LỆCH SỐ LIỆU CẦN SỬA TRÊN CANVA

### 🔴 Lỗi 1: Tỷ lệ giảm chi phí Gas (Slide 17)
- **Hiện trạng trên Slide 17:** Ghi `10,000 credentials: 9,785× cheaper`.
- **Số liệu chuẩn trong Luận văn:**
  - *Bảng 5.10 (dòng 222):* Phase 2 ($240,000,000$ gas) vs Phase 3 ($167,804$ gas) $\rightarrow$ **1,430.2× cheaper**.
  - *Bảng 5.11 (dòng 332 & Abstract):* **>1,468× reduction** (hoặc **>1,400× reduction**).
- **Hành động sửa trên Canva:**
  - Đổi con số `9,785× cheaper` thành: **`>1,400× cheaper`** (hoặc **`1,468× reduction`**, giảm từ $240\text{M}$ gas xuống $167.8\text{K}$ gas).

---

### 🔴 Lỗi 2: Công thức Cam kết Băm Muối (Slide 9 - Building Block 2)
- **Hiện trạng trên Slide 9:** 
  $$C = \text{keccak256}(\text{salt} \parallel \text{key} \parallel \text{value})$$
  *(Ký hiệu $\parallel$ là ghép nối byte không tiền tố độ dài, tức đại diện cho hàm `abi.encodePacked` vốn dính lỗ hổng Hash Collision đối với nhiều chuỗi động).*
- **Số liệu chuẩn trong Luận văn (Mục 2.7.1, 3.1):** Đã chuẩn hóa sang hàm `abi.encode` có length-prefix.
- **Hành động sửa trên Canva:**
  - Sửa lại công thức thành:
    $$C = \text{keccak256}(\text{abi.encode}(\text{salt}, \text{key}, \text{value}))$$
  - Thêm ghi chú nhỏ: *Sử dụng `abi.encode` kèm length-prefix để triệt tiêu lỗ hổng va chạm băm (Hash Collision).*

---

### 🟡 Lỗi 3: Gas của hàm `anchorBatch` (Slide 11 vs. Slide 17)
- **Hiện trạng:**
  - Slide 11 ghi `anchorBatch ~105k gas` (đây là đo trên Hardhat local EVM).
  - Slide 17 ghi Sepolia Testnet tiêu tốn `167,804 gas` (vì mạng thật có thêm tham số IPFS CID và state mới).
- **Hành động sửa trên Canva:**
  - Tại Slide 11 ghi chú rõ: `~105,000 gas (Local EVM) / 167,804 gas (Sepolia Live with IPFS CID)`.

---

### 🟢 Các số liệu đã chuẩn xác 100% (Giữ nguyên):
- **Signing Throughput:** `809 credentials/sec` (Slide 16).
- **Thời gian xử lý đợt 10,000 bằng:** `27.54 giây` (Chunked $20 \times 500$) (Slide 16).
- **Độ trễ xác minh:** Offline `5.50 ms` / Online RPC `~204 ms` (Slide 16).
- **Amortized Gas:** `16.78 gas / credential` (Slide 17).
- **Kiểm thử & Bảo mật:** `100% Code Coverage` (52/52 Hardhat tests), `33/33 exploit simulations passed` (Slide 18).

---

## 3. NỘI DUNG 02 SLIDE CẦN BỔ SUNG MỚI

### 3.1. Slide Mới: "Related Work & System Positioning"
*(Đặt ngay sau phần Problem & Phase 2 Limitations - giải quyết yêu cầu còn thiếu phần Related Work của bạn).*

**Nội dung đưa vào Slide:**
- **Tiêu đề:** Related Work & System Positioning (Nghiên cứu liên quan & Vị thế hệ thống)
- **Bảng so sánh 4 cột:**

| Tiêu chí | BlockCerts (MIT) | OpenCerts (Singapore) | EBSI (Châu Âu) | BK Credential (Đề tài) |
| :--- | :--- | :--- | :--- | :--- |
| **Blockchain** | Bitcoin / Ethereum | Ethereum Mainnet | Consortium EVM | **Ethereum Sepolia / L2** |
| **Mô hình neo** | OP_RETURN Merkle | DocumentStore Contract | On-chain status registry | **Merkle Tree + anchorBatch** |
| **Bảo mật dữ liệu** | Lộ toàn bộ document | Che giấu tĩnh qua schema | ZK / Predicates (Nặng) | **Salted Keccak-256 Commitments** |
| **Cơ chế Thu hồi** | UTXO / List HTTP | On-chain mapping (~45k gas) | Status list contract | **On-Chain Bitmap (256 creds/slot, ~5k gas)** |
| **Chi phí / 10k bằng** | Biến động theo Bitcoin | Rất cao theo gas Mainnet | Miễn phí (Mạng riêng) | **$O(1)$ ~16.8 gas/bằng (~0.5 USD)** |

- **Key Takeaway:** Hệ thống đạt điểm cân bằng tối ưu giữa **Quyền riêng tư (Selective Disclosure nhẹ hơn EBSI nhưng bảo mật hơn BlockCerts)** và **Hiệu quả kinh tế (Bitmap Revocation rẻ hơn OpenCerts 9×)**.

---

### 3.2. Slide Mới: "Dual-Control & Rector USB Token Approval"
*(Đặt ngay trước slide LIVE DEMO - giải quyết nhận xét của Thầy về kịch bản Hiệu trưởng & USB Token).*

**Nội dung đưa vào Slide:**
- **Tiêu đề:** Hardware-Bound Security: Phê duyệt qua USB Token của Hiệu trưởng
- **Bối cảnh & Vấn đề:** Tài khoản đăng nhập web (Privy) có nguy cơ bị lộ session/phishing. Việc cấp bằng đại học bắt buộc phải gắn liền với trách nhiệm pháp lý cao nhất của người đứng đầu (Hiệu trưởng / Trưởng phòng Đào tạo).
- **Mô hình Kiểm soát Kép (Dual-Control Model):**
  1. *Cán bộ Đào tạo:* Nhập liệu CSV, tính toán Merkle Tree off-chain $\rightarrow$ Trạng thái `PENDING_APPROVAL`.
  2. *Hiệu trưởng:* Cắm **USB Token vật lý**, giải mã Keystore cục bộ bằng **mã PIN** $\rightarrow$ Ký số phê duyệt đợt cấp phát.
  3. *Hệ thống Web:* Kiểm tra chữ ký Hiệu trưởng thành công $\rightarrow$ Mở khóa quyền gửi giao dịch `anchorBatch` lên Sepolia.
- **Đặc tính kỹ thuật:**
  - Khóa riêng tư không bao giờ rời khỏi thiết bị (Non-exportable).
  - Không làm phát sinh thêm bất kỳ chi phí gas on-chain nào ($0$ gas phụ trội).

---

## 4. KẾ HOẠCH TÁI CẤU TRÚC: GỘP TỪ 25 SLIDE VỀ ĐÚNG 15 SLIDE CHÍNH

Để bài thuyết trình đúng chuẩn 15 phút, bạn hãy gom các slide trên Canva theo bảng ánh xạ sau. Các slide chi tiết không bị xóa mà chuyển xuống mục **Backup Slides / Appendix** ở cuối:

| STT | Tên Slide Chuẩn (15 Slide) | Nguồn gộp từ Canva hiện tại | Thời lượng |
| :---: | :--- | :--- | :---: |
| **1** | Title & Project Overview | Slide 1 | 0.5 phút |
| **2** | Motivation & Problem Statement | Slide 3 | 1.0 phút |
| **3** | **Related Work & Phase 2 Bottlenecks** | Slide 4 + **Thêm bảng Related Work** | 1.5 phút |
| **4** | Phase 3 Architectural Paradigm Shift | Slide 5 + Slide 6 (Gộp thành 1 slide so sánh) | 1.0 phút |
| **5** | 4 Cryptographic Building Blocks | Slide 8 + Slide 9 (Sửa công thức `abi.encode`) | 1.5 phút |
| **6** | System Architecture & 3-Tier Data Flow | Slide 10 + Slide 11 (Gộp lại) | 1.0 phút |
| **7** | Batch Issuance Workflow | Slide 12 + Slide 13 (Gộp lại) | 1.0 phút |
| **8** | Canonical 10-Step Verification Pipeline | Slide 14 | 1.0 phút |
| **9** | **Dual-Control & Rector USB Token Approval** | **Slide bổ sung mới** | 1.0 phút |
| **10** | **LIVE SYSTEM DEMONSTRATION** | **Slide chuyển tiếp Demo thực tế** | **2.5 – 3.0 phút** |
| **11** | Empirical Benchmarks: Throughput & Latency | Slide 15 + Slide 16 (Gộp lại) | 1.0 phút |
| **12** | Empirical Benchmarks: Gas Scaling & Cost | Slide 17 (Sửa `>1,400× cheaper`) | 1.0 phút |
| **13** | Security Hardening & Exploit Simulation | Slide 18 | 0.5 phút |
| **14** | System Limitations & Engineering Trade-Offs | Slide 19 (Kill-switch vs Term turnover) | 0.5 phút |
| **15** | Future Directions & Conclusion | Slide 20 | 0.5 phút |

*(Các slide lý thuyết sâu như Slide 7, Slide 21–25: Đặt ở sau Slide 15 làm Slide dự phòng khi Hội đồng hỏi).*

---

## 5. KỊCH BẢN PHỐI HỢP THUYẾT TRÌNH VÀ DEMO USB TOKEN (15 PHÚT)

- **Phút 0 – 3 (Slide 1–3):** Trình bày nhanh bối cảnh, thực trạng làm giả bằng và đối sánh với thế giới (BlockCerts, OpenCerts, EBSI).
- **Phút 3 – 6 (Slide 4–8):** Trình bày giải pháp Phase 3 (EIP-712 + Merkle Tree + Bitmap Revocation), 4 trụ cột mật mã và quy trình 10 bước xác minh.
- **Phút 6 – 7 (Slide 9):** Giới thiệu tính năng bảo mật vật lý USB Token của Hiệu trưởng.
- **Phút 7 – 10 (Slide 10 - DEMO TRỰC TIẾP TRÊN TRÌNH DUYỆT):**
  - Mở web app: Cán bộ upload CSV, hệ thống SSE sinh Merkle Tree. Nút "Neo Blockchain" đang bị khóa.
  - Bạn rút chiếc USB thật ra: *"Bây giờ em xin đóng vai Thầy Hiệu trưởng"* $\rightarrow$ Cắm USB vào laptop $\rightarrow$ Chọn file keystore $\rightarrow$ Nhập PIN `246810` $\rightarrow$ Xác thực thành công $\rightarrow$ Mở khóa nút Neo $\rightarrow$ Giao dịch Sepolia thành công $\rightarrow$ Sang trang Verify kiểm tra 10 bước xanh mượt mà!
- **Phút 10 – 13 (Slide 11–13):** Trình bày kết quả đo đạc: 809 creds/s, gas giảm >1,400×, vượt qua 33/33 kịch bản tấn công.
- **Phút 13 – 15 (Slide 14–15):** Thẳng thắn nêu hạn chế (Kill-switch signer turnover), hướng phát triển và kết luận.
