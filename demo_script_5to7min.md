# KỊCH BẢN THUYẾT MINH VIDEO DEMO 4 CỔNG WEB PORTALS (5 – 7 PHÚT)

- **Dự án:** BK Credential System Phase 3
- **Mục tiêu:** Thuyết minh khớp từng hành động chuột khi quay video màn hình hoặc demo trực tiếp tại Slide 16.
- **Thời lượng:** ~5 – 7 phút (nhịp độ thong thả, rõ ràng).
- **Văn phong:** Tiếng Anh đơn giản, trực diện, nhấn mạnh các giá trị kỹ thuật cốt lõi (O(1) anchor, SSE streaming, Dual-Control USB Token, Bitmap revocation, 10-Step client-side verification).

---

## TỔNG QUAN PHÂN ĐOẠN DEMO

| Phân đoạn | Thời lượng | Cổng giao diện & Tính năng chính |
|---|:---:|---|
| **Phần 1** | ~2.5 phút | **Cổng Issuer (`/admin/v3/issue`)**: Đăng nhập Privy $\to$ Upload CSV 10,000 sinh viên $\to$ SSE Stepper xử lý bulk $\to$ **Cắm USB Token & Nhập PIN giải mã phê duyệt của Hiệu trưởng** $\to$ Neo giao dịch `anchorBatch` lên Sepolia. |
| **Phần 2** | ~1.0 phút | **Cổng Admin Revoke (`/admin/v3/revoke`)**: Tìm kiếm sinh viên theo MSSV $\to$ Thực hiện thu hồi bằng $\to$ Ký giao dịch bật 1 bit trên On-chain Bitmap. |
| **Phần 3** | ~1.5 phút | **Cổng Sinh viên Holder (`/holder`)**: Đăng nhập Privy bằng email sinh viên $\to$ Xem bằng tốt nghiệp $\to$ Demo tính năng **Selective Disclosure** (ẩn MSSV, điểm GPA) $\to$ Tải file JSON chứng chỉ. |
| **Phần 4** | ~1.5 phút | **Cổng Xác minh Verifier (`/v3/verify`)**: Kéo thả file JSON $\to$ Trình diễn **bộ Stepper 10 bước xác thực** $\to$ Kiểm tra chứng chỉ hợp lệ (10/10 xanh) và kiểm tra chứng chỉ bị thu hồi (Bước 9 đỏ cảnh báo). |

---

# CHI TIẾT KỊCH BẢN THUYẾT MINH (BILINGUAL)

---

## PHẦN 1: ISSUER PORTAL — CẤP PHÁT 10,000 BẰNG & DUAL-CONTROL USB TOKEN (~2.5 PHÚT)

### 🎬 Cảnh 1.1: Đăng nhập Cổng Đào tạo
* **Hành động trên màn hình:**
  - Mở trình duyệt tại địa chỉ `http://localhost:3000/admin/v3/issue`.
  - Bấm nút **"Đăng nhập"** (hoặc Login qua Privy).
* **🇬🇧 Lời thuyết minh (English):**
  > "First, I access the **Issuer Portal** at `/admin/v3/issue`. As an authorized university registrar, I log in using our institutional account via Privy."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Đầu tiên, em truy cập vào **Cổng Đào tạo** tại `/admin/v3/issue`. Với vai trò là cán bộ phòng đào tạo, em đăng nhập bằng tài khoản trường thông qua Privy."

---

### 🎬 Cảnh 1.2: Tải lên danh sách 10,000 sinh viên tốt nghiệp
* **Hành động trên màn hình:**
  - Nhập Batch ID: `BATCH-2026-COHORT-A`.
  - Bấm chọn tải lên file CSV `graduation-2026.csv` (10,000 dòng).
  - Màn hình hiển thị bảng tóm tắt: 10,000 sinh viên hợp lệ, 0 lỗi định dạng.
* **🇬🇧 Lời thuyết minh (English):**
  > "I enter the Batch ID: `BATCH-2026-COHORT-A` and upload our graduation CSV file containing **10,000 student records**. The frontend immediately parses and validates all rows against our Zod schema in less than a second."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Em nhập mã đợt phát hành `BATCH-2026-COHORT-A` và tải lên file CSV chứa danh sách **10,000 sinh viên tốt nghiệp**. Giao diện lập tức phân tích và kiểm tra toàn bộ các dòng theo schema định dạng chỉ trong chưa đầy 1 giây."

---

### 🎬 Cảnh 1.3: Xử lý Bulk Engine & SSE Real-Time Streaming
* **Hành động trên màn hình:**
  - Bấm nút **"Phát hành Batch mới"**.
  - Màn hình chuyển sang Stepper xử lý tiến độ: thanh phần trăm chạy từ 0% đến 100%, hiển thị tốc độ xử lý (~800 credentials/sec) và số chunk 20/20 hoàn thành.
* **🇬🇧 Lời thuyết minh (English):**
  > "Now, I click **'Phát hành Batch mới'**. As you can see, our asynchronous backend worker processes the 10,000 credentials in chunks of 500. Through Server-Sent Events, the progress bar updates in real time: generating salted commitments, signing with EIP-712, and building the Merkle tree at over **800 credentials per second**, taking under 30 seconds."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Bây giờ, em bấm **'Phát hành Batch mới'**. Như quý thầy cô đang thấy, tiến trình xử lý bất đồng bộ ở backend chia nhỏ 10,000 bằng thành từng khối 500. Thông qua cơ chế Server-Sent Events, thanh tiến trình hiển thị trực tiếp theo thời gian thực: tạo cam kết băm muối, ký chữ ký EIP-712 và dựng cây Merkle với tốc độ hơn **800 bằng/giây**, hoàn thành trong chưa đầy 30 giây."

---

### 🎬 Cảnh 1.4: Phê duyệt Dual-Control bằng USB Token của Hiệu trưởng
* **Hành động trên màn hình:**
  - Màn hình hiển thị Merkle Root (`0x...`).
  - Nút **"Neo lên Sepolia Blockchain"** đang bị vô hiệu hóa kèm thông báo yêu cầu chữ ký phê duyệt.
  - Bạn cầm chiếc USB Token giơ lên camera/trước Hội đồng: *"Đây là USB Token lưu trữ khóa phê duyệt của Thầy Hiệu trưởng"*.
  - Cắm USB vào máy tính, click mở modal **"Phê duyệt bằng USB Token của Hiệu trưởng"**.
  - Chọn file `rector.keystore.json` từ ổ đĩa USB `F:\BKCRED_TOKEN`.
  - Nhập mã PIN `246810`, bấm **"Giải mã & Phê duyệt"**.
  - Modal chuyển sang trạng thái xanh: *"Đã phê duyệt bởi Hiệu trưởng"*. Nút **Neo Blockchain** được mở khóa!
* **🇬🇧 Lời thuyết minh (English):**
  > "Notice that the 'Anchor to Blockchain' button is currently **locked**. To prevent rogue issuance, our system implements a **Dual-Control model**. University degree issuance strictly requires the Rector's cryptographic authorization.
  > I now plug in the **Rector's physical USB Token**. I select the encrypted keystore file from the USB drive, enter the Rector's private PIN, and click **'Giải mã & Phê duyệt'**. The private key is decrypted locally in memory to sign the approval, and the transaction button is now safely unlocked without generating any on-chain gas."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Quý thầy cô có thể thấy nút 'Neo lên Blockchain' hiện đang **bị khóa**. Để chống việc cấp bằng trái phép, hệ thống áp dụng mô hình **Kiểm soát kép (Dual-Control)**, bắt buộc phải có chữ ký của Thầy Hiệu trưởng.
  > Em cắm chiếc **USB Token vật lý của Hiệu trưởng** vào máy tính. Em chọn file keystore đã mã hóa trong ổ USB, nhập mã PIN bảo mật, và bấm **'Giải mã & Phê duyệt'**. Khóa riêng tư được giải mã cục bộ để ký phê duyệt đợt cấp bằng, và nút gửi giao dịch lập tức được mở khóa mà không làm tốn thêm bất kỳ phí gas on-chain nào."

---

### 🎬 Cảnh 1.5: Gửi giao dịch neo anchorBatch lên Sepolia
* **Hành động trên màn hình:**
  - Bấm nút **"Neo lên Sepolia Blockchain (anchorBatch)"**.
  - Popup MetaMask hiện lên, bấm Confirm.
  - Chờ vài giây giao dịch được xác nhận trên Sepolia.
  - Màn hình thông báo: **"Neo đợt phát hành thành công!"** kèm mã Tx Hash và Etherscan link.
* **🇬🇧 Lời thuyết minh (English):**
  > "With the Rector's approval verified, I click **'Neo lên Sepolia Blockchain'**. MetaMask prompts me to confirm the transaction calling `anchorBatch`. Within a few seconds, the transaction is mined on Ethereum Sepolia. An entire cohort of 10,000 graduates is now permanently anchored through a single 32-byte Merkle root, consuming only **16.8 gas per student**."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Sau khi xác thực chữ ký của Hiệu trưởng, em bấm **'Neo lên Sepolia Blockchain'**. Ví xác nhận gọi hàm `anchorBatch`. Chỉ sau vài giây, giao dịch được xác nhận thành công trên mạng Sepolia. Toàn bộ 10,000 văn bằng tốt nghiệp đã được neo vĩnh viễn trên blockchain chỉ bằng một gốc Merkle root 32-byte duy nhất, với chi phí chỉ **16.8 gas cho mỗi sinh viên**."

---

## PHẦN 2: ADMIN PORTAL — QUẢN LÝ DANH SÁCH & THU HỒI BẰNG TRÊN BITMAP (~1.0 PHÚT)

### 🎬 Cảnh 2.1: Xem chi tiết Batch vừa phát hành
* **Hành động trên màn hình:**
  - Chuyển sang trang `http://localhost:3000/admin/v3/batches`.
  - Click vào batch `BATCH-2026-COHORT-A`.
  - Màn hình hiển thị danh sách sinh viên được phân trang, trạng thái `Valid`, Merkle proof và Credential ID.
* **🇬🇧 Lời thuyết minh (English):**
  > "Next, in the Admin dashboard, we can inspect our newly anchored batch. Here we see the complete list of 10,000 graduates with their unique Credential IDs, Merkle proof paths, and verified status."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Tiếp theo, tại trang quản trị đợt cấp phát, chúng ta có thể kiểm tra chi tiết danh sách vừa neo. Toàn bộ 10,000 sinh viên hiển thị đầy đủ mã Credential ID, đường dẫn bằng chứng Merkle và trạng thái hợp lệ."

---

### 🎬 Cảnh 2.2: Thu hồi bằng một sinh viên trên On-chain Bitmap
* **Hành động trên màn hình:**
  - Chuyển sang menu **"Thu hồi chứng chỉ"** tại `http://localhost:3000/admin/v3/revoke`.
  - Nhập MSSV của một sinh viên (ví dụ: `2052921` - Hồ Anh Dũng).
  - Bấm **"Tìm kiếm"** $\to$ Card thông tin sinh viên hiện ra với trạng thái đang Hoạt động (`Active`).
  - Bấm nút màu đỏ: **"Thu hồi chứng chỉ"**.
  - Xác nhận hộp thoại và ký giao dịch MetaMask gọi `CredentialRegistryV3.revoke`.
  - Giao dịch hoàn tất, trạng thái lập tức chuyển sang huy hiệu màu đỏ: **"Đã thu hồi (Revoked)"**.
* **🇬🇧 Lời thuyết minh (English):**
  > "Now, suppose a diploma needs to be revoked due to academic fraud. I navigate to `/admin/v3/revoke`, search for student ID `2052921`, and click **'Thu hồi chứng chỉ'**.
  > MetaMask opens to execute the `revoke` function on `CredentialRegistryV3`. This operation simply flips a single bit in our on-chain 256-bit bitmap. The diploma is now instantaneously revoked across the entire network with minimal gas."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Bây giờ, giả sử có một văn bằng cần bị thu hồi do phát hiện gian lận học thuật. Em chuyển sang trang `/admin/v3/revoke`, tìm kiếm MSSV `2052921` và bấm **'Thu hồi chứng chỉ'**.
  > Ví kích hoạt gọi hàm `revoke` trên hợp đồng `CredentialRegistryV3`. Thao tác này chỉ đơn giản là lật 1 bit trong dãy bitmap 256-bit on-chain. Văn bằng lập tức bị thu hồi trên toàn mạng với chi phí gas cực kỳ tiết kiệm."

---

## PHẦN 3: HOLDER PORTAL — CỔNG SINH VIÊN & SELECTIVE DISCLOSURE (~1.5 PHÚT)

### 🎬 Cảnh 3.1: Sinh viên đăng nhập không cần ví Web3
* **Hành động trên màn hình:**
  - Mở tab ẩn danh hoặc trình duyệt khác tại `http://localhost:3000/holder`.
  - Bấm **"Đăng nhập ngay"** $\to$ Nhập email sinh viên (ví dụ: `dung.ho265@hcmut.edu.vn`).
  - Đăng nhập thành công, danh sách bằng tốt nghiệp của sinh viên hiện ra trong giao diện đẹp mắt.
* **🇬🇧 Lời thuyết minh (English):**
  > "Now, let us switch to the **Holder Portal** at `/holder`. As a graduating student, I do not need MetaMask or crypto knowledge. I simply log in using my university email via Privy. My diploma immediately appears in my personal vault."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Bây giờ, chúng ta cùng chuyển sang **Cổng Sinh viên** tại `/holder`. Với tư cách là sinh viên tốt nghiệp, em hoàn toàn không cần cài ví MetaMask hay có kiến thức Web3. Em chỉ cần đăng nhập bằng email trường qua Privy. Bằng tốt nghiệp lập tức xuất hiện trong kho chứng chỉ cá nhân."

---

### 🎬 Cảnh 3.2: Tùy chỉnh Tiết lộ có chọn lọc (Selective Disclosure)
* **Hành động trên màn hình:**
  - Click vào xem chi tiết văn bằng.
  - Hiển thị đầy đủ thông tin: Họ tên, Tên bằng, Ngày tốt nghiệp, Xếp loại, Điểm GPA, Ngày sinh.
  - Thao tác gạt các nút Toggle công khai/ẩn:
    - Bật hiện: *Tên bằng* và *Họ tên*.
    - Gạt tắt (ẩn): *Ngày sinh*, *MSSV*, và *Điểm GPA*.
  - Bấm nút **"Tải về file JSON đã cấu hình (Download Presentation)"** để lưu file về máy tính.
* **🇬🇧 Lời thuyết minh (English):**
  > "When I click to view my degree, I can configure **Selective Disclosure**. For example, when applying for a job, I want to prove my degree and name, but I choose to **hide my Date of Birth, Student ID, and GPA** using these toggles.
  > The portal removes the confidential salts while keeping the cryptographic commitments intact. I then click **'Download Presentation'** to save my tamper-proof credential JSON file."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Khi bấm vào xem chi tiết bằng, em có thể tùy chỉnh tính năng **Tiết lộ có chọn lọc**. Ví dụ, khi gửi hồ sơ xin việc, em muốn chứng minh bằng cấp và họ tên, nhưng chủ động **ẩn ngày sinh, MSSV và điểm GPA** bằng các nút gạt này.
  > Hệ thống sẽ lược bỏ các muối giải mã của thông tin ẩn nhưng vẫn giữ nguyên vẹn mã cam kết băm. Sau đó, em bấm **'Download Presentation'** để tải về file JSON chứng chỉ số."

---

## PHẦN 4: VERIFIER PORTAL — XÁC MINH ĐỘC LẬP 10 BƯỚC (~1.5 PHÚT)

### 🎬 Cảnh 4.1: Xác minh chứng chỉ hợp lệ (Tất cả 10 bước đều Xanh)
* **Hành động trên màn hình:**
  - Mở trang xác minh công khai tại `http://localhost:3000/v3/verify`.
  - Kéo thả file JSON vừa tải về (hoặc nhập Credential ID) vào khung xác minh.
  - Bấm nút **"Xác minh"**.
  - Stepper 10 bước chạy tuần tự cực nhanh (~5.5 ms) và hiển thị 10 dấu tích xanh lá cây:
    - ✅ Bước 1 đến 5: Định dạng, băm muối, Merkle proof.
    - ✅ Bước 6: Khôi phục chữ ký EIP-712 người cấp.
    - ✅ Bước 7 & 8: Kiểm tra IssuerRegistry & mỏ neo CredentialRegistry on-chain.
    - ✅ Bước 9: Trạng thái thu hồi Bitmap (Bit = 0, còn hiệu lực).
    - ✅ Bước 10: Kiểm tra hạn dùng.
  - Thông báo: **"Chứng chỉ hợp lệ!"**. Các thông tin bị ẩn hiển thị dạng `[Đã ẩn bởi sinh viên]`.
* **🇬🇧 Lời thuyết minh (English):**
  > "Finally, let us visit the public **Verifier Portal** at `/v3/verify`. Any employer can verify a credential with zero registration. I simply drag and drop the student's JSON file.
  > In less than **6 milliseconds**, our client-side verification engine executes the **canonical 10-step verification pipeline**. Steps 1 to 5 verify data integrity and Merkle proofs. Step 6 recovers the EIP-712 signer. Steps 7 and 8 verify on-chain registration on Sepolia. Step 9 checks the revocation bitmap, and Step 10 confirms expiry.
  > All 10 steps pass with green checkmarks! Notice that hidden claims like GPA are safely masked, yet the integrity is mathematically guaranteed."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Cuối cùng, chúng ta chuyển sang **Cổng Xác minh** tại `/v3/verify`. Bất kỳ nhà tuyển dụng nào cũng có thể kiểm tra mà không cần đăng ký tài khoản. Em chỉ việc kéo thả file JSON của sinh viên vào khung xác minh.
  > Trong chưa đầy **6 mili-giây**, động cơ kiểm tra phía client thực thi **quy trình xác thực chuẩn 10 bước**. Bước 1 đến 5 kiểm tra tính toàn vẹn và cây Merkle. Bước 6 khôi phục chữ ký EIP-712. Bước 7 và 8 truy vấn hợp đồng trên Sepolia. Bước 9 kiểm tra bitmap thu hồi, và Bước 10 kiểm tra hạn dùng.
  > Cả 10 bước đều xanh mượt mà! Các thông tin đã bị ẩn như điểm số hiển thị an toàn dưới dạng đã che giấu, nhưng tính toàn vẹn vẫn được chứng minh tuyệt đối bằng toán học."

---

### 🎬 Cảnh 4.2: Xác minh chứng chỉ đã bị thu hồi (Bước 9 Báo Đỏ)
* **Hành động trên màn hình:**
  - Nhập mã Credential ID của sinh viên vừa bị thu hồi ở Phần 2 (hoặc tải file JSON của sinh viên đó).
  - Bấm **"Xác minh"**.
  - Pipeline chạy đến **Bước 9: Kiểm tra trạng thái thu hồi** $\to$ Lập tức dừng lại và báo **MÀU ĐỎ** với biểu tượng cảnh báo: *"Xác thực thất bại: Chứng chỉ đã bị thu hồi trong bitmap on-chain"*.
* **🇬🇧 Lời thuyết minh (English):**
  > "Now, what happens if an employer verifies the diploma we revoked earlier? I input the credential ID and click Verify.
  > Steps 1 through 8 pass, but at **Step 9**, the pipeline queries the on-chain bitmap and detects that the revocation bit is set to 1. The verification immediately halts with a red alert: **'Chứng chỉ đã bị thu hồi'**. This proves our on-chain bitmap revocation provides instant, deterministic fraud protection."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Bây giờ, điều gì sẽ xảy ra nếu nhà tuyển dụng xác minh văn bằng mà chúng ta vừa thu hồi ở Phần 2? Em nhập mã chứng chỉ và bấm Xác minh.
  > Các bước từ 1 đến 8 đều vượt qua, nhưng đến **Bước 9**, hệ thống quét bitmap on-chain và phát hiện bit thu hồi đã được bật thành 1. Quy trình lập tức dừng lại và báo cờ đỏ: **'Chứng chỉ đã bị thu hồi'**. Điều này chứng minh cơ chế thu hồi bằng bitmap on-chain có hiệu lực tức thì và ngăn chặn triệt để văn bằng gian lận."

---

### 🎬 Cảnh 4.3: Kết thúc Demo và chuyển về Slide
* **🇬🇧 Lời thuyết minh (English):**
  > "This concludes our live system demonstration across all four portals: Issuer, Admin, Holder, and Verifier. I will now return to the presentation slides to discuss our empirical benchmarks and security evaluation."
* **🇻🇳 Lời thuyết minh (Tiếng Việt):**
  > "Đến đây, em xin kết thúc phần demo thực tế trên cả 4 cổng: Cổng cấp bằng, Quản trị, Sinh viên và Xác minh. Sau đây, em xin phép quay trở lại slide thuyết trình để báo cáo về các kết quả đo đạc thực nghiệm và đánh giá bảo mật."

---

## 📌 BẢNG CHECKLIST CHUẨN BỊ TRƯỚC KHI QUAY / DEMO

1. [ ] Khởi chạy sẵn web app: `npm run dev` tại `http://localhost:3000`.
2. [ ] Cắm sẵn USB vào máy tính (kiểm tra thấy ổ `F:\BKCRED_TOKEN\rector.keystore.json`).
3. [ ] Nhớ sẵn mã PIN Hiệu trưởng: **`246810`**.
4. [ ] Chuẩn bị sẵn file `d:\DACN-main\contracts\fixtures\graduation-2026.csv` ở màn hình Desktop để kéo thả nhanh.
5. [ ] Đảm bảo ví MetaMask có một ít Sepolia ETH để bấm confirm giao dịch `anchorBatch` và `revoke`.
6. [ ] Mở sẵn 4 tab trình duyệt tương ứng:
   - Tab 1: `http://localhost:3000/admin/v3/issue` (Issuer)
   - Tab 2: `http://localhost:3000/admin/v3/revoke` (Revoke)
   - Tab 3 (Tab ẩn danh): `http://localhost:3000/holder` (Holder)
   - Tab 4: `http://localhost:3000/v3/verify` (Verifier)
