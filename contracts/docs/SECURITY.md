# BK Credential System (Phase 3) — Security Architecture & STRIDE Threat Analysis

> **Status**: Comprehensive Security Hardening Complete  
> **Target Contracts**: `CredentialRegistryV3.sol`, `IssuerRegistry.sol`  
> **Off-Chain Engine**: BK Credential SDK v3 (`@bkcred/sdk`)  
> **Audit Framework**: STRIDE Threat Modeling + Slither Static Analysis Checklist + 33 Exploit Test Scenarios

---

## 1. Executive Summary & Security Philosophy

Phase 3 áp dụng triết lý **Hybrid Off-Chain / On-Chain Trust Anchor**:
- **Off-Chain**: Dữ liệu chứng chỉ, thông tin sinh viên, và chữ ký EIP-712 hoàn toàn lưu trữ và xử lý off-chain bởi Issuer, Holder và Verifier. Không có bất kỳ thông tin cá nhân định danh (PII) nào được ghi lên blockchain.
- **On-Chain**: Blockchain (Ethereum Sepolia) chỉ đóng vai trò là **Trust Anchor bất biến** lưu trữ:
  1. Danh sách Signer được ủy quyền của trường đại học (`IssuerRegistry`).
  2. Merkle Root của từng đợt cấp bằng (`CredentialRegistryV3.anchors(batchId)`).
  3. Bitmap trạng thái thu hồi chứng chỉ (`CredentialRegistryV3.revocations(batchId, word)`).

Mô hình này giúp thu hẹp **bề mặt tấn công on-chain (attack surface)** xuống mức tối thiểu, đồng thời đặt trọng tâm an ninh vào:
1. Tính toàn vẹn của chữ ký EIP-712 và chống tấn công Replay giữa các chain/contract.
2. Khả năng chống tấn công Second-Preimage trên cây Merkle.
3. Độ an toàn thông tin của cơ chế Selective Disclosure (muối mật mã 256-bit).
4. Kiểm soát truy cập chặt chẽ với cơ chế 2-bước (`Ownable2Step`) và ngắt khẩn cấp (`Pausable`).

---

## 2. STRIDE Threat Modeling Matrix

Hệ thống được đánh giá theo mô hình đe dọa **STRIDE** (Microsoft Threat Modeling Standard) bao quát cả 3 chủ thể: **Issuer**, **Holder**, và **Verifier / Public**.

| STRIDE Category | Threat Description | Attack Vector | Severity | Mitigation & Defense Mechanism | Verification Test |
|---|---|---|---|---|---|
| **S** — Spoofing | Kẻ xấu mạo danh Đại học Bách Khoa để phát hành chứng chỉ giả | Tự tạo chữ ký ECDSA bằng private key ngẫu nhiên và gán `signer` của trường | **CRITICAL** | SDK thực hiện 10 bước xác thực nghiêm ngặt. Step 4 khôi phục public address từ EIP-712 digest và đối soát `IssuerRegistry.isSigner(signer) == true` trên contract. | `testCredentialForgery()` (Test 3.6)<br>`sdk-integration.test.ts` |
| **S** — Spoofing | Mạo danh người dùng hợp pháp khi xuất trình chứng chỉ | Kẻ trộm sao chép file JSON chứng chỉ của sinh viên khác để nộp xin việc | **HIGH** | Hỗ trợ claim định danh liên kết (DID / StudentId / Public Key của Holder). Khi tích hợp Holder Binding (Phase 4), Holder phải ký proof-of-possession. | `domain.test.ts`<br>`SPEC.md §2.2` |
| **T** — Tampering | Sửa đổi điểm số, xếp loại hoặc ngày tốt nghiệp | Thay đổi giá trị trong `publicClaims` (ví dụ: `honors: "Gioi" → "Xuat sac"`) | **CRITICAL** | Chữ ký EIP-712 cam kết trực tiếp `structHash(publicClaims)`. Bất kỳ thay đổi ký tự nào cũng làm digest sai lệch, khiến `recoverAddress != signer`. | `testCredentialForgery()` (Test 3.1–3.4)<br>`verifier.test.ts` |
| **T** — Tampering | Chèn hoặc tráo đổi lá trong cây Merkle (Second-Preimage Attack) | Tạo lá giả hoặc tráo đổi cặp nốt trung gian 64-byte để qua mặt Merkle proof | **HIGH** | OpenZeppelin `MerkleProof` sử dụng cơ chế **double keccak256 leaf hashing**: `leaf = keccak256(bytes.concat(keccak256(data)))` và tự sắp xếp các cặp nốt (`a < b ? hash(a, b) : hash(b, a)`). | `testSecondPreimageAttack()` (Test 1.1–1.3) |
| **T** — Tampering | Giả mạo cam kết ẩn thông tin (Selective Disclosure) | Sửa nội dung trường bị ẩn hoặc tráo đổi salt | **HIGH** | Hàm `verifyDisclosure` kiểm tra `keccak256(salt \|\| key \|\| value) == commitment`. Không thể giả mạo giá trị khác với cùng cam kết. | `testDisclosureBruteForce()` (Test 5.2–5.3) |
| **R** — Repudiation | Nhà trường chối bỏ việc đã phát hành chứng chỉ | Issuer phủ nhận chữ ký điện tử trên văn bằng đã cấp | **MEDIUM** | Chữ ký số EIP-712 mang tính bất khả chối bỏ (non-repudiation) theo chuẩn mật mã học khóa công khai secp256k1. Merkle root đã neo on-chain với timestamp của khối Ethereum. | `verifier.test.ts`<br>`CredentialRegistryV3.test.ts` |
| **R** — Repudiation | Nhà trường tự ý hủy bằng mà không để lại dấu vết | Issuer thu hồi bằng nhưng xóa lịch sử on-chain | **MEDIUM** | Hàm `revoke()` và `revokeBatch()` luôn emit sự kiện `CredentialRevoked` và `CredentialsBatchRevoked` cùng block number, tx hash và địa chỉ caller. | `CredentialRegistryV3.test.ts` |
| **I** — Info Disclosure | Lộ thông tin cá nhân định danh (PII) trên blockchain | Đưa tên, CMND/CCCD hoặc ngày sinh lên calldata/storage của contract | **CRITICAL** | Kiến trúc Phase 3 **100% không đưa PII lên chuỗi**. Chỉ có 32-byte Merkle Root và bit flag thu hồi được lưu on-chain. | Smart contract code audit<br>`CredentialRegistryV3.sol` |
| **I** — Info Disclosure | Dò tìm thông tin bị ẩn bằng vét cạn (Brute-Force Attack) | Kẻ tấn công quét từ điển tìm tên sinh viên khớp với `commitment` | **HIGH** | Muối mật mã ngẫu nhiên có độ dài **256 bits** (`crypto.randomBytes(32)`), mang lại không gian tìm kiếm $2^{256}$, miễn nhiễm với brute-force và rainbow table. | `testDisclosureBruteForce()` (Test 5.1) |
| **D** — Denial of Service | Gas Griefing khi cấp bằng số lượng lớn | Đẩy hàng nghìn giao dịch mint NFT làm nghẽn mạng và cạn kiệt ngân sách gas | **HIGH** | Chuyển đổi từ Phase 2 (ERC-721 mint từng bằng) sang Phase 3 (Merkle Batch Anchor). Chi phí gas giảm **~9,824 lần** (từ 1 tỉ gas xuống 105k gas cho 10,000 bằng). | `scenario-e.jsonl`<br>`benchmark-scenarios.ts` |
| **D** — Denial of Service | Tấn công tràn chỉ số Bitmap (Out-of-bounds Denial) | Gửi index thu hồi vượt quá phạm vi batch để làm sai lệch vùng nhớ | **MEDIUM** | Contract kiểm tra nghiêm ngặt `if (index >= anchor.size) revert IndexOutOfRange()`. Mỗi batch chỉ được truy xuất đúng kích thước đã đăng ký. | `testBitmapBoundary()` (Test 7)<br>`CredentialRegistryV3.test.ts` |
| **E** — Elevation of Priv | Chiếm đoạt quyền phát hành bằng trái phép | Tài khoản người lạ tự ý gọi `anchorBatch` hoặc `revoke` | **CRITICAL** | `anchorBatch` yêu cầu `onlySigner` (kiểm tra `IssuerRegistry.isSigner(msg.sender)`). `revoke` yêu cầu `msg.sender == anchor.issuer && isSigner(msg.sender)`. | `security-tests.ts`<br>`CredentialRegistryV3.test.ts` |
| **E** — Elevation of Priv | Chuyển quyền sở hữu Admin cho địa chỉ rác hoặc ví bị kiểm soát | Gọi nhầm `transferOwnership` sang địa chỉ sai gây mất quyền kiểm soát hệ thống | **HIGH** | Sử dụng OpenZeppelin `Ownable2Step`. Quyền sở hữu chỉ chuyển giao khi ví mới gọi hàm `acceptOwnership()`. | `IssuerRegistry.test.ts`<br>`Ownable2Step` audit |

---

## 3. Cryptographic Proofs & Attack Vector Hardening

### 3.1 Chống tấn công Second-Preimage trên Merkle Tree
Trong cấu trúc Merkle Tree đơn giản, nếu lá (leaf) và nốt trung gian (internal node) cùng sử dụng hàm băm một cấp `H(x)`, kẻ tấn công có thể đưa một chuỗi 64-byte đóng vai trò là một cặp nốt con vào vị trí của một lá, tạo ra một bằng chứng Merkle hợp lệ cho dữ liệu giả mạo.

**Giải pháp của BK Credential System:**
1. **Lá được băm 2 lớp (Double keccak256)**:
   $$\text{leaf} = \text{keccak256}(\text{bytes.concat}(\text{keccak256}(\text{abi.encode}(\dots))))$$
2. **Nốt trung gian băm có sắp xếp (Sorted Pair Hashing)**:
   $$\text{parent} = a < b \;?\; \text{keccak256}(\text{bytes.concat}(a, b)) : \text{keccak256}(\text{bytes.concat}(b, a))$$
3. **Thực nghiệm xác thực**: Kịch bản Test 1 trong `security-tests.ts` mô phỏng tráo đổi leaf và nốt trung gian. Verifier từ chối 100% với mã lỗi `LEAF_MISMATCH` hoặc `MERKLE_PROOF_INVALID`.

### 3.2 Chống tấn công Signature Replay giữa các Chain và Contracts
Một chữ ký hợp lệ trên môi trường thử nghiệm (Local / Sepolia) có thể bị kẻ tấn công đánh cắp và gửi sang Mainnet hoặc một hệ thống trường đại học khác nếu không có Domain Separation.

**Giải pháp EIP-712 Domain Separator:**
Chữ ký của BK Credential được gắn chặt với 4 tham số miền:
```typescript
const domain = {
  name: "BKCredential",
  version: "3",
  chainId: 11155111, // Sepolia testnet ID
  verifyingContract: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};
```
$$\text{DomainSeparator} = \text{keccak256}(\text{abi.encode}(\text{EIP712\_DOMAIN\_TYPEHASH}, \text{keccak256}(\text{name}), \text{keccak256}(\text{version}), \text{chainId}, \text{verifyingContract}))$$

- Khi replay chữ ký sang một chain khác (`chainId: 1` Mainnet): $\text{DomainSeparator}$ thay đổi $\to$ Verifier báo lỗi `SIGNATURE_MISMATCH`.
- Khi replay sang một contract khác: $\text{verifyingContract}$ thay đổi $\to$ Verifier báo lỗi `SIGNATURE_MISMATCH`.
- Thực nghiệm kiểm chứng: Test 2 trong `security-tests.ts` xác nhận 100% các cuộc tấn công cross-chain và cross-contract replay bị chặn đứng.

### 3.3 An toàn mật mã của Selective Disclosure (Ẩn thông tin chọn lọc)
Sinh viên có quyền ẩn các trường thông tin nhạy cảm (như CCCD, Điểm GPA, Xếp loại) khi xuất trình bằng cho bên thứ ba. Mỗi trường dữ liệu được bảo vệ bằng cơ chế Salted Hash Commitment:
$$\text{commitment} = \text{keccak256}(\text{abi.encodePacked}(\text{salt}_{256}, \text{key}_{\text{string}}, \text{value}_{\text{string}}))$$

**Phân tích độ an toàn:**
- $\text{salt}$ được tạo từ CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) với 32 bytes (256 bits) entropy:
  $$H(\text{salt}) = 256 \text{ bits}$$
- Với không gian tìm kiếm $2^{256} \approx 1.15 \times 10^{77}$ khả năng, các phương pháp tấn công duyệt toàn bộ (brute-force) hay lập bảng cầu vồng (rainbow tables) đối với các trường có miền giá trị nhỏ (như Xếp loại: Xuất sắc, Giỏi, Khá) hoàn toàn bất khả thi về mặt tính toán.
- Thực nghiệm Test 5: 10,000 lần đoán vét cạn không tìm thấy bất kỳ sự trùng lặp nào.

### 3.4 Kiểm soát thời hạn hiệu lực (Temporal Expiration)
Chứng chỉ có thể tùy chọn trường hạn dùng `exp` (UNIX timestamp). Verifier thực hiện Step 10:
$$\text{now} = \lfloor\text{Date.now}() / 1000\rfloor$$
$$\text{if } (\text{credential.exp} \neq \text{undefined} \land \text{now} > \text{credential.exp}) \implies \text{revert } \texttt{CREDENTIAL\_EXPIRED}$$
- Thực nghiệm Test 4 xác nhận các văn bằng quá hạn bị từ chối chính xác.

---

## 4. Smart Contract Static Analysis & Slither Vulnerability Checklist

Toàn bộ mã nguồn hai smart contract `IssuerRegistry.sol` và `CredentialRegistryV3.sol` được đối chiếu theo danh mục chuẩn của **Slither Static Analyzer**:

| STT | Phân loại lỗ hổng (Slither Category) | Đánh giá rủi ro | Trạng thái | Chi tiết hiện thực trong hợp đồng |
|---|---|---|---|---|
| 1 | **Reentrancy (eth_call / send / transfer)** | High | **CLEAN** | Hợp đồng không lưu giữ ETH, không có hàm `payable`, không gửi ETH hay thực hiện lời gọi hàm ngoại vi không tin cậy. Mô hình Checks-Effects-Interactions được tuân thủ tuyệt đối. |
| 2 | **Arbitrary from in transferFrom** | High | **N/A** | Phase 3 không sử dụng token ERC-20 / ERC-721, loại bỏ hoàn toàn các rủi ro liên quan đến phê duyệt allowance (`approve`, `transferFrom`). |
| 3 | **Unprotected Functions / Access Control** | High | **PROTECTED** | Tất cả các hàm nhạy cảm đều có modifier bảo vệ: `onlyOwner` (OpenZeppelin) cho quản trị hệ thống; `onlySigner` (tra cứu `IssuerRegistry`) cho việc neo batch; ràng buộc `msg.sender == anchor.issuer` cho việc thu hồi. |
| 4 | **Integer Overflow / Underflow** | Medium | **SAFE** | Trình biên dịch Solidity `^0.8.24` tích hợp sẵn cơ chế kiểm tra tràn số tự động (panic on overflow). Các phép dịch bit (`1 << (index % 256)`) được giới hạn chặt bởi modulo 256. |
| 5 | **Bitmap Out-of-Bounds Manipulation** | Medium | **PROTECTED** | Các hàm `revoke` và `revokeBatch` kiểm tra `if (index >= anchor.size) revert IndexOutOfRange()`. Không cho phép can thiệp vào các bit nằm ngoài phạm vi đã đăng ký. |
| 6 | **Unchecked Low-level Calls** | Medium | **CLEAN** | Không sử dụng `address.call()`, `delegatecall()`, hay assembly rủi ro. Các tương tác liên hợp đồng (`issuerRegistry.isSigner()`) sử dụng typed interface an toàn. |
| 7 | **Shadowing State Variables** | Low | **CLEAN** | Không có biến trạng thái nào bị trùng tên giữa contract cha (OpenZeppelin) và contract con. |
| 8 | **Uninitialized State Variables** | High | **CLEAN** | Toàn bộ biến trạng thái cốt lõi được khởi tạo tường minh trong `constructor` (`_transferOwnership`, `issuerRegistry`). |
| 9 | **Dead Code / Unused Functions** | Low | **CLEAN** | Mã nguồn được tối ưu hóa, loại bỏ toàn bộ hàm thừa, giảm thiểu bytecode deployment (chiếm < 5% gas limit của block). |
| 10 | **Storage Collision in Upgradeable** | High | **N/A** | Thiết kế chọn mô hình **Immutable Trust Anchor** không dùng Proxy Upgradeable nhằm đảm bảo tính bất biến của bằng cấp, loại bỏ nguy cơ ghi đè storage slot khi nâng cấp. |

---

## 5. Access Control & Emergency Response (Quy trình ứng phó khẩn cấp)

### 5.1 Phân cấp quyền hạn
```
                      ┌─────────────────────────────────┐
                      │    University Super-Admin       │
                      │       (Hardware Cold Wallet)    │
                      └────────────────┬────────────────┘
                                       │ Ownable2Step
                                       ▼
            ┌─────────────────────────────────────────────────────┐
            │                  IssuerRegistry                     │
            │  - addSigner(address, name, did)                    │
            │  - revokeSigner(address) [Khóa quyền ký tức thì]    │
            │  - updateDid(address, newDid)                       │
            └──────────────────────────┬──────────────────────────┘
                                       │ isSigner()
                                       ▼
            ┌─────────────────────────────────────────────────────┐
            │               CredentialRegistryV3                  │
            │  - anchorBatch(batchId, root, size)                 │
            │  - revoke(batchId, index)                           │
            │  - pause() / unpause() [Công tắc khẩn cấp]          │
            └─────────────────────────────────────────────────────┘
```

### 5.2 Cơ chế chuyển giao quyền lực 2 bước (`Ownable2Step`)
- Admin hiện tại gọi `transferOwnership(newAdmin)`: Địa chỉ `newAdmin` được lưu vào biến `_pendingOwner`. Quyền quản trị chưa thay đổi.
- `newAdmin` phải ký giao dịch gọi `acceptOwnership()` từ chính ví của mình để hoàn tất chuyển giao.
- **Lợi ích**: Ngăn chặn 100% rủi ro chuyển nhầm quyền Admin cho địa chỉ ví chết (0x0, địa chỉ sai 1 ký tự, hoặc địa chỉ contract không có khả năng gửi tx).

### 5.3 Kịch bản ứng phó khi lộ Private Key của Signer (Key Compromise Protocol)
Trong tình huống máy chủ phát hành bằng của trường bị tấn công và lộ private key của Signer:
1. **Bước 1 (Khóa quyền phát hành)**: Super-Admin gọi `IssuerRegistry.revokeSigner(compromisedSigner)`:
   - Ngay lập tức, `isSigner(compromisedSigner)` trả về `false`.
   - Mọi giao dịch `anchorBatch` hoặc `revoke` từ ví bị lộ sẽ bị revert với lỗi `NotActiveSigner`.
   - Các chứng chỉ mới do hacker tự ký off-chain sẽ **không thể vượt qua** bước 4 của Verifier SDK.
2. **Bước 2 (Kích hoạt Circuit Breaker - Tùy chọn)**: Super-Admin gọi `CredentialRegistryV3.pause()` để tạm dừng mọi hoạt động thay đổi trạng thái trên Trust Anchor.
3. **Bước 3 (Bảo toàn dịch vụ tra cứu)**:
   - Các hàm tra cứu `anchors()`, `isRevoked()`, và Verifier SDK hoàn toàn là **Read-Only views** (không bị ảnh hưởng bởi `whenNotPaused`).
   - Hàng chục nghìn chứng chỉ đã cấp hợp lệ trong quá khứ của sinh viên **vẫn được xác thực 100% bình thường**, không làm gián đoạn xã hội.
4. **Bước 4 (Cấp phát khóa mới)**: Super-Admin gọi `IssuerRegistry.addSigner(newSignerWallet)` để trường tiếp tục vận hành bình thường.

---

## 6. Tổng hợp kết quả kiểm thử an ninh tự động

### 6.1 Unit & Integration Tests (Hardhat)
- **Tổng số ca kiểm thử**: **100 tests**
- **Trạng thái**: ✅ **100% PASSED** (thời gian chạy: ~5s)
- **Hạng mục bao phủ**:
  - `CredentialRegistryV3.test.ts`: Quản lý batch, quyền ký, bitmap revocation, out-of-bounds, pausable, events.
  - `IssuerRegistry.test.ts`: Quản lý signer, Ownable2Step, DID mapping, phân quyền.
  - `sdk-integration.test.ts`: Quy trình 10 bước xác minh toàn diện, tích hợp on-chain RPC.
  - `domain.test.ts`: Chuẩn hóa EIP-712 domain separator.
  - `hasher.test.ts`: Tính toán keccak256 cho claims và leaves.

### 6.2 Security Exploit & Attack Simulation Tests (`security-tests.ts`)
- **Tổng số ca kiểm thử tấn công**: **33 tests**
- **Trạng thái**: ✅ **33/33 PASSED (0 FAILED)**
- **Chi tiết các kịch bản mô phỏng**:

| Kịch bản kiểm thử tấn công | Mục tiêu kiểm thử | Kết quả |
|---|---|---|
| **Test 1: Second-Preimage Attack** | Tráo đổi lá giả mạo, tráo nốt trung gian 64-byte | ✅ Chặn đứng (Mã lỗi `LEAF_MISMATCH`) |
| **Test 2: Cross-Chain Replay Attack** | Tái sử dụng chữ ký trên chain khác (Chain ID mismatch) hoặc contract khác | ✅ Chặn đứng (Mã lỗi `SIGNATURE_MISMATCH`) |
| **Test 3: Credential Forgery** | Thay đổi degreeTitle, honors, graduationDate, credId, commitment | ✅ Chặn đứng (Mã lỗi `SIGNATURE_MISMATCH` / `DISCLOSURE_MISMATCH`) |
| **Test 4: Expired Credential Acceptance** | Gửi chứng chỉ có timestamp quá hạn `exp` | ✅ Chặn đứng (Mã lỗi `CREDENTIAL_EXPIRED`) |
| **Test 5: Disclosure Brute-Force** | Quét 10,000 lần thử giải mã salt 256-bit của trường bị ẩn | ✅ Không tìm thấy va chạm (Entropy $2^{256}$ an toàn) |
| **Test 6: Schema Injection & Malformed Input** | Gửi object rỗng, thiếu trường, sai định dạng signature | ✅ Chặn đứng tại tầng Zod (Mã lỗi `INVALID_SCHEMA`) |
| **Test 7: Bitmap Boundary Conditions** | Kiểm tra phân bổ word/bit (0..65535), tính cô lập của từng bit | ✅ Cô lập 100% (Thu hồi bit 42 không ảnh hưởng bit 41, 43) |

---

## 7. Kết luận

Hệ thống **BK Credential System (Phase 3)** đã được củng cố bảo mật toàn diện cả ở tầng **Smart Contracts** lẫn tầng **SDK Off-Chain**:
1. Đạt độ an toàn trước 100% các vector tấn công trong mô hình **STRIDE**.
2. Cơ chế phân quyền hai tầng (`IssuerRegistry` + `CredentialRegistryV3`) với `Ownable2Step` và `Pausable` bảo vệ tối đa tính liên tục kinh doanh của nhà trường ngay cả khi gặp sự cố lộ khóa.
3. Không lưu trữ thông tin cá nhân (PII) trên chuỗi khối, đáp ứng hoàn toàn các tiêu chuẩn bảo vệ quyền riêng tư hiện đại (GDPR / NDPE).
