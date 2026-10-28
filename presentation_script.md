# KỊCH BẢN THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN TỐT NGHIỆP (ĐÃ CẬP NHẬT 21 SLIDE)

- **Đề tài:** Design and Implementation of a Blockchain-Based Digital Certificate Issuance Solution
- **Sinh viên thực hiện:** Hồ Anh Dũng
- **GVHD:** PGS. TS. Phạm Hoàng Anh
- **Cập nhật:** Đã lược bỏ 02 slide (*Phase 3 Objectives* và *Theoretical Foundations*). Tổng số slide hiện tại: **21 slide**.
- **Thời lượng thuyết trình slide:** **Dưới 10 phút (~920 từ tiếng Anh)**.
- **Thời lượng Video Demo:** **5 – 7 phút** (tại Slide 14: Four Web Portals, có script riêng tại file `demo_script_5to7min.md`).

---

## BẢNG PHÂN BỔ THỜI GIAN THEO 21 SLIDE

| STT mới | Tên Slide | Nội dung cốt lõi | Thời gian dự kiến | Số từ tiếng Anh |
|:---:|---|---|:---:|:---:|
| **1** | Title Slide | Lời chào Hội đồng, giới thiệu tên và đề tài | 25s | ~45 từ |
| **2** | Table of Contents | Điểm nhanh cấu trúc bài báo cáo | 10s | ~20 từ |
| **3** | Problem & Motivation | Thực trạng bằng giả, quá tải xác minh, lộ thông tin cá nhân | 35s | ~55 từ |
| **4** | Phase 2 Bottlenecks | Nút thắt Phase 2: gas 103k/bằng, phí IPFS, parser SD-JWT | 35s | ~55 từ |
| **5** | Design Shift (What & Why) | Chuyển dịch: Token-centric $\to$ Attestation + Trust Anchor | 35s | ~50 từ |
| **6** | Related Work | So sánh với BlockCerts, OpenCerts, EBSI | 35s | ~55 từ |
| **7** | Four Building Blocks | 4 trụ cột: Salted Keccak-256, Merkle Tree, EIP-712, Bitmap | 30s | ~45 từ |
| **8** | Overall Architecture | Kiến trúc 3 tầng: Off-chain, On-chain Sepolia, App Layer | 30s | ~45 từ |
| **9** | Credential Schema | Struct EIP-712: Tách Public Claims và Private Commitments | 30s | ~45 từ |
| **10** | Smart Contract Design | `IssuerRegistry`, `CredentialRegistryV3`, kiểm tra quyền liên hợp đồng | 30s | ~45 từ |
| **11** | Issuance & Revocation Flow | Quy trình 8 bước cấp phát và thu hồi tức thì qua bitmap | 30s | ~45 từ |
| **12** | Implementation & Tech Stack | Next.js 14, Neon PostgreSQL, Privy, `@bkcred/sdk` | 25s | ~40 từ |
| **13** | Backend & Bulk Engine | Bộ xử lý chunked bất đồng bộ, SSE stream, RAM < 250MB | 25s | ~40 từ |
| **14** | **Four Web Portals** | **Giới thiệu 4 cổng $\to$ Chuyển sang VIDEO DEMO 5–7 PHÚT** | **20s** | **~35 từ** |
| **15** | Testing & STRIDE Security | 97 tests (100% coverage), từ chối 33/33 kịch bản tấn công | 30s | ~45 từ |
| **16** | Empirical Scenarios A–E | Đỉnh 809 bằng/s, 10k bằng trong 27.5s, xác minh offline 5.5ms | 35s | ~55 từ |
| **17** | On-Chain Cost & Sepolia | Độ phức tạp O(1), giảm gas 1,430× (~16.8 gas/bằng, 0.56 USD) | 35s | ~50 từ |
| **18** | Limitations & Trade-Offs | 5 hạn chế trung thực & Lý do đánh đổi kỹ thuật có chủ đích | 35s | ~55 từ |
| **19** | Future Directions | Layer 2, ZK Range Proofs, W3C VC v2.0, Mobile Wallet | 30s | ~45 từ |
| **20** | Conclusion | Tóm tắt đóng góp và bài học cân bằng giữa lý thuyết & thực tế | 30s | ~50 từ |
| **21** | Thank You & Q&A | Tri ân Thầy PGS.TS. Phạm Hoàng Anh & Mời Hội đồng phản biện | 30s | ~50 từ |
| **TỔNG** | **21 Slides** | *(Đã tối ưu nói thong thả, dứt khoát dưới 10 phút)* | **~9.5 phút** | **~925 từ** |

---

# CHI TIẾT SCRIPT THUYẾT TRÌNH 21 SLIDE (SONG NGỮ)

---

### SLIDE 1: TITLE SLIDE
* **Tiêu đề:** DESIGN AND IMPLEMENTATION OF A BLOCKCHAIN-BASED DIGITAL CERTIFICATE ISSUANCE SOLUTION
* **Thời lượng:** ~25 giây | ~45 từ

#### 🌟 Key Highlights:
- Lời chào trang trọng gửi tới Chủ tịch Hội đồng, quý thầy cô và bạn bè.
- Giới thiệu tên sinh viên, tên đề tài, và GVHD PGS. TS. Phạm Hoàng Anh.

#### 🇬🇧 English Script:
> "Distinguished Chairman, honorable members of the committee, and dear friends. My name is **Ho Anh Dung**. Today, I am honored to present my capstone project entitled: **'Design and Implementation of a Blockchain-Based Digital Certificate Issuance Solution'**, under the dedicated guidance of **Associate Professor Doctor Pham Hoang Anh**. Allow me to begin my presentation."

#### 🇻🇳 Bản Tiếng Việt:
> "Kính thưa thầy Chủ tịch hội đồng và các thầy (cô) trong hội đồng, thưa toàn thể các bạn. Em là **Hồ Anh Dũng**. Hôm nay em xin trình bày đồ án tốt nghiệp của mình với tên đề tài là: **'Design and Implementation of a Blockchain-Based Digital Certificate Issuance Solution'**, dưới sự hướng dẫn của **PGS. TS. Phạm Hoàng Anh**. Sau đây em xin phép được bắt đầu."

---

### SLIDE 2: TABLE OF CONTENTS
* **Tiêu đề:** TABLE OF CONTENTS
* **Thời lượng:** ~10 giây | ~20 từ

#### 🌟 Key Highlights:
- Lướt nhanh qua các phần chính trong 1 câu duy nhất. Không đọc từng gạch đầu dòng.

#### 🇬🇧 English Script:
> "My presentation covers our **problem statement**, **architectural shift**, **system design**, **implementation**, and our **empirical evaluation** on live Ethereum Sepolia."

#### 🇻🇳 Bản Tiếng Việt:
> "Bài báo cáo của em gồm các phần: **đặt vấn đề**, **bước chuyển dịch kiến trúc**, **thiết kế hệ thống**, **hiện thực**, và **đánh giá thực nghiệm** trên mạng Ethereum Sepolia."

---

### SLIDE 3: PROBLEM & MOTIVATION
* **Tiêu đề:** PROBLEM & MOTIVATION
* **Thời lượng:** ~35 giây | ~55 từ

#### 🌟 Key Highlights:
- 3 vấn đề lớn: Bằng giấy dễ làm giả; Xác minh thủ công tập trung; Lộ quá nhiều thông tin cá nhân (Over-disclosure).
- Mục tiêu: Bất biến, Tiết lộ có chọn lọc, Chi phí hợp lý ở quy mô lớn.

#### 🇬🇧 English Script:
> "Today, paper diplomas and PDF scans are **very easy to forge**, while background verification remains slow and centralized. Furthermore, graduates face **over-disclosure**—they must reveal their birthdate, national ID, and GPA just to prove their degree. Our goal is to build a decentralized solution providing **tamper-evidence, privacy-preserving selective disclosure, and cost-efficient scaling** for university cohorts."

#### 🇻🇳 Bản Tiếng Việt:
> "Hiện nay, văn bằng giấy và bản scan PDF **rất dễ bị làm giả**, trong khi việc xác minh thì chậm chạp và tập trung. Hơn nữa, sinh viên gặp vấn đề **lộ quá nhiều thông tin cá nhân**—phải để lộ cả ngày sinh, CCCD và điểm số chỉ để chứng minh bằng tốt nghiệp. Mục tiêu của em là xây dựng một giải pháp phi tập trung đảm bảo **tính toàn vẹn dữ liệu, tiết lộ có chọn lọc bảo vệ riêng tư, và chi phí tối ưu** ở quy mô trường học."

---

### SLIDE 4: PHASE 2 RECAP: WHAT LIMITED US AT UNIVERSITY SCALE
* **Tiêu đề:** PHASE 2 RECAP: WHAT LIMITED US AT UNIVERSITY SCALE
* **Thời lượng:** ~35 giây | ~55 từ

#### 🌟 Key Highlights:
- 3 nút thắt của Phase 2: ~103,156 gas/bằng on-chain (>1 tỷ gas/khóa); Phụ thuộc phí IPFS hàng tháng; Thư viện SD-JWT cần custom parser phức tạp.

#### 🇬🇧 English Script:
> "In previous phases, we evaluated a prototype using SD-JWT credentials. However, scaling to **10,000 graduates** revealed severe bottlenecks: minting credentials on-chain consumed **103,000 gas each**, exceeding **1 billion gas** per cohort. Storing files on IPFS introduced **recurring monthly fees**, and parsing SD-JWT required an unwieldy custom parser. We needed an architectural breakthrough."

#### 🇻🇳 Bản Tiếng Việt:
> "Ở các giai đoạn trước, nhóm đã thử nghiệm mô hình dùng SD-JWT. Tuy nhiên, khi mở rộng lên quy mô **10,000 sinh viên tốt nghiệp**, hệ thống gặp những nút thắt nghiêm trọng: mint bằng trực tiếp on-chain tốn tới **103,000 gas/bằng**, vượt quá **1 tỷ gas** cho một khóa. Lưu trữ trên IPFS làm phát sinh **chi phí duy trì hàng tháng**, và thư viện SD-JWT đòi hỏi bộ parser riêng phức tạp. Chúng em cần một bước chuyển đổi kiến trúc toàn diện."

---

### SLIDE 5: DESIGN SHIFT: WHAT CHANGED AND WHY
* **Tiêu đề:** DESIGN SHIFT: WHAT CHANGED AND WHY
* **Thời lượng:** ~35 giây | ~50 từ

#### 🌟 Key Highlights:
- Thay đổi tư duy: Từ Token-centric (NFT đắt đỏ) sang **Cryptographic Attestation + Blockchain làm Trust Anchor**.
- Blockchain **chỉ lưu trữ 32-byte Merkle root**; toàn bộ dữ liệu bằng do sinh viên tự giữ off-chain.

#### 🇬🇧 English Script:
> "This slide captures our core paradigm shift. We transitioned from an **expensive NFT-per-student model** to a **pure cryptographic attestation model**. The blockchain now acts strictly as a **Trust Anchor**, storing only a **single 32-byte Merkle root**. Credentials live off-chain as self-contained JSON files, completely eliminating recurring storage and gateway dependencies."

#### 🇻🇳 Bản Tiếng Việt:
> "Slide này thể hiện bước chuyển dịch tư duy cốt lõi của đề tài: Chúng em chuyển từ mô hình **NFT cho từng sinh viên** tốn kém sang mô hình **Chứng thực mật mã (Cryptographic Attestation)**. Blockchain giờ đây đóng vai trò thuần túy là **Điểm tựa niềm tin (Trust Anchor)**, chỉ lưu trữ duy nhất **một Merkle root 32-byte**. Bằng tốt nghiệp do sinh viên tự giữ off-chain, xóa bỏ hoàn toàn chi phí lưu trữ định kỳ."

---

### SLIDE 6: RELATED WORK
* **Tiêu đề:** RELATED WORK
* **Thời lượng:** ~35 giây | ~55 từ

#### 🌟 Key Highlights:
- So sánh ngắn gọn: **BlockCerts** (lộ hết thông tin cá nhân), **OpenCerts** (gas Mainnet rất đắt, thu hồi tốn 45k gas), **EBSI** (mạng consortium đóng).
- BK Credential: Tối ưu trên mạng Public Ethereum, chi phí chỉ ~16.8 gas/bằng, tích hợp sẵn Selective Disclosure.

#### 🇬🇧 English Script:
> "Compared to existing systems: MIT's **BlockCerts** lacks selective disclosure, exposing all personal data. Singapore's **OpenCerts** uses on-chain mapping revocation, costing **45,000 gas per diploma**. Europe's **EBSI** requires a closed consortium network. Our system achieves the optimal sweet spot on public Ethereum: native **Salted Keccak-256 selective disclosure** and **compact bitmap revocation** at only **16.8 gas per graduate**."

#### 🇻🇳 Bản Tiếng Việt:
> "So sánh với các hệ thống hiện nay: **BlockCerts** của MIT không hỗ trợ selective disclosure, làm lộ toàn bộ thông tin cá nhân. **OpenCerts** của Singapore dùng mapping on-chain, tốn tới **45,000 gas cho mỗi lần thu hồi**. **EBSI** của Châu Âu đòi hỏi mạng consortium đóng. Hệ sinh thái BK Credential đạt điểm cân bằng tối ưu trên mạng public Ethereum: có sẵn **Selective Disclosure bằng băm muối Keccak-256** và **thu hồi qua Bitmap** chỉ tốn trung bình **16.8 gas/bằng**."

---

### SLIDE 7: FOUR BUILDING BLOCKS
* **Tiêu đề:** FOUR BUILDING BLOCKS
* **Thời lượng:** ~30 giây | ~45 từ

#### 🌟 Key Highlights:
- 4 trụ cột: Salted Commitments (`abi.encode`), Standard Merkle Tree, EIP-712 Typed Signing, 256-bit Bitmap Revocation.

#### 🇬🇧 English Script:
> "The Phase 3 architecture rests on **four cryptographic building blocks**: First, **Salted Keccak-256 Commitments** using `abi.encode` with length-prefixes to prevent collision. Second, **Standard Merkle Trees** for batch compression. Third, **EIP-712 Typed Data Signing** for native wallet verification. And fourth, a **256-bit Bitmap Registry** managing 256 revocation flags per storage slot."

#### 🇻🇳 Bản Tiếng Việt:
> "Kiến trúc Phase 3 dựa trên **bốn trụ cột kỹ thuật**: Thứ nhất, **Cam kết băm muối Keccak-256** dùng `abi.encode` kèm length-prefix chống va chạm băm. Thứ hai, **Cây Merkle chuẩn** để nén đợt cấp phát. Thứ ba, **Chữ ký EIP-712** tương thích tự nhiên với ví Web3. Và thứ tư, **Bộ đăng ký Bitmap 256-bit**, quản lý 256 trạng thái thu hồi trong 1 slot lưu trữ duy nhất."

---

### SLIDE 8: OVERALL ARCHITECTURE
* **Tiêu đề:** 3 - SYSTEM DESIGN: Overall Architecture
* **Thời lượng:** ~30 giây | ~45 từ

#### 🌟 Key Highlights:
- Kiến trúc 3 tầng: Off-chain (0 gas), On-chain Sepolia (chỉ 1 transaction neo duy nhất), Tầng Ứng dụng Web.

#### 🇬🇧 English Script:
> "Here is our 3-tier architecture. In the **off-chain layer**, the university signs credentials and constructs the Merkle tree with **zero gas cost**. In the **on-chain layer on Sepolia**, two minimal smart contracts manage signer authorization and batch anchors. Finally, the **application layer** connects all portals. Only **one single transaction** anchors an entire graduating class."

#### 🇻🇳 Bản Tiếng Việt:
> "Đây là kiến trúc 3 tầng của hệ thống: Ở **tầng off-chain**, nhà trường ký số và dựng cây Merkle với **chi phí gas bằng 0**. Ở **tầng on-chain trên Sepolia**, hai hợp đồng thông minh tinh gọn quản lý danh sách cán bộ ký và mỏ neo batch. Cuối cùng, **tầng ứng dụng web** phục vụ các bên liên quan. Chỉ cần **duy nhất một giao dịch** để neo toàn bộ khóa tốt nghiệp."

---

### SLIDE 9: CREDENTIAL SCHEMA (EIP-712)
* **Tiêu đề:** CREDENTIAL SCHEMA (EIP-712)
* **Thời lượng:** ~30 giây | ~45 từ

#### 🌟 Key Highlights:
- Struct `BkCredential`: Phân tách Public Claims và Private Claims.
- Thông tin nhạy cảm (Tên, MSSV, Điểm) chỉ xuất hiện dưới dạng mã băm cam kết 32-byte.

#### 🇬🇧 English Script:
> "Our EIP-712 schema cleanly decouples **Public Claims**—such as degree title and graduation date—from **Private Claims**—such as student name, ID number, and GPA. Private attributes are represented strictly as **32-byte cryptographic commitments**. Graduates receive a complete package containing the signature, Merkle proof, and disclosure salts to selectively reveal any attribute."

#### 🇻🇳 Bản Tiếng Việt:
> "Cấu trúc EIP-712 phân tách rành mạch giữa **Thông tin công khai**—như tên ngành, ngày tốt nghiệp—và **Thông tin riêng tư**—như họ tên, MSSV, điểm số. Các thông tin riêng tư chỉ tồn tại dưới dạng **mã cam kết băm 32-byte**. Sinh viên nhận trọn gói gồm chữ ký, bằng chứng Merkle và các muối giải mã để tùy ý công khai từng mục."

---

### SLIDE 10: SMART CONTRACT DESIGN
* **Tiêu đề:** SMART CONTRACT DESIGN
* **Thời lượng:** ~30 giây | ~45 từ

#### 🌟 Key Highlights:
- `IssuerRegistry`: Quản lý danh tính ký, kế thừa `Ownable2Step`.
- `CredentialRegistryV3`: Neo batch, kiểm tra `isSigner(msg.sender)` liên hợp đồng, cơ chế khẩn cấp `Pausable`.

#### 🇬🇧 English Script:
> "Our smart contracts enforce strict separation of duties. `IssuerRegistry` governs authorized signing officers with two-step ownership transfer. `CredentialRegistryV3` handles `anchorBatch` and bitmap revocations. Crucially, we enforce a **cross-contract check**: whenever a batch is anchored, `CredentialRegistryV3` calls `IssuerRegistry.isSigner` to verify authorization. We also include OpenZeppelin's `Pausable` for emergency containment."

#### 🇻🇳 Bản Tiếng Việt:
> "Thiết kế hợp đồng thông minh phân tách rõ trách nhiệm: `IssuerRegistry` quản lý cán bộ được phép ký với chuẩn sở hữu an toàn 2 bước. `CredentialRegistryV3` xử lý neo batch và thu hồi qua bitmap. Trọng tâm là **cơ chế kiểm tra liên hợp đồng**: khi neo batch, hợp đồng tự động gọi sang `IssuerRegistry.isSigner` để kiểm tra quyền hạn. Ngoài ra còn có module `Pausable` để tạm dừng khẩn cấp khi có sự cố."

---

### SLIDE 11: ISSUANCE AND REVOCATION WORKFLOWS
* **Tiêu đề:** ISSUANCE AND REVOCATION WORKFLOWS
* **Thời lượng:** ~30 giây | ~45 từ

#### 🌟 Key Highlights:
- Luồng cấp phát 8 bước tự động từ CSV đến PostgreSQL và Sepolia.
- Thu hồi tức thì bằng thao tác bật bit (1 bit = 1 bằng).

#### 🇬🇧 English Script:
> "The operational workflow is highly efficient. During issuance, the registrar uploads a student CSV, and the backend automatically generates salts, signs EIP-712 payloads, builds the Merkle tree, and submits the batch anchor to Sepolia. For revocation, the admin executes `revoke`, flipping a single bit in the bitmap, invalidating the diploma instantly with negligible gas."

#### 🇻🇳 Bản Tiếng Việt:
> "Quy trình vận hành diễn ra hết sức hiệu quả: Khi cấp phát, cán bộ tải file CSV lên, hệ thống tự động tạo muối, ký chữ ký EIP-712, dựng cây Merkle và gửi giao dịch neo batch lên Sepolia. Khi cần thu hồi bằng, quản trị viên gọi hàm `revoke` để bật 1 bit trong dãy bitmap, vô hiệu hóa văn bằng tức thì với chi phí gas không đáng kể."

---

### SLIDE 12: IMPLEMENTATION & TECH STACK
* **Tiêu đề:** 4 - IMPLEMENTATION: Smart Contract & Fullstack Application
* **Thời lượng:** ~25 giây | ~40 từ

#### 🌟 Key Highlights:
- Tech stack: Next.js 14, TypeScript, Prisma, Neon PostgreSQL, OpenZeppelin v5, Hardhat.
- Đăng nhập không cần ví Web3 bằng **Privy passwordless email login**.
- Thư viện nội bộ **@bkcred/sdk** gồm 6 module độc lập.

#### 🇬🇧 English Script:
> "Our system is implemented using **Next.js 14, TypeScript, Prisma, and PostgreSQL on Neon**, alongside Solidity smart contracts with OpenZeppelin v5. To eliminate adoption barriers for non-technical graduates, we integrated **Privy passwordless email authentication**. We also developed `@bkcred/sdk`, a modular 6-package TypeScript SDK powering all cryptographic workflows."

#### 🇻🇳 Bản Tiếng Việt:
> "Hệ thống được hiện thực trên nền tảng **Next.js 14, TypeScript, Prisma và PostgreSQL trên Neon**, kết hợp hợp đồng Solidity với OpenZeppelin v5. Để xóa bỏ rào cản kỹ thuật cho sinh viên, em tích hợp **xác thực email không cần mật khẩu qua Privy**. Toàn bộ logic mật mã được đóng gói thành bộ thư viện nội bộ `@bkcred/sdk` gồm 6 module độc lập."

---

### SLIDE 13: BACKEND ARCHITECTURE & ASYNCHRONOUS JOB MANAGER
* **Tiêu đề:** BACKEND ARCHITECTURE & ASYNCHRONOUS JOB MANAGER
* **Thời lượng:** ~25 giây | ~40 từ

#### 🌟 Key Highlights:
- Động cơ xử lý chunked bất đồng bộ ($20 \times 500 = 10,000$).
- SSE stream tiến độ thời gian thực, giữ RAM heap luôn dưới 250 MB.

#### 🇬🇧 English Script:
> "To process university-scale cohorts reliably, I engineered an **asynchronous chunked issuance engine** dividing batches into 500-credential chunks. Powered by an in-memory job queue and Server-Sent Events streaming live progress, the engine maintains stability while capping Node.js heap memory usage **safely below 250 Megabytes** for 10,000 credentials."

#### 🇻🇳 Bản Tiếng Việt:
> "Để xử lý các đợt tốt nghiệp lớn một cách ổn định, em thiết kế **động cơ cấp phát chia khối bất đồng bộ**, cắt nhỏ danh sách thành từng khối 500 bằng. Kết hợp với hàng đợi công việc và Server-Sent Events truyền tiến độ thời gian thực, hệ thống duy trì mức RAM của Node.js **an toàn dưới 250 MB** cho 10,000 sinh viên."

---

### SLIDE 14: FOUR WEB PORTALS & DEMO TRANSITION
* **Tiêu đề:** FOUR WEB PORTALS
* **Thời lượng:** ~20 giây | ~35 từ *(Sau đó chuyển sang Video Demo 5 – 7 phút)*

#### 🌟 Key Highlights:
- 4 cổng giao tiếp: **Issuer**, **Holder**, **Verifier**, **Admin**.
- Xin phép Hội đồng chuyển sang phần chiếu video demo thực tế (5–7 phút).

#### 🇬🇧 English Script:
> "The platform delivers four dedicated portals: **Issuer** for university staff, **Holder** for students with privacy toggles, **Verifier** for drag-and-drop validation, and **Admin** for signer lifecycle and revocation. **At this point, I would like to invite the committee to watch a 5-minute live demonstration video showcasing the end-to-end operation across these four portals.**"
> *(👉 Dừng lại và bắt đầu chiếu Video Demo theo file `demo_script_5to7min.md`)*

#### 🇻🇳 Bản Tiếng Việt:
> "Hệ thống cung cấp 4 cổng chuyên biệt: **Issuer** cho cán bộ đào tạo, **Holder** cho sinh viên tùy chọn che/hiện thông tin, **Verifier** để xác minh tức thì, và **Admin** để quản lý chữ ký và thu hồi. **Sau đây, em xin phép kính mời quý thầy cô cùng theo dõi video demo thực tế trong khoảng 5 phút để trải nghiệm toàn bộ quy trình trên 4 cổng giao diện này.**"
> *(👉 Dừng lại và bắt đầu chiếu Video Demo theo file `demo_script_5to7min.md`)*

---

### SLIDE 15: TESTING AND EVALUATION: COVERAGE & SECURITY
* **Tiêu đề:** 5 – TESTING AND EVALUATION: Automated Tests & Security
* **Thời lượng:** ~30 giây | ~45 từ *(Tiếp tục bài nói sau khi xem xong Demo)*

#### 🌟 Key Highlights:
- **97 automated tests**: 52 tests smart contract + 45 tests SDK. Đạt **100% Code Coverage**.
- Mô hình đe dọa STRIDE: Đã mô phỏng và ngăn chặn thành công **33/33 kịch bản tấn công**.

#### 🇬🇧 English Script:
> "Resuming our evaluation: We implemented **97 automated unit tests** across our smart contracts and SDK, achieving **100% test coverage** on all statements, branches, and functions. Under the formal STRIDE threat model, we simulated **33 real-world adversarial attacks**—such as Merkle tampering and signature forgery. **All 33 attacks were successfully detected and rejected.**"

#### 🇻🇳 Bản Tiếng Việt:
> "Tiếp tục với phần đánh giá: Hệ thống được kiểm thử tự động với **97 test case**, đạt **độ phủ mã nguồn tuyệt đối 100%**. Dưới mô hình đe dọa STRIDE, em đã mô phỏng **33 kịch bản tấn công thực tế**—như chỉnh sửa proof Merkle hay làm giả chữ ký. **Toàn bộ 33/33 kịch bản đều bị hệ thống phát hiện và từ chối thành công**."

---

### SLIDE 16: EMPIRICAL EVALUATION: SCENARIOS A–E
* **Tiêu đề:** EMPIRICAL EVALUATION: SCENARIOS A–E
* **Thời lượng:** ~35 giây | ~55 từ

#### 🌟 Key Highlights:
- Tốc độ ký (Scenario A): 809 bằng/giây.
- Thời gian xử lý đợt 10,000 bằng (Scenario B): 27.54 giây.
- Độ trễ xác minh offline (Scenario C): Chỉ 5.50 ms trong trình duyệt.

#### 🇬🇧 English Script:
> "Our empirical benchmarks across five scenarios validate our performance: In Scenario A, our cryptographic engine reached a peak throughput of **809 credentials per second**. In Scenario B, the end-to-end off-chain issuance of **10,000 credentials completed in just 27.54 seconds**. Most crucially, in Scenario C, single credential verification took an average of **only 5.50 milliseconds** offline in the browser."

#### 🇻🇳 Bản Tiếng Việt:
> "Kết quả đo đạc thực nghiệm qua 5 kịch bản chứng minh hiệu năng vượt trội: Ở kịch bản A, tốc độ ký số đạt đỉnh **809 bằng/giây**. Ở kịch bản B, quy trình cấp phát off-chain cho **10,000 sinh viên hoàn thành chỉ trong 27.54 giây**. Quan trọng nhất, ở kịch bản C, việc xác minh một chứng chỉ chỉ tốn trung bình **5.50 mili-giây** hoàn toàn offline ngay trong trình duyệt."

---

### SLIDE 17: ON-CHAIN COST AND LIVE SEPOLIA VALIDATION
* **Tiêu đề:** ON-CHAIN COST AND LIVE SEPOLIA VALIDATION
* **Thời lượng:** ~35 giây | ~50 từ

#### 🌟 Key Highlights:
- Độ phức tạp $O(1)$: Chi phí neo không đổi bất kể quy mô khóa học.
- **Tiết kiệm 1,430× gas** so với Phase 2 (từ 240 triệu gas xuống 167,804 gas cho 10k bằng).
- Trung bình chỉ **~16.8 gas / bằng** (~0.56 USD trên Sepolia).

#### 🇬🇧 English Script:
> "On-chain cost scaling is our primary engineering milestone. By anchoring a single Merkle root, costs scale with **O(1) constant complexity**. For 10,000 students, gas dropped from 240 million gas in Phase 2 down to **167,804 gas**—a **1,430-fold reduction**. In our live deployment on Ethereum Sepolia block 11,654,826, anchoring cost only **0.00019 ETH**, or roughly **56 cents**, averaging **16.8 gas per student**."

#### 🇻🇳 Bản Tiếng Việt:
> "Tối ưu hóa chi phí on-chain là cột mốc kỹ thuật quan trọng nhất: Nhờ neo duy nhất Merkle root, chi phí đạt **độ phức tạp hằng số O(1)**. Cho 10,000 sinh viên, lượng gas giảm từ 240 triệu gas ở Phase 2 xuống còn **167,804 gas**—nghĩa là **tiết kiệm hơn 1,430 lần**. Trên mạng Ethereum Sepolia thật tại block 11,654,826, việc neo chỉ tốn **0.00019 ETH** (~**0.56 USD**), bình quân chỉ **16.8 gas cho mỗi sinh viên**."

---

### SLIDE 18: LIMITATIONS & DESIGN RATIONALE
* **Tiêu đề:** 6 – EVALUATION, LIMITATION, FUTURE WORK: Limitations
* **Thời lượng:** ~35 giây | ~55 từ

#### 🌟 Key Highlights:
- Trình bày trung thực 5 giới hạn kỹ thuật và giải thích **Trade-off có chủ đích**:
  1. Signer Kill-Switch: Chặn khẩn cấp rò rỉ khóa.
  2. Off-Chain Storage: Giữ bảo mật và tiết kiệm gas.
  3. No Holder Binding: Trải nghiệm không cần ví Web3.
  4. Binary Disclosure: Chưa hỗ trợ ZK range proof (GPA >= 3.0).
  5. No Usability Study: Tập trung sâu vào tính đúng đắn kỹ thuật.

#### 🇬🇧 English Script:
> "We openly document our system limitations and engineering trade-offs: Our **binary signer kill-switch** provides instant containment for leaked keys, while routine turnover is managed off-chain. **Credentials reside off-chain** to protect student privacy and avoid recurring storage fees. We omitted **cryptographic holder binding** to ensure zero-friction adoption without crypto wallets. And we opted for **binary disclosure** rather than zero-knowledge range proofs to avoid heavy client-side computation."

#### 🇻🇳 Bản Tiếng Việt:
> "Em phân tích thẳng thắn các hạn chế và sự đánh đổi kỹ thuật có chủ đích: Cơ chế **Signer kill-switch nhị phân** giúp thu hồi khẩn cấp tức thì nếu lộ khóa, còn luân chuyển cán bộ được xử lý ở tầng off-chain. **Bằng lưu trữ off-chain** để bảo vệ riêng tư và tránh phí lưu trữ định kỳ. Hệ thống chưa bắt buộc **ràng buộc ví người nắm giữ** để sinh viên không gặp rào cản ví Web3. Và hệ thống chọn **tiết lộ nhị phân** thay vì ZK range proof để tránh làm nặng trình duyệt."

---

### SLIDE 19: FUTURE DIRECTIONS
* **Tiêu đề:** FUTURE DIRECTIONS
* **Thời lượng:** ~30 giây | ~45 từ

#### 🌟 Key Highlights:
- 5 hướng mở rộng: Layer 2 (giảm thêm 50-100x phí), ZK range proofs, W3C VC v2.0 & DIDs, Ví di động Secure Enclave, Liên minh cấp bằng đại học.

#### 🇬🇧 English Script:
> "For future work, we see five exciting directions: First, deploying on **Ethereum Layer 2 rollups** like Arbitrum or Base for another 50-to-100x cost reduction. Second, integrating **Zero-Knowledge range proofs** for GPA verification. Third, aligning with **W3C VC version 2.0 and DIDs** for international accreditation. Fourth, building a **native mobile wallet** with hardware Secure Enclaves. And finally, establishing a **cross-university credential consortium**."

#### 🇻🇳 Bản Tiếng Việt:
> "Về hướng nghiên cứu tương lai, đề tài mở ra 5 triển vọng: Thứ nhất, triển khai lên **Layer 2 (Arbitrum hoặc Base)** để giảm thêm 50 đến 100 lần chi phí. Thứ hai, tích hợp **Zero-Knowledge range proof** để chứng minh điểm số. Thứ ba, chuẩn hóa theo **W3C VC v2.0 và DID** để liên thông quốc tế. Thứ tư, phát triển **ứng dụng ví di động** tận dụng chip bảo mật Secure Enclave. Và cuối cùng là xây dựng **liên minh cấp bằng liên trường** giữa các đại học."

---

### SLIDE 20: CONCLUSION
* **Tiêu đề:** CONCLUSION
* **Thời lượng:** ~30 giây | ~50 từ

#### 🌟 Key Highlights:
- Đạt được: 16.8 gas/bằng, xác minh dưới 6ms, an toàn toán học.
- Bài học: Cân bằng giữa lý thuyết mật mã và thực tế triển khai kỹ nghệ phần mềm.

#### 🇬🇧 English Script:
> "In conclusion, my capstone project designed and deployed the BK Credential System Phase 3 on Ethereum Sepolia. We demonstrated that decentralized credential verification can achieve high throughput, sub-6 millisecond latency, and an amortized cost of **only 16.8 gas per student**. More importantly, this work gave me valuable experience in balancing theoretical cryptography with production software engineering."

#### 🇻🇳 Bản Tiếng Việt:
> "Tóm lại, đồ án tốt nghiệp của em đã thiết kế và triển khai thành công hệ sinh thái BK Credential Phase 3 trên mạng Ethereum Sepolia. Đề tài chứng minh việc xác minh văn bằng phi tập trung hoàn toàn có thể đạt hiệu năng cao, độ trễ dưới 6 mili-giây, và chi phí bình quân **chỉ 16.8 gas cho mỗi sinh viên**. Quan trọng hơn cả, đồ án đã mang lại cho em kinh nghiệm quý báu trong việc cân bằng giữa lý thuyết mật mã và thực tế kỹ nghệ phần mềm."

---

### SLIDE 21: THANK YOU & Q&A
* **Tiêu đề:** THANK YOU
* **Thời lượng:** ~30 giây | ~50 từ

#### 🌟 Key Highlights:
- Lời tri ân gửi tới Thầy hướng dẫn PGS. TS. Phạm Hoàng Anh.
- Tinh thần cầu thị, khiêm tốn của sinh viên và trân trọng mời Hội đồng phản biện.

#### 🇬🇧 English Script:
> "To conclude, I would like to express my deepest gratitude to my advisor, **Associate Professor Doctor Pham Hoang Anh**, for his dedicated guidance, encouragement, and invaluable advice throughout this project. Although I have tried my best, my knowledge and practical experience are still developing, so this work inevitably has limitations. I am very eager to receive your valuable comments and critiques so I can improve this project further. **Thank you very much, and I welcome any questions from the committee!**"

#### 🇻🇳 Bản Tiếng Việt:
> "Em xin gửi lời cảm ơn chân thành và sâu sắc nhất đến thầy **PGS. TS. Phạm Hoàng Anh** đã nhiệt tình hướng dẫn, định hướng và giúp đỡ em hoàn thiện đồ án tốt nghiệp này. Tuy bản thân đã hết sức cố gắng nhưng với kiến thức và kinh nghiệm còn hạn chế, chắc chắn đồ án của em không thể tránh khỏi những thiếu sót. Em rất mong nhận được những ý kiến đóng góp quý báu của quý thầy cô để bản đồ án của em được hoàn thiện hơn nữa. **Em xin chân thành cảm ơn quý thầy cô và các bạn đã chú ý lắng nghe!**"
