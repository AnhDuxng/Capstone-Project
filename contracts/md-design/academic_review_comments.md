# Báo Cáo Nhận Xét & Phản Biện Luận Văn Tốt Nghiệp

- **Đề tài:** *Design and Implementation of a Digital Credential Issuance Solution Using Blockchain Technology*
- **Sinh viên thực hiện:** Hồ Anh Dũng (MSSV: 2052921)
- **Cán bộ hướng dẫn:** PGS. TS. Phạm Hoàng Anh
- **Đơn vị:** Khoa Khoa học và Kỹ thuật Máy tính, Trường Đại học Bách Khoa – ĐHQG-HCM
- **Thời gian đánh giá:** 10/2026

---

## TỔNG QUAN ĐÁNH GIÁ (EXECUTIVE SUMMARY)

Bản luận văn thể hiện khối lượng công việc kỹ thuật lớn, có tính hoàn thiện sản phẩm cao:
- Chuyển dịch kiến trúc từ Giai đoạn 2 (SD-JWT VC + IPFS) sang Giai đoạn 3 (EIP-712 + Merkle Tree Batching + On-Chain Bitmap Revocation).
- Đạt kết quả thực nghiệm ấn tượng: giảm chi phí gas cấp phát xuống xấp xỉ $16.8$ gas/chứng chỉ (giảm hơn $1.400\times$), thông lượng ký đạt $\sim 809$ creds/s, xác minh offline $\sim 5.5$ ms.
- Triển khai và kiểm chứng thực tế trên testnet Ethereum Sepolia, đạt 100% test coverage và vượt qua 33 kịch bản tấn công giả lập.
- Có thực hiện **Ablation Study** (Mục 5.7) để phân rã đóng góp hiệu năng của từng thành phần kiến trúc.

Tuy nhiên, dưới góc độ phản biện học thuật khắt khe, bản thảo hiện tại còn tồn tại một số **lỗ hổng bảo mật lý thuyết, mâu thuẫn giữa văn bản và smart contract, và lỗi trích dẫn tài liệu tham khảo nghiêm trọng**.

---

## 1. CẤU TRÚC VÀ LOGIC (STRUCTURE & FLOW)

### 1.1. Lặp lại nội dung so sánh "Phase 2 vs. Phase 3" quá nhiều lần
- **Vị trí:** Bảng 1.2 (Chương 1, Trang 10), Bảng 3.1 (Chương 3, Trang 34), Bảng 3.2 (Chương 3, Trang 39), Bảng 5.10 (Chương 5, Trang 69).
- **Phân tích:** Việc lặp lại liên tục các bảng so sánh Phase 2 và Phase 3 ở hầu hết các chương làm loãng mạch văn và tạo cảm giác người viết dùng cùng một dữ liệu để tăng dung lượng trang.
- **Gợi ý sửa đổi:**
  - **Chương 1 (Mục 1.5):** Giữ Bảng 1.2 ở mức so sánh **kiến trúc & khái niệm** (Architectural & Design Principles).
  - **Chương 3 (Mục 3.1.2):** Lược bỏ Bảng 3.1 hoặc rút gọn thành mô tả ngắn; tập trung vào sơ đồ luồng dữ liệu (Dataflow) và thiết kế Smart Contract.
  - **Chương 5 (Mục 5.6):** Bảng 5.10 chỉ tập trung vào **số liệu thực nghiệm định lượng thực tế** (Gas thực tế, Latency đo đạc, Throughput).

### 1.2. Đưa nội dung Quản lý Dự án (Gantt Chart) vào thân bài luận văn
- **Vị trí:** Mục 6.1 (*Summary of Completed Milestones Across 15 Weeks*, Trang 73) và Mục 6.2 (*Master Project Gantt Chart*, Trang 76).
- **Phân tích:** Trong luận văn tốt nghiệp ĐH Bách Khoa, Chương 6 là chương **Thảo luận, Hạn chế và Hướng phát triển** (*Discussion, Limitations, and Future Directions*). Việc liệt kê lịch trình 15 tuần kèm bảng công việc và biểu đồ Gantt mang tính chất báo cáo tiến độ đồ án/thực tập, làm giảm tính học thuật của chương tổng kết.
- **Gợi ý sửa đổi:** Chuyển toàn bộ Mục 6.1 và Mục 6.2 xuống **Appendix C (Project Timeline and Management Deliverables)**. Mở đầu Chương 6 bằng việc tóm lược cô đọng các đóng góp khoa học và kỹ thuật đạt được.

### 1.3. Kết nối giữa Tổng quan và Cơ sở lý thuyết ở Chương 2
- **Vị trí:** Đầu Chương 2 (Trang 13) và Mục 2.1.5 (Trang 18).
- **Phân tích:** Chương 2 kết hợp cả *Related Work* (BlockCerts, OpenCerts, EBSI) và *Theoretical Foundations* (EIP-712, Merkle, SD-JWT, Bitmap) nhưng thiếu đoạn văn chuyển tiếp làm rõ tại sao lại chọn các công nghệ này.
- **Gợi ý sửa đổi:** Bổ sung đoạn cầu nối ở cuối Mục 2.1.5:
  > *"Based on the architectural limitations of existing systems identified in Table 2.1, Section 2.2 through Section 2.9 establish the theoretical foundations and cryptographic building blocks chosen to resolve these bottlenecks in the BK Credential System."*

---

## 2. TÍNH HỌC THUẬT VÀ NỘI DUNG (ACADEMIC CONTENT)

### 2.1. Thiếu các Câu hỏi Nghiên cứu (Research Questions - RQs)
- **Vị trí:** Mục 1.2 (Trang 2–3).
- **Phân tích:** Hiện tại phần mở đầu chỉ liệt kê các Mục tiêu kỹ thuật ($O_1 - O_6$), thuần túy mang tính kỹ thuật phần mềm (Engineering tasks) mà thiếu đi các câu hỏi nghiên cứu định hướng khoa học.
- **Gợi ý sửa đổi:** Cấu trúc lại và bổ sung 3 câu hỏi nghiên cứu (RQs) ở Mục 1.2:
  - **RQ1 (Scalability & Gas Cost):** *Làm thế nào để giảm thiểu chi phí lưu trữ trạng thái cấp phát và thu hồi văn bằng trên blockchain về độ phức tạp $O(1)$ mà không phụ thuộc vào hạ tầng lưu trữ phân tán bên ngoài (IPFS)?*
  - **RQ2 (Attribute Privacy):** *Cơ chế cam kết băm kèm muối (Salted-Hash Commitment) trên nền tảng EIP-712 có thể bảo đảm tính toàn vẹn chữ ký đồng thời hỗ trợ tiết lộ thuộc tính chọn lọc (Selective Disclosure) với độ trễ client-side tối ưu như thế nào?*
  - **RQ3 (Security & Threat Boundaries):** *Hệ thống có thể kháng cự các dạng tấn công va chạm preimage, giả mạo danh tính tổ chức phát hành và tấn công phát lại (replay attack) trong môi trường EVM ra sao?*

### 2.2. Thiếu đối sánh với các chuẩn mật mã tiên tiến trong SSI (BBS+ Signatures)
- **Vị trí:** Mục 2.7.2 (Trang 28–29) và Mục 6.3.5 (Trang 79–80).
- **Phân tích:** Khi thảo luận về Selective Disclosure, tác giả mới chỉ so sánh Salted-Hash với SD-JWT và Zero-Knowledge Proofs (zk-SNARKs). Trong lĩnh vực Verifiable Credentials, chuẩn **BBS+ Signatures** (với tính năng zero-knowledge unlinkable selective disclosure) là đối thủ so sánh trực tiếp quan trọng.
- **Gợi ý sửa đổi:** Bổ sung phân tích tại Mục 2.7.2:
  - BBS+ Signatures yêu cầu các phép toán trên đường cong ghép cặp (Pairing-friendly elliptic curves như BLS12-381), đòi hỏi thư viện WebAssembly nặng và chi phí tính toán cao, đồng thời chưa có precompile rẻ trên EVM Mainnet.
  - Salted Keccak-256 Commitments kết hợp ECDSA secp256k1 là các phép toán native trên EVM, tối ưu hóa tuyệt đối cho tài nguyên trình duyệt phổ thông.

---

## 3. NGÔN NGỮ VÀ VĂN PHONG HỌC THUẬT (TONE & STYLE)

### 3.1. Mâu thuẫn nghiêm trọng về Ngôi xưng Tác giả (Authorship Inconsistency)
- **Vị trí:**
  - Trang 3 (*Statement of Authorship*): *"I hereby declare that the work presented in this report is **my own original research**... Author: Ho Anh Dung"* $\rightarrow$ Khẳng định đồ án cá nhân 1 tác giả.
  - Trang 16, 19, 73, 82, 97: Sử dụng liên tục các đại từ số nhiều: *"In Phase 2, **we** designed..."*, *"**our team** evolved the project..."*, *"provided **us** with valuable experience..."*.
- **Nguy cơ:** Hội đồng có thể chất vấn về quyền tác giả (đây là đồ án làm chung nhóm hay làm một mình).
- **Gợi ý sửa đổi:**
  - *Thay vì:* *"Through this journey, our team evolved the project from theoretical concepts..."* (Trang 73)
  - *Nên sửa thành:* *"Through this research, the project was systematically evolved from theoretical concepts..."* hoặc *"Through this investigation, the author developed..."*.
  - *Thay vì:* *"provided us with valuable experience"* (Trang 97)
  - *Nên sửa thành:* *"provided valuable engineering insights into balancing theoretical cryptographic guarantees with production software constraints."*.

### 3.2. Sử dụng từ ngữ mang tính chủ quan, phóng đại
- **Vị trí:**
  - Trang vi (*Abstract*): *"proving the system to be a practical, **robust, and scalable** solution for **national and institutional** credential management."*
  - Trang 59 (Tiêu đề Mục 5.3): *"Exhaustive Empirical Evaluation"*.
  - Trang 73: *"successfully achieved **100%** of all research, engineering, and empirical objectives."*
- **Gợi ý sửa đổi:**
  - Đổi tiêu đề: *"Empirical Performance Evaluation and Benchmarking"*.
  - Hạ tông khẳng định quy mô quốc gia: *"for institutional-scale academic credential management"* (thay vì "national").

---

## 4. ĐIỂM YẾU VÀ THÁCH THỨC (WEAKNESSES & RED FLAGS — PHẢN BIỆN KHÓ TÍNH)

### ⚠️ RED FLAG 1: Lỗ hổng tiềm ẩn do dùng `abi.encodePacked` với nhiều chuỗi động
- **Vị trí:** Trang 28, Mục 2.7.1:
  $$\text{commitment} = \text{keccak256}(\text{abi.encodePacked}(\text{salt}, \text{key}, \text{value}))$$
- **Lỗ hổng (Cryptographic Hash Collision Vulnerability):**
  Trong Solidity và Web3 cryptography, `abi.encodePacked` ghép nối các mảng byte mà không kèm tiền tố độ dài (length prefix). Khi có từ 2 tham số kiểu động (`string` hoặc `bytes`) đứng liền nhau (`key` và `value`), sẽ xảy ra hiện tượng **Hash Collision**:
  $$\text{abi.encodePacked}(\text{salt}, \text{"firstName"}, \text{"VanA"}) \equiv \text{abi.encodePacked}(\text{salt}, \text{"first"}, \text{"NameVanA"})$$
- **Hành động sửa đổi bắt buộc:**
  - Sửa công thức trong văn bản (Trang 28, Trang 43):
    $$\text{commitment} = \text{keccak256}(\text{abi.encode}(\text{salt}, \text{key}, \text{value}))$$
  - Trong TypeScript SDK: sử dụng `ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'string', 'string'], [salt, key, value])` thay vì `solidityPackedKeccak256`.

---

### ⚠️ RED FLAG 2: Mâu thuẫn logic giữa Trạng thái Thu hồi Signer và Mã nguồn Smart Contract
- **Vị trí:**
  - Trang 36 & Trang 77 (Mục 6.3.1): Phân tích rằng khi Signer bị thu hồi, hệ thống phải đối chiếu mốc thời gian $\text{assignedAt} \le \text{anchoredAt} < \text{revokedAt}$ để bảo đảm văn bằng cũ của Thầy Hiệu trưởng tiền nhiệm vẫn hợp lệ sau khi Thầy hết nhiệm kỳ.
  - Trang 47, Mã nguồn thực tế của `IssuerRegistry.sol`:
    ```solidity
    function revokeSigner(address signer) external onlyOwner {
        if (!isSigner[signer]) revert NotSigner(signer);
        isSigner[signer] = false;
        emit SignerRevoked(signer);
    }
    ```
  - Trang 55, Bảng 3.3 (Bước 7 trong Pipeline): Kiểm tra on-chain `isSigner(recoveredAddress)`.
- **Mâu thuẫn:**
  Trong code hiện tại, `isSigner` chỉ là biến cờ `bool`. Khi gọi `revokeSigner(deanAddress)`, `isSigner` lập tức thành `false`. Do đó, **toàn bộ văn bằng phát hành hợp lệ trong quá khứ của người ký đó sẽ bị từ chối ngay ở Bước 7 (`SIGNER_NOT_REGISTERED`)!**
- **Chiến lược trả lời phản biện / Sửa đổi:**
  - Phải phân định rõ: *Mã nguồn hiện tại cài đặt cơ chế Emergency Kill-Switch (dành cho trường hợp khóa ký bị lộ). Giải pháp Timestamp Validity Window đã được xác định là hướng hoàn thiện bắt buộc tại Mục 6.3.1 để hỗ trợ luân chuyển nhân sự.*
  - Nếu sửa được hợp đồng: Đổi `mapping(address => bool) public isSigner` thành `struct SignerRecord { bool active; uint64 validFrom; uint64 validTo; }`.

---

### ⚠️ RED FLAG 3: Vấn đề "Thiếu ràng buộc người sở hữu" (Absence of Holder Binding)
- **Vị trí:** Trang 79, Mục 6.3.4.
- **Vấn đề phản biện:**
  Credential là tệp JSON độc lập không ràng buộc khóa riêng của sinh viên. Nếu Sinh viên A chuyển tệp JSON của mình cho Sinh viên B, Sinh viên B có thể nộp cho nhà tuyển dụng nhận là bằng của mình nếu nhà tuyển dụng không đối chiếu CCCD/Identity ngoài đời.
- **Chiến lược trả lời phản biện:**
  Nhấn mạnh rằng: Hệ thống ưu tiên giải quyết bài toán chống làm giả bằng cấp và UX người dùng phổ thông (thông qua Privy passwordless email login). Việc chứng minh quyền sở hữu danh tính được chuyển tiếp về bước kiểm tra đối chiếu hồ sơ ứng viên (Applicant Identity Matching) của bên tuyển dụng, tương tự văn bằng giấy truyền thống.

---

### ⚠️ RED FLAG 4: Phụ thuộc CSDL tập trung (Neon Serverless PostgreSQL)
- **Vị trí:** Trang 56 (Mục 4.5.2) và Hình 4.1 (Trang 52).
- **Vấn đề phản biện:**
  Tác giả tuyên bố loại bỏ IPFS để đạt "Trustless Verification", nhưng toàn bộ muối ngẫu nhiên (`DisclosureV3`) lại lưu ở CSDL đám mây Neon. Nếu máy chủ Neon bị tấn công hoặc rò rỉ CSDL, tính bảo mật của toàn bộ các thuộc tính ẩn (PII) sẽ bị ảnh hưởng.
- **Gợi ý sửa đổi:**
  Làm rõ cơ chế phòng thủ: Trên CSDL tập trung, các bản ghi disclosure của sinh viên cần được mã hóa bằng khóa riêng của sinh viên (Client-side encrypted blob) hoặc người học tự lưu trữ presentation JSON của mình trên thiết bị cá nhân.

---

## 5. ĐỊNH DẠNG VÀ TRÍCH DẪN (FORMATTING & CITATIONS)

### 🔴 LỖI NGHIÊM TRỌNG 1: Trùng lặp hàng loạt tài liệu tham khảo trong References
Trong danh mục tài liệu tham khảo (Trang 98–103), có hiện tượng trùng lặp key hàng loạt do gộp file `.bib`:
- **[1] và [2]:** Cả hai đều là bài báo *A. Grech and A. F. Camilleri (2017)*.
- **[12], [31], [32]:** Cả ba đều là *W3C Verifiable Credentials Data Model v2.0 (2025)*.
- **[13] và [34]:** Cả hai đều là *SD-JWT RFC 9901 (2025)*.
- **[14] và [35]:** Cả hai đều là *draft-ietf-oauth-sd-jwt-vc-16 (2026)*.
- **[16] và [36]:** Cả hai đều là sách *Bitcoin and Cryptocurrency Technologies (Princeton, 2016)*.
- **[17] và [37]:** Cả hai đều là *Ethereum White Paper (Buterin, 2014)*.
- **[18] và [38]:** Cả hai đều là *Ethereum Yellow Paper (Wood, 2014)*.
- **[22] và [39]:** Cả hai đều là *EIP-712 standard (2017)*.
- **[23] và [40]:** Cả hai đều là thư viện *@openzeppelin/merkle-tree (2024)*.
- **[24] và [41]:** Cả hai đều là tài liệu *OpenZeppelin Contracts v5.x (2024)*.
- **[25], [26] và [42]:** Đều là tài liệu/bài báo về công cụ *Slither*.
- **[46] và [47]:** Cả hai đều là tài liệu *IPFS (Benet, 2014)*.
- **[53] và [54]:** Cả hai đều là *EIP-5192 Minimal Soulbound NFTs (2022)*.

### 🔴 LỖI NGHIÊM TRỌNG 2: Xuất hiện các trích dẫn "Ảo" / Hoàn toàn không liên quan (Ghost Citations)
Tại trang 103 của bản in, xuất hiện các tài liệu tham khảo hoàn toàn không có mối liên hệ với đề tài Blockchain/Credential:
- **[58] J. J. Hopfield (1987):** *Mạng nơ-ron hồi quy Hopfield cổ điển trong AI*.
- **[59] C. Castillo et al. (2011):** *Đánh giá độ tin cậy thông tin trên Twitter*.
- **[60] T. N. Kipf & M. Welling (2016):** *Mạng nơ-ron đồ thị tích chập (Graph Convolutional Networks - GCN)*.
- **[61] A. Rajaraman & J. D. Ullman (2011):** *Sách Khai phá dữ liệu (Mining of Massive Datasets)*.

> **Hành động bắt buộc:** Kiểm tra lại tệp `thesiscite.bib`, loại bỏ hoàn toàn các mục [58]--[61] và dọn dẹp các mục trùng lặp trước khi xuất bản bản in chính thức.

---

## BẢNG KẾ HOẠCH HÀNH ĐỘNG KHẮC PHỤC (ACTION PLAN)

| Mức độ ưu tiên | Hạng mục công việc | Vị trí file cần sửa | Mục tiêu đạt được |
| :---: | :--- | :--- | :--- |
| 🔴 **Khẩn cấp** | Khử trùng lặp và xóa trích dẫn ảo trong `thesiscite.bib` | `DATN-253/thesiscite.bib` | Chuẩn hóa danh mục tài liệu tham khảo, loại bỏ hoàn toàn nguy cơ bị hội đồng đánh giá lỗi học thuật. |
| 🔴 **Khẩn cấp** | Sửa công thức băm tránh va chạm `abi.encodePacked` | `chap02.tex`, `chap03.tex` | Đổi sang `abi.encode` cho cam kết muối, đảm bảo an toàn mật mã học. |
| 🟡 **Quan trọng** | Thống nhất ngôi tác giả (Xóa "we", "our team") | `chap01.tex`, `chap06.tex`, `abstract.tex` | Đảm bảo tính nhất quán với *Statement of Authorship* (đồ án cá nhân). |
| 🟡 **Quan trọng** | Chuyển Gantt Chart và Lịch trình 15 tuần sang Phụ lục | `chap06.tex`, tạo `appendix_timeline.tex` | Giữ Chương 6 thuần túy học thuật (Discussion & Limitations). |
| 🟡 **Quan trọng** | Giải trình rõ logic Signer Revocation | `chap03.tex`, `chap06.tex` | Làm rõ sự khác biệt giữa Kill-Switch khẩn cấp và Luân chuyển nhân sự định kỳ. |
| 🟢 **Khuyến nghị** | Bổ sung 3 Research Questions (RQ1–RQ3) | `chap01.tex` (Mục 1.2) | Nâng tầm học thuật từ "báo cáo kỹ thuật" lên "nghiên cứu khoa học". |
