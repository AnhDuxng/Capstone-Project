# CẨM NANG CÂU HỎI & TRẢ LỜI PHẢN BIỆN BẢO VỆ ĐỒ ÁN TỐT NGHIỆP
## (CAPSTONE DEFENSE Q&A HANDBOOK — BILINGUAL)

- **Đề tài:** Design and Implementation of a Blockchain-Based Digital Certificate Issuance Solution (Phase 3)
- **Sinh viên:** Hồ Anh Dũng | **GVHD:** PGS. TS. Phạm Hoàng Anh
- **Mục tiêu tài liệu:** Chuẩn bị sẵn sàng câu trả lời cho các câu hỏi xoáy sâu vào **kiến trúc, mật mã, tính pháp lý, và triển khai thực tế** của Hội đồng bảo vệ.

---

## MỤC LỤC CÁC CÂU HỎI TRỌNG TÂM

### PHẦN I: KIẾN TRÚC & MẬT MÃ (CRYPTOGRAPHY & ARCHITECTURE)
1. [Tại sao chia chunk 500 credentials? N > 10,000 có bị chậm không?](#câu-1-chia-chunk-500)
2. [Cơ chế lật 1 bit trong dãy bitmap 256-bit on-chain hoạt động thế nào?](#câu-2-lat-bit-bitmap)
3. [Thu hồi hàng loạt (revokeBatch) khác gì thu hồi 1 bằng (revoke)?](#câu-3-revokebatch-vs-revoke)
4. [Tại sao dùng Double Hash cho Merkle Leaf mà không dùng Single Hash?](#câu-4-double-hash)
5. [Thành phần nào là nút thắt cổ chai lớn nhất về hiệu năng (Bottleneck)?](#câu-5-bottleneck-hieu-nang)

### PHẦN II: THỰC TẾ TRIỂN KHAI, BẢO MẬT & PHÁP LÝ (REAL-WORLD & LEGAL)
6. [Triển khai liên trường với nhiều định dạng bằng khác nhau như thế nào?](#câu-6-trien-khai-da-truong)
7. [Tại sao dùng USB Token mô phỏng (Keystore) thay vì USB PKI phần cứng chuyên dụng?](#câu-7-usb-token-hieu-truong)
8. [Nếu mất USB hoặc Hiệu trưởng hết nhiệm kỳ thì xử lý bằng cũ ra sao?](#câu-8-hieu-truong-het-nhiem-ky)
9. [Tại sao không lưu dữ liệu bằng lên Blockchain hay IPFS? Có vi phạm luật bảo vệ dữ liệu không?](#câu-9-tai-sao-dung-off-chain)
10. [Nếu sinh viên làm mất file JSON chứng chỉ thì làm sao lấy lại?](#câu-10-sinh-vien-mat-file-json)
11. [Tại sao test trên Sepolia mà không phải Ethereum Mainnet? Chi phí Mainnet có đắt không?](#câu-11-sepolia-vs-mainnet)

---

# CHI TIẾT CÂU HỎI & CÂU TRẢ LỜI MẪU

---

<a name="câu-1-chia-chunk-500"></a>
### ❓ CÂU 1: Về việc chia chunk 500 credentials
> **Giám khảo hỏi:** *"Em chia 10,000 sinh viên thành từng chunk 500 để làm gì? Nếu số lượng lớn hơn 10,000 mẫu (ví dụ 50,000 hay 100,000) thì việc cứ cắt nhỏ thành từng mẩu 500 rồi chạy tuần tự chẳng phải sẽ làm chậm quá trình phát hành hay sao?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra kiến thức về nền tảng Node.js (Event Loop, Memory Management) và tính toán khả năng mở rộng (Scalability).

#### 💡 Bản chất kỹ thuật:
- Node.js chạy **đơn luồng (Single-threaded)**. Nếu chạy đồng bộ 10,000 bản ghi, CPU sẽ bị chặn (blocked) trong 20–30 giây $\to$ Server không tiếp nhận được ai khác, trình duyệt bị timeout 504, và không kích hoạt được dọn rác (GC) $\to$ Tràn RAM V8 Heap.
- Cắt chunk 500 giúp giải phóng Event Loop giữa các chunk (`setImmediate`), dọn dẹp RAM liên tục $\to$ **RAM luôn an toàn dưới 250 MB**.
- Chi phí chuyển giao giữa các chunk là cực nhỏ (< 0.1% tổng thời gian). Tốc độ vẫn đạt đỉnh **809 bằng/giây**.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, việc chia chunk 500 là giải pháp bắt buộc để đảm bảo **tính sẵn sàng (Availability) và an toàn bộ nhớ (Memory Safety)** của Node.js:
> 1. Vì Node.js chạy đơn luồng, nếu xử lý đồng bộ 10,000 sinh viên cùng lúc, server sẽ bị nghẽn hoàn toàn trong gần 30 giây, khiến các request khác bị timeout và dễ bị lỗi tràn bộ nhớ V8 Heap.
> 2. Chia thành các khối 500 giúp Event Loop được giải phóng đều đặn giữa các chunk để dọn rác bộ nhớ, nhờ đó RAM của server luôn duy trì **an toàn dưới 250 MB**.
> 3. Về tốc độ: Chi phí phân mảnh 20 chunk chỉ tốn chưa tới 20 mili-giây (dưới 0.1% tổng thời gian). Thực nghiệm kịch bản A với 50,000 mẫu chứng minh tốc độ vẫn tăng trưởng tuyến tính và đạt đỉnh **809 bằng/giây**. Ở quy mô lớn hơn nữa, mô hình này dễ dàng mở rộng sang hàng đợi phân tán BullMQ đa worker để xử lý song song trên nhiều CPU core ạ."

#### 🇬🇧 Answer (English):
> "Thank you for the question. Chunking into 500 credentials is a deliberate design choice for **Node.js event-loop responsiveness and memory safety**:
> 1. Because Node.js is single-threaded, processing 10,000 records synchronously would block the event loop for nearly 30 seconds, causing gateway timeouts and memory exhaustion.
> 2. Chunking allows the V8 engine to yield execution and trigger garbage collection between chunks, capping heap memory strictly **under 250 MB**.
> 3. It does not degrade throughput: our benchmarks up to 50,000 samples prove that chunk overhead is less than 0.1%, maintaining a linear throughput of **809 credentials per second**. For production cohorts exceeding 50,000, this architecture easily scales out using distributed workers like Redis-backed BullMQ across multiple CPU cores."

---

<a name="câu-2-lat-bit-bitmap"></a>
### ❓ CÂU 2: Thao tác lật 1 bit trong dãy 256-bit on-chain
> **Giám khảo hỏi:** *"Em giải thích rõ hơn: việc gọi hàm `revoke` trên `CredentialRegistryV3` để lật 1 bit trong dãy 256-bit bitmap on-chain thực chất là làm cái gì trong EVM?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra xem sinh viên có hiểu kiến trúc bộ nhớ lưu trữ của máy ảo Ethereum (EVM Storage Slots) hay không.

#### 💡 Bản chất kỹ thuật:
- EVM lưu trữ dữ liệu theo từng ô nhớ **256 bit (`uint256`)**.
- Mỗi bằng có 1 số thứ tự `index` (0 đến $N-1$).
- Hợp đồng tìm vị trí bằng phép toán bit:
  - `wordIndex = index / 256` (Tìm slot nhớ thứ mấy).
  - `bitMask = 1 << (index % 256)` (Tìm vị trí bit từ 0 đến 255).
- Thao tác: `bitmap |= bitMask` (Lật bit tương ứng từ 0 thành 1).
- **256 sinh viên dùng chung 1 slot nhớ**. Tiết kiệm gas gấp 9 lần so với lưu mapping rời rạc.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, trong EVM, mỗi ô nhớ lưu trữ chuẩn (Storage Slot) có độ dài đúng 256 bit (`uint256`):
> 1. Trong hợp đồng `CredentialRegistryV3`, mỗi sinh viên trong batch được gán một số thứ tự `index` từ 0 đến $N-1$.
> 2. Khi gọi `revoke(merkleRoot, index)`, hợp đồng xác định từ nhớ thứ mấy bằng phép chia: `wordIndex = index / 256`, và tạo mặt nạ bit: `bitMask = 1 << (index % 256)`.
> 3. Sau đó, hàm thực hiện phép toán bitwise OR: `bitmap |= bitMask` để lật bit tại vị trí đó từ 0 thành 1.
> 4. Nhờ cơ chế này, **256 sinh viên dùng chung duy nhất 1 slot nhớ**. Khi kiểm tra `isRevoked`, hợp đồng chỉ cần dùng phép bitwise AND `(bitmap & bitMask) != 0`. Cách này giúp tiết kiệm gas gấp **9 lần** so với việc dùng mapping độc lập như OpenCerts ạ."

#### 🇬🇧 Answer (English):
> "In Ethereum, each storage slot natively holds 256 bits (`uint256`).
> 1. Each credential in a batch is assigned an integer `index` from 0 to $N-1$.
> 2. When `revoke(merkleRoot, index)` is called, the contract computes: `wordIndex = index / 256` to locate the storage slot, and `bitMask = 1 << (index % 256)` to locate the exact bit.
> 3. It then executes a bitwise OR operation: `bitmap |= bitMask`, flipping that specific bit from 0 to 1.
> 4. As a result, **256 credentials share a single storage slot**. Checking status with `(bitmap & bitMask) != 0` is an instantaneous $O(1)$ read. This makes our bitmap revocation **9 times cheaper** in gas than traditional on-chain mappings."

---

<a name="câu-3-revokebatch-vs-revoke"></a>
### ❓ CÂU 3: Thu hồi hàng loạt (revokeBatch) vs Thu hồi 1 bằng (revoke)
> **Giám khảo hỏi:** *"Việc thu hồi hàng loạt bằng (`revokeBatch`) có cùng cơ chế với thu hồi 1 bằng không? Tại sao em không dùng một vòng lặp ở ngoài frontend để gọi hàm `revoke` nhiều lần mà phải viết riêng hàm `revokeBatch` trong Smart Contract?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra hiểu biết về chi phí Transaction Base Fee (21k gas), kiểm tra quyền (Access Control) và tính nguyên tử (Atomicity) trong Blockchain.

#### 💡 Bản chất kỹ thuật:
- Cùng gọi hàm nội bộ `_revokeInternal` để bật bit.
- Nếu gọi $k$ lần ở ngoài frontend: Tốn $k \times 21,000$ gas base fee, tốn $k$ lần kiểm tra quyền `onlySigner`, và người dùng phải bấm xác nhận ví $k$ lần.
- Gom vào `revokeBatch`: Chỉ tốn 1 giao dịch duy nhất. Đặc biệt, nếu các bằng nằm chung trong cùng 1 slot nhớ 256-bit, EVM chỉ tốn phí ghi "warm write", tiết kiệm thêm hàng chục ngàn gas!

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, về cơ chế cốt lõi thì `revokeBatch` và `revoke` hoàn toàn đồng nhất: đều gọi hàm nội bộ `_revokeInternal` để bật bit trên bitmap.
> Tuy nhiên, em tạo riêng hàm `revokeBatch` vì 2 lý do kỹ thuật:
> 1. **Tiết kiệm Gas vượt trội:** Gọi $k$ lần ở frontend sẽ chịu $k$ lần phí cơ sở 21,000 gas và $k$ lần kiểm tra quyền `onlySigner`. Gom vào 1 transaction giúp giảm đáng kể chi phí. Đặc biệt, khi các bằng bị thu hồi nằm trong cùng 1 slot 256-bit, EVM được tối ưu ghi slot ấm (warm write), giúp thu hồi 4 bằng cùng lúc chỉ tốn ~90k gas thay vì hơn 220k gas.
> 2. **Tính nguyên tử (Atomicity):** Quản trị viên chỉ cần bấm ký MetaMask đúng 1 lần duy nhất, và giao dịch đảm bảo nguyên tử: hoặc thành công tất cả, hoặc revert toàn bộ nếu có lỗi ạ."

#### 🇬🇧 Answer (English):
> "Both functions share the exact same underlying logic: calling `_revokeInternal` to flip bits in the bitmap. 
> However, implementing a dedicated `revokeBatch` inside the smart contract provides two crucial advantages:
> 1. **Massive Gas Optimization**: Sending $k$ individual transactions incurs $k$ times the 21,000 base transaction fee and repeated authorization checks. `revokeBatch` packs everything into **one single transaction**. Furthermore, when multiple revoked indices share the same 256-bit word, they benefit from warm storage writes, cutting gas costs dramatically (e.g., revoking 4 credentials costs only ~90k gas instead of ~220k gas).
> 2. **Atomicity and UX**: The registrar signs only once in MetaMask, and the entire batch revocation executes atomically—either all succeed or revert completely."

---

<a name="câu-4-double-hash"></a>
### ❓ CÂU 4: Tại sao dùng Double Hash cho Merkle Leaf?
> **Giám khảo hỏi:** *"Tại sao em lại băm 2 lần `keccak256(keccak256(data))` cho lá Merkle (Double Hash) thay vì băm 1 lần (Single Hash)? Nó có ưu điểm gì hay có làm chậm hệ thống không?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra kiến thức mật mã học nâng cao về cấu trúc cây Merkle và các lỗ hổng smart contract (Second-Preimage Attack - SWC-125).

#### 💡 Bản chất kỹ thuật:
- Trong cây Merkle, node nội (internal node) là mã băm của 2 node 32-byte: `H = keccak256(left || right)`.
- Nếu lá chỉ băm 1 lần: Kẻ tấn công có thể cắt một nhánh trung gian ra, nộp 64 byte làm "dữ liệu giả mạo", khiến smart contract nhầm lẫn một node nội bộ ở tầng giữa chính là một chiếc lá hợp lệ (**Second-Preimage Attack**).
- **Double Hashing** (chuẩn của OpenZeppelin StandardMerkleTree) cố định đầu vào của lá luôn là 32 byte, triệt tiêu 100% nguy cơ nhầm lẫn giữa lá và node nội. Chi phí băm thêm 1 lần ở off-chain chỉ tốn vài micro-giây.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, việc sử dụng Double Hashing cho Merkle Leaf là tuân theo chuẩn mực bảo mật của **OpenZeppelin StandardMerkleTree** để chống lỗ hổng **Tấn công tiền ảnh bậc hai (Second-Preimage Attack)**:
> 1. Trong cây Merkle, các node trung gian được tính bằng cách ghép nối hai chuỗi 32-byte: `H = keccak256(left || right)`.
> 2. Nếu ở tầng lá chỉ băm 1 lần dữ liệu: kẻ tấn công có thể lợi dụng sự tương đồng về định dạng để lấy một cặp node trung gian ở tầng trên và ngụy tạo thành một chiếc lá hợp lệ để đánh lừa thuật toán kiểm tra proof.
> 3. Bằng cách băm 2 lần: `leaf = keccak256(keccak256(data))`, tầng lá luôn được cố định là mã băm của một giá trị 32-byte. Điều này ngăn chặn toán học 100% việc nhầm lẫn giữa node lá và node trung gian.
> 4. Chi phí thêm 1 lần băm Keccak-256 ở tầng off-chain chỉ tốn vài micro-giây, hoàn toàn không ảnh hưởng tới hiệu năng nhưng đảm bảo an toàn mật mã tuyệt đối ạ."

#### 🇬🇧 Answer (English):
> "Double hashing at the leaf level is a cryptographic best practice from **OpenZeppelin's StandardMerkleTree** to prevent **Second-Preimage Attacks**:
> 1. In a Merkle tree, intermediate nodes are computed as `keccak256(left || right)` from two 32-byte inputs.
> 2. If leaves were single-hashed, an attacker could craft an intermediate node to collide with a leaf format, effectively tricking the verification algorithm into accepting an internal node as a valid credential leaf.
> 3. By computing `leaf = keccak256(keccak256(data))`, leaves are strictly domain-separated from internal nodes, making structural forgery mathematically impossible.
> 4. The computational overhead of one extra Keccak-256 hash off-chain is negligible (microseconds), but it guarantees absolute cryptographic integrity."

---

<a name="câu-5-bottleneck-hieu-nang"></a>
### ❓ CÂU 5: Thành phần nào ảnh hưởng lớn nhất đến hiệu năng (Bottleneck)?
> **Giám khảo hỏi:** *"Trong toàn bộ quy trình cấp phát từ CSV đến Blockchain, bước nào là nút thắt cổ chai (bottleneck) lớn nhất chiếm nhiều thời gian nhất của hệ thống?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra xem sinh viên có thực hiện Application Study (đo đạc phân rã từng giai đoạn) trong Báo cáo Chương 6 hay không.

#### 💡 Bản chất kỹ thuật:
- Theo phân rã thực nghiệm (Bảng 6.1 Báo cáo Luận văn):
  - Đọc CSV: 0.1% (~40 ms).
  - Tạo muối cam kết: 4.0% (~1.1 s).
  - Ký EIP-712: 43.9% (~12.1 s).
  - **Dựng cây Merkle & trích xuất Proof:** **52.0% (~14.3 s)** $\to$ **Chiếm hơn nửa thời gian (Nút thắt chính)**.
  - Giao dịch Blockchain: < 0.1% (1 transaction).

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, trong nghiên cứu phân tích hiệu năng ở Mục 6.2 Báo cáo, em đã đo đạc chi tiết từng thành phần cho đợt 10,000 sinh viên:
> - **Động cơ dựng cây Merkle và trích xuất đường dẫn bằng chứng (Proof Engine)** chính là nút thắt lớn nhất, chiếm **52.0% thời gian** (khoảng 14.3 giây).
> - Đứng thứ hai là công đoạn ký số EIP-712 ECDSA, chiếm **43.9% thời gian** (khoảng 12.1 giây).
> - Đây là **sự đánh đổi kỹ thuật có chủ đích (Intentional Trade-off)**: Chúng em chấp nhận đầu tư độ phức tạp $O(N \log N)$ một lần duy nhất lúc cấp bằng ở tầng off-chain, để đổi lại chi phí neo blockchain đạt $O(1)$ siêu rẻ (~16.8 gas) và tốc độ xác minh của nhà tuyển dụng đạt $O(\log N)$ siêu nhanh (chỉ mất 5.5 mili-giây) ạ."

#### 🇬🇧 Answer (English):
> "In Section 6.2 of my thesis, I conducted an empirical breakdown across all pipeline stages for 10,000 credentials:
> - **Merkle tree construction and proof extraction** is the primary computational bottleneck, accounting for **52.0% of total issuance time** (~14.3 seconds).
> - EIP-712 ECDSA signing is the secondary stage, taking **43.9% of the time** (~12.1 seconds).
> - This represents an intentional engineering trade-off: by investing $O(N \log N)$ computation once during off-chain batch issuance, we achieve $O(1)$ on-chain transaction scaling (~16.8 gas/cred) and instantaneous $O(\log N)$ client-side verification (~5.5 ms)."

---

<a name="câu-6-trien-khai-da-truong"></a>
### ❓ CÂU 6: Triển khai liên trường với định dạng bằng khác nhau
> **Giám khảo hỏi:** *"Mỗi trường đại học có format bằng tốt nghiệp khác nhau (Bách Khoa có xếp loại Khá/Giỏi, Y Dược có chuyên khoa, Ngoại thương có định dạng khác). Hệ thống của em triển khai liên trường như thế nào nếu format dữ liệu của họ không giống nhau?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra tính linh hoạt của Schema và khả năng ứng dụng thực tế vào ĐHQG-HCM hoặc Liên minh Đại học Việt Nam.

#### 💡 Bản chất kỹ thuật:
- **Smart Contract không phụ thuộc cấu trúc (Schema-Agnostic):** Hợp đồng chỉ lưu mã băm 32-byte Merkle root, không can thiệp vào định dạng dữ liệu bên trong.
- **Hợp đồng `IssuerRegistry` hỗ trợ đa trường (Multi-tenant):** Mỗi trường có một địa chỉ ví và mã định danh DID riêng (`did:bkcred:hcmut`, `did:bkcred:med`).
- **Schema EIP-712 mở rộng linh hoạt:** Có trường `vct` định danh loại bằng, và `privateClaims` là mảng động các mã băm key-value cho phép từng trường thêm bớt các thông tin đặc thù.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, hệ thống của em đã được thiết kế sẵn sàng cho mô hình **Liên minh đa trường (Multi-Tenant Consortium)** nhờ 3 đặc tính:
> 1. **Smart Contract độc lập với định dạng (Schema-Agnostic):** Hợp đồng trên Sepolia chỉ lưu duy nhất Merkle Root 32-byte. Bất kể trường Bách Khoa, Y Dược hay Kinh Tế có format bằng khác nhau thế nào, hợp đồng vẫn hoạt động bình thường mà không cần sửa code.
> 2. **`IssuerRegistry` hỗ trợ đa trường:** Mỗi trường đăng ký một ví ký riêng gắn với nhãn DID (như `did:bkcred:hcmut` hay `did:bkcred:ftu`). Trường nào chỉ được phép phát hành và thu hồi bằng của chính trường đó.
> 3. **EIP-712 Schema mở rộng động:** Trường `vct` định nghĩa loại văn bằng, và phần thông tin riêng tư `privateClaims` là mảng động các cam kết băm. Mỗi trường có thể tự do thêm các thuộc tính đặc thù (như chuyên khoa, đề tài tốt nghiệp) mà không phá vỡ quy trình xác minh 10 bước ạ."

#### 🇬🇧 Answer (English):
> "Our architecture is natively designed for a **multi-university consortium** through three extensible mechanisms:
> 1. **Schema-Agnostic Smart Contracts**: The blockchain registry only stores the 32-byte Merkle root. It does not enforce any hardcoded diploma attributes on-chain, meaning dozens of universities with completely different diploma structures can share the exact same smart contract.
> 2. **Multi-Tenant `IssuerRegistry`**: Each university registers its own authorized signing key labeled with its unique DID (such as `did:bkcred:hcmut` or `did:bkcred:med`). Each institution maintains sovereign authority over its own cohorts.
> 3. **Extensible EIP-712 Typed Schema**: Credentials declare their specific degree type via the `vct` field. Furthermore, `privateClaims` is an open array of key-value commitments, allowing any university to add custom academic attributes without breaking our canonical 10-step verification pipeline."

---

<a name="câu-7-usb-token-hieu-truong"></a>
### ❓ CÂU 7: Tại sao dùng USB Token mô phỏng (Keystore) thay vì USB PKI chuyên dụng?
> **Giám khảo hỏi:** *"Tại sao em lại dùng một chiếc USB thông thường chứa file `rector.keystore.json` để mô phỏng USB Token của Hiệu trưởng, mà không dùng hẳn một USB Token phần cứng chuyên dụng (PKI Token / YubiKey / eToken)?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra tính trung thực khoa học và khả năng hiểu rõ ranh giới giữa bản thử nghiệm đồ án (Academic Prototype) và sản phẩm thương mại.

#### 💡 Bản chất kỹ thuật:
- **Tính khả thi của đồ án sinh viên:** USB PKI Token phần cứng thương mại (như Gemalto, VNPT-CA, Viettel-CA) yêu cầu driver PKCS#11 riêng, chứng chỉ số X.509 có phí duy trì hàng năm, và trình duyệt web không thể giao tiếp trực tiếp với PKCS#11 nếu không cài thêm extension native phức tạp.
- **Giải pháp USB Token mô phỏng (Soft-token):** Lưu trữ khóa riêng tư đã được mã hóa chuẩn công nghiệp (Scrypt + AES-128-CTR). Khi cắm USB và nhập mã PIN đúng, khóa chỉ được giải mã cục bộ trên bộ nhớ RAM của trình duyệt trong vài mili-giây để ký phê duyệt, **khóa không bao giờ bị lộ ra ngoài mạng**.
- Về mặt lý thuyết bảo mật: Đã mô phỏng trọn vẹn mô hình **Kiểm soát kép (Dual-Control)**: Cán bộ đào tạo chuẩn bị batch, Hiệu trưởng nắm giữ phần cứng và mã PIN để phê duyệt.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, đây là một cân nhắc kỹ thuật thực tế trong phạm vi đồ án tốt nghiệp:
> 1. **Về rào cản phần cứng thương mại:** Các thiết bị USB Token phần cứng chuyên dụng (như Viettel-CA hay SafeNet eToken) sử dụng chuẩn PKCS#11 và chứng chỉ số X.509 của chính phủ, đòi hỏi phải cài đặt driver hệ điều hành và extension trình duyệt riêng, rất phức tạp để tích hợp vào ứng dụng web hiện đại.
> 2. **Giải pháp mô phỏng đạt chuẩn mật mã:** Em đã hiện thực mô hình **Soft USB Token** bằng file Keystore mã hóa chuẩn Web3 (sử dụng thuật toán chống brute-force Scrypt và mã hóa AES-128). Khóa riêng tư nằm độc lập trên USB vật lý, chỉ được giải mã tạm thời trong RAM khi người dùng cắm USB và gõ đúng mã PIN.
> 3. Về mặt kiến trúc, giải pháp này đáp ứng trọn vẹn mô hình **Kiểm soát kép (Dual-Control)**: Cán bộ đào tạo chỉ có quyền tạo batch, còn quyền kích hoạt giao dịch blockchain bắt buộc phải có sự hiện diện vật lý của chiếc USB và mã PIN của Hiệu trưởng ạ."

#### 🇬🇧 Answer (English):
> "This was a deliberate engineering decision balancing production security principles with student project feasibility:
> 1. **Commercial Hardware Constraints**: Commercial PKI tokens (like YubiKey or eToken) rely on native PKCS#11 drivers and X.509 certificate infrastructures, which require custom browser extensions and OS-level bridge software.
> 2. **Cryptographic Soft-Token Implementation**: I implemented an encrypted keystore stored on a physical USB drive using industrial-standard Web3 cryptography (Scrypt key derivation and AES-128 encryption). The private key never leaves the USB unencrypted; it is decrypted in browser memory only when the physical USB is mounted and the correct PIN is entered.
> 3. Architecturally, this perfectly demonstrates the **Dual-Control security model**: administrative staff can prepare the batch, but the on-chain anchoring transaction is strictly gated behind the Rector's physical token authorization."

---

<a name="câu-8-hieu-truong-het-nhiem-ky"></a>
### ❓ CÂU 8: Hiệu trưởng hết nhiệm kỳ hoặc mất USB thì xử lý thế nào?
> **Giám khảo hỏi:** *"Nếu Thầy Hiệu trưởng hết nhiệm kỳ công tác và có Hiệu trưởng mới, hoặc lỡ làm mất chiếc USB Token đó thì sao? Nếu thu hồi ví của Hiệu trưởng cũ trên Smart Contract thì hàng ngàn bằng tốt nghiệp của các khóa trước có bị mất hiệu lực theo không?"*

#### 🎯 Ý đồ giám khảo:
Đây là **Hạn chế số 1 (Limitation 6.2.1)** được phân tích rất kỹ trong Luận văn! Giám khảo muốn xem bạn có nắm được rủi ro vòng đời khóa ký (Signer Lifecycle) hay không.

#### 💡 Bản chất kỹ thuật:
- **Trong prototype hiện tại:** Hợp đồng `IssuerRegistry` dùng cờ nhị phân `isSigner(address)`. Nếu gọi `revokeSigner` on-chain thì các bằng cũ do người đó ký khi đem đi xác minh sẽ bị lỗi `SIGNER_NOT_REGISTERED`. Do đó, hiện tại việc hết nhiệm kỳ được xử lý an toàn bằng cách **thu hồi quyền ở server cấp bằng**, chứ không thu hồi trên blockchain.
- **Giải pháp nâng cấp kiến trúc (đã viết sẵn trong Chương 6):** Bổ sung struct `SignerRecord` lưu timestamp thời gian công tác:
  - Nếu hết nhiệm kỳ thông thường: Đặt `revokedAt = block.timestamp`. Các bằng được neo **trước thời điểm đó vẫn hợp lệ vĩnh viễn**; chỉ cấm phát hành batch mới.
  - Nếu bị mất cắp/lộ khóa khẩn cấp: Đặt cờ `isCompromised = true` để vô hiệu hóa toàn bộ cả cũ lẫn mới.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, đây chính là **hạn chế kỹ thuật trọng tâm mà em đã thẳng thắn phân tích tại Mục 6.2.1 trong Luận văn**:
> 1. Trong prototype hiện tại, cơ chế thu hồi ví ký hoạt động như một **Công tắc khẩn cấp (Emergency Kill-Switch)**: khi thu hồi ví trên on-chain, hệ thống sẽ chặn tất cả để đối phó trường hợp lộ khóa. Vì vậy, khi Hiệu trưởng hết nhiệm kỳ bình thường, trường sẽ decommission (hủy quyền) khóa đó ở server phát hành chứ không bấm nút kill-switch on-chain.
> 2. Để giải quyết triệt để bài toán này, trong Báo cáo Luận văn em đã đề xuất cấu trúc nâng cấp **`SignerRecord` gắn nhãn thời gian (Timestamped Validity Window)**: 
>    - Khi Hiệu trưởng chuyển công tác, trường gọi hàm `retireSigner`: ghi nhận mốc thời gian kết thúc nhiệm kỳ. Khi xác minh, hệ thống kiểm tra nếu bằng được neo trong nhiệm kỳ hợp lệ thì bằng vẫn có giá trị vĩnh viễn.
>    - Chỉ khi nào có sự cố lộ khóa, trường mới kích hoạt cờ `isCompromised = true` để vô hiệu hóa hồi tố toàn bộ ạ."

#### 🇬🇧 Answer (English):
> "This directly addresses the **primary operational trade-off analyzed in Section 6.2.1 of my thesis**:
> 1. In our current prototype, `IssuerRegistry` implements an **emergency kill-switch pattern** using a binary flag. If a key is compromised, revoking it immediately invalidates all batches. Therefore, routine term turnover is currently handled off-chain by decommissioning the key from the issuance server.
> 2. To decouple routine administrative turnover from emergency key containment on-chain, I proposed a **Timestamped SignerRecord architecture** in Chapter 6:
>    - When an official completes their tenure, calling `retireSigner` records a retirement timestamp. Any diplomas anchored during their active tenure remain valid indefinitely, while preventing any new batches.
>    - If a key is stolen, calling `flagCompromised` retroactively invalidates all credentials associated with that key."

---

<a name="câu-9-tai-sao-dung-off-chain"></a>
### ❓ CÂU 9: Tại sao dùng Off-Chain Storage? Có vi phạm luật bảo vệ dữ liệu không?
> **Giám khảo hỏi:** *"Tại sao em không lưu dữ liệu bằng lên Blockchain hay IPFS cho 'chuẩn Web3' mà lại lưu off-chain? Lưu thông tin sinh viên như vậy có đảm bảo tính pháp lý theo Nghị định 13/2023 về bảo vệ dữ liệu cá nhân không?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra kiến thức về **Tính pháp lý (Legal Compliance)**, quyền riêng tư, và hiểu biết về đặc tính bất biến của Blockchain.

#### 💡 Bản chất kỹ thuật:
- **Vi phạm pháp lý nếu lưu on-chain:** Blockchain có tính bất biến (không thể xóa/sửa). Theo **Nghị định 13/2023/NĐ-CP** của Việt Nam và chuẩn **GDPR** của Châu Âu, công dân có **"Quyền được lãng quên" (Right to be Forgotten)** và quyền yêu cầu chỉnh sửa dữ liệu cá nhân. Lưu họ tên, ngày sinh, CCCD của sinh viên lên blockchain công khai là vi phạm pháp luật nghiêm trọng!
- **Chi phí & Bảo mật:** Lưu lên blockchain làm lộ thông tin cá nhân ra toàn thế giới và tốn chi phí gas gấp hàng ngàn lần.
- **Giải pháp của đề tài:** Dữ liệu cá nhân chỉ lưu dưới dạng **mã băm cam kết (Commitment)** trên blockchain. Bằng gốc do sinh viên tự giữ off-chain $\to$ Hoàn toàn tuân thủ pháp luật về bảo vệ dữ liệu cá nhân.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy, việc lưu trữ dữ liệu văn bằng off-chain là quyết định sống còn về cả **chi phí kỹ thuật lẫn tính pháp lý**:
> 1. **Về mặt pháp lý:** Theo **Nghị định 13/2023/NĐ-CP** về Bảo vệ dữ liệu cá nhân tại Việt Nam và chuẩn GDPR quốc tế, sinh viên có quyền yêu cầu chỉnh sửa hoặc xóa dữ liệu cá nhân. Vì blockchain có tính bất biến (không bao giờ xóa được), nếu chúng ta đưa thông tin cá nhân (họ tên, CCCD, ngày sinh) lên blockchain hay IPFS công khai là **vi phạm pháp luật nghiêm trọng về quyền riêng tư**.
> 2. **Về mặt kỹ thuật:** Blockchain chỉ lưu duy nhất mã băm Merkle Root 32-byte vô nghĩa, không thể dịch ngược ra thông tin sinh viên. Dữ liệu văn bằng thuộc quyền sở hữu của sinh viên, lưu trữ an toàn trong máy cá nhân hoặc cơ sở dữ liệu nội bộ của trường.
> 3. Về tính pháp lý của chữ ký số: Chữ ký số EIP-712 trên file JSON hoàn toàn đáp ứng các điều kiện về thông điệp dữ liệu và chữ ký điện tử theo **Luật Giao dịch điện tử năm 2023** của Việt Nam ạ."

#### 🇬🇧 Answer (English):
> "Keeping credential payloads off-chain is a critical requirement for both **engineering scalability and legal compliance**:
> 1. **Regulatory Compliance**: Under Vietnam's **Decree 13/2023/ND-CP on Personal Data Protection** and Europe's GDPR, individuals possess the 'Right to be Forgotten' and the right to rectify personal data. Because public blockchains are immutable and permanently public, storing student PII (names, national IDs, grades) on-chain or on public IPFS is a severe privacy violation.
> 2. **Cryptographic Privacy**: On-chain, the blockchain only persists a 32-byte Merkle root, which reveals zero personal information. The actual diploma resides securely with the student off-chain.
> 3. Under Vietnam's **Law on Electronic Transactions 2023**, off-chain cryptographic signatures like EIP-712 satisfy the legal criteria for electronic data messages and digital signatures."

---

<a name="câu-10-sinh-vien-mat-file-json"></a>
### ❓ CÂU 10: Nếu sinh viên làm mất file JSON chứng chỉ thì làm sao?
> **Giám khảo hỏi:** *"Vì văn bằng lưu off-chain trên máy sinh viên, lỡ sinh viên bị hỏng máy tính hoặc làm mất file JSON đó thì bằng có bị mất vĩnh viễn không? Blockchain có khôi phục lại bằng được không?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra ranh giới khả năng phục hồi dữ liệu (Data Availability Boundary).

#### 💡 Bản chất kỹ thuật:
- Blockchain chỉ giữ gốc Merkle Root 32-byte $\to$ **Blockchain không thể tự tái tạo lại họ tên, điểm số nếu mất dữ liệu gốc**.
- Nhưng sinh viên không bao giờ bị mất bằng vĩnh viễn, vì hệ thống có **Cơ chế sao lưu phục hồi của Nhà trường**:
  - Nhà trường vẫn lưu bản ghi trong PostgreSQL nội bộ.
  - Sinh viên chỉ cần vào cổng **Holder Portal (`/holder`)**, đăng nhập bằng email trường qua Privy là có thể **tải lại file JSON bất kỳ lúc nào**.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy:
> 1. Về mặt toán học: Vì blockchain chỉ lưu mã băm Merkle root 32-byte, blockchain không thể tự sinh ngược lại họ tên hay điểm số nếu mất dữ liệu gốc.
> 2. Tuy nhiên, trong quy trình vận hành thực tế, sinh viên **không bao giờ bị mất bằng**: Nhà trường luôn lưu trữ bản sao gốc trong cơ sở dữ liệu PostgreSQL của trường có sao lưu định kỳ. 
> 3. Khi sinh viên bị mất file trên máy tính cá nhân, sinh viên chỉ cần truy cập vào **Cổng sinh viên (Holder Portal)**, đăng nhập bằng email trường qua Privy là có thể tải lại file chứng chỉ số JSON cùng các muối giải mã bất kỳ lúc nào ạ."

#### 🇬🇧 Answer (English):
> "1. From a cryptographic standpoint, because the blockchain only holds a 32-byte Merkle root, the on-chain anchor cannot independently reconstruct lost student grades or names.
> 2. However, in practice, graduates will **never permanently lose their credentials**. The issuing university maintains persistent records within its internal PostgreSQL database under standard disaster recovery policies.
> 3. If a student loses their local JSON file, they simply visit the **Holder Portal**, authenticate passwordlessly using their university email, and re-download their verifiable diploma instantly."

---

<a name="câu-11-sepolia-vs-mainnet"></a>
### ❓ CÂU 11: Tại sao test trên Sepolia mà không phải Ethereum Mainnet?
> **Giám khảo hỏi:** *"Tại sao em chỉ thử nghiệm trên mạng thử nghiệm Sepolia mà không triển khai thật trên Ethereum Mainnet? Nếu lên Mainnet thật thì chi phí gas có bị đội giá lên cao khi mạng nghẽn không?"*

#### 🎯 Ý đồ giám khảo:
Kiểm tra tính thực tiễn kinh tế và phương án xử lý biến động giá gas trên mạng Mainnet thật.

#### 💡 Bản chất kỹ thuật:
- Sepolia chạy máy ảo EVM hoàn toàn tương đồng 100% với Ethereum Mainnet về mặt opcode và lượng gas tiêu thụ.
- Lý do không chạy Mainnet: Đồ án nghiên cứu học thuật không thể chi trả tiền ETH thật hàng triệu đồng cho mỗi lần thử nghiệm.
- Phương án cho thực tế: Ethereum Layer 2 (Arbitrum, Base, Optimism) - chi phí rẻ hơn Mainnet 50–100 lần, phí ổn định < 0.01 USD.

#### 🇻🇳 Trả lời (Tiếng Việt):
> "Dạ thưa Thầy:
> 1. Về mặt kỹ thuật: Mạng **Ethereum Sepolia Testnet** sử dụng cùng kiến trúc EVM, cùng bảng giá opcode gas và cùng cơ chế đồng thuận PoS giống hệt 100% với Ethereum Mainnet. Do đó, con số **167,804 gas** đo được trên Sepolia phản ánh chính xác lượng tài nguyên tính toán sẽ tiêu tốn trên Mainnet.
> 2. Về mặt kinh tế: Do phạm vi đồ án học thuật của sinh viên, việc nạp tiền ETH thật lên Mainnet cho nhiều đợt thử nghiệm là không khả thi về mặt ngân sách.
> 3. Về biến động giá gas: Để đưa vào sản xuất thực tế tại các trường học, lộ trình phát triển của đề tài (ở Slide Future Directions) là triển khai lên các mạng **Layer 2 Rollup như Arbitrum hoặc Base**. Trên Layer 2, chi phí neo một khóa 10,000 sinh viên chỉ tốn khoảng **vài cent (chưa tới 1,000 VNĐ)** và hoàn toàn miễn nhiễm với tình trạng nghẽn mạng trên Ethereum Layer 1 ạ."

#### 🇬🇧 Answer (English):
> "1. Technically, the **Ethereum Sepolia Testnet** runs the exact same EVM execution environment, opcode gas schedule, and PoS consensus rules as Ethereum Mainnet. Therefore, our measured **167,804 gas** consumption accurately represents real-world execution costs on Mainnet.
> 2. Economically, as an academic student project, executing repeated 10,000-cohort deployments with real fiat currency on Mainnet was financially impractical.
> 3. Regarding gas volatility: for actual production deployment across universities, our roadmap targets **Ethereum Layer 2 Rollups** such as Arbitrum One or Base. On Layer 2, cohort anchoring fees drop by another 50 to 100 times to just a few fractions of a cent, eliminating exposure to Layer 1 congestion."

---

## 📌 BỎ TÚI KHI RA HỘI ĐỒNG:

1. **Nguyên tắc "Cảm ơn & Nêu bối cảnh":** Khi Thầy đặt câu hỏi, hãy luôn mở đầu: *"Em cảm ơn Thầy/Cô đã đặt một câu hỏi rất thực tế về...".*
2. **Nếu gặp câu hỏi chưa làm kịp:** Hãy tự tin trả lời: *"Dạ thưa Thầy, trong phạm vi đồ án Phase 3 em đã tập trung giải quyết trọn vẹn bài toán X. Vấn đề Thầy vừa nêu là một hướng mở rộng rất giá trị mà em đã ghi nhận trong phần Future Work của Chương 6 và sẽ tiếp tục hoàn thiện trong các nghiên cứu tiếp theo ạ."*
3. **Thần thái:** Bình tĩnh, mỉm cười nhẹ, mắt nhìn thẳng vào Thầy Cô đang đặt câu hỏi.
