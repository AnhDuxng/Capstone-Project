# BK Credential System — Phase 3

## EIP-712 Off-Chain Signing + On-Chain Trust Anchor

### Kế hoạch hiện thực (6–7 tuần)

**Đề tài:** Thiết kế và hiện thực một giải pháp cấp phát chứng chỉ số sử dụng công nghệ Blockchain

**Bối cảnh:** Kế thừa Phase 1 (HK251-DAGD1-434) và Phase 2 (HK252-DATN-131). Phase 3 là một hướng tiếp cận _khác_ với Phase 2, không phải bản nâng cấp tuyến tính, nhằm chứng minh luận điểm: _ở quy mô trường đại học, một giải pháp đơn giản hơn, rẻ hơn và thân thiện hơn vẫn đạt được các đảm bảo an toàn tương đương_.

---

## 1. Luận điểm thiết kế (Design Thesis)

Phase 2 (BK Credential System) đã giải quyết tốt ba bài toán: _trustless verification_, _selective disclosure_ (SD-JWT) và _batch issuance_ (Merkle anchor). Tuy nhiên, mỗi credential vẫn phải ký SD-JWT ES256K riêng lẻ, và toàn bộ PCV (Public Canonical View) phải pin lên IPFS — phát sinh chi phí vận hành và độ phức tạp không nhỏ cho issuer quy mô vài chục ngàn sinh viên.

Phase 3 đặt câu hỏi ngược lại: **nếu blockchain chỉ đóng vai trò "Mỏ neo niềm tin" (Trust Anchor), và toàn bộ chữ ký trên chứng chỉ được tạo ra off-chain bằng EIP-712 — liệu ta có thể giữ lại các đảm bảo an toàn của Phase 2 trong khi giảm đáng kể chi phí và độ phức tạp vận hành?**

Câu trả lời là _có_, với điều kiện:

- **On-chain Trust Anchor** giữ nguyên mô hình `IssuerRegistry` + `CredentialRegistry` + Merkle root của Phase 2. Blockchain chỉ lưu: (i) danh sách ví issuer hợp lệ, (ii) Merkle root của mỗi batch tốt nghiệp, (iii) bitmap revocation. Không có bất kỳ giao dịch on-chain nào cho từng chứng chỉ.
- **EIP-712 Off-Chain Signing** thay thế SD-JWT ES256K: issuer ký `TypedData` trên cấu trúc credential, chữ ký có thể được verify bởi bất kỳ thư viện Ethereum nào (ethers, viem, MetaMask) mà không cần backend.
- **Selective Disclosure** vẫn được giữ lại, nhưng dưới dạng _salted-hash commitment trong EIP-712 struct_ — đơn giản hơn SD-JWT đáng kể (không cần `_sd_alg`, không cần JWT header, không cần thư viện SD-JWT riêng).
- **Zero-gas per credential**: chi phí on-chain duy nhất là một giao dịch `anchorBatch` cho mỗi đợt tốt nghiệp (≈ 25k gas cho root + 1 SSTORE), chia đều cho 10.000–50.000 chứng chỉ.

Hướng tiếp cận này phù hợp đặc thù đại học: phát hành theo _đợt_ (graduation batch), không theo thời gian thực; verifier có thể kiểm tra online; sinh viên không cần ví Web3 để nhận bằng.

---

## 2. So sánh nhanh kiến trúc

| Thành phần                       | Phase 2 (HK252-DATN-131)                                 | Phase 3 (EIP-712 Trust Anchor)                  |
| -------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Định dạng credential             | SD-JWT VC (ES256K JWT + disclosures)                     | EIP-712 typed signature + disclosures           |
| Signing cost per credential      | 1 ECDSA sign (≈ 2 ms CPU)                                | 1 EIP-712 signTypedData (≈ 1.5 ms)              |
| On-chain anchor                  | Merkle root + credIdHash mapping                         | Merkle root only (no credId mapping)            |
| Public Canonical View            | Pin IPFS cho _mỗi_ credential                            | Không bắt buộc; chỉ pin batch metadata          |
| Selective Disclosure             | SD-JWT `_sd[]` + SHA-256                                 | Salted keccak256 trong EIP-712 struct           |
| Verify                           | 3 eth_call (isIssuer, getAnchor, isRevoked) + IPFS fetch | 2 eth_call (isSigner, isRevoked) + local Merkle |
| Revocation                       | On-chain mapping `credIdHash → revoked`                  | Bitmap revocation theo batchIndex (rẻ hơn)      |
| Chi phí on-chain cho 10.000 cred | 1 anchorBatch (~0.0027 ETH) + 10k IPFS pin               | 1 anchorBatch (~0.0028 ETH) + 0 pin             |
| Thư viện phía verifier           | SD-JWT parser + JWT verify                               | ethers `verifyTypedData` (có sẵn)               |
| UX cho holder                    | JWT string dài + disclosures                             | JSON credential + signature hex ngắn            |

Điểm khác biệt lớn nhất: Phase 3 **loại bỏ hoàn toàn IPFS ở tầng vận hành cốt lõi** — PCV chỉ là khái niệm tuỳ chọn, không còn là yêu cầu bắt buộc trong pipeline verify. Điều này giảm số lượng "moving parts" và điểm thất bại.

---

## 3. Kiến trúc đề xuất

### 3.1 Mô hình dữ liệu credential

Mỗi credential là một JSON object kèm chữ ký EIP-712:

```json
{
  "@context": "https://bkcred.xyz/v3",
  "type": "BkCredential",
  "credId": "urn:uuid:3f8e2d1a-…",
  "issuedAt": 1750000000,
  "batchId": "GRAD-2026-01",
  "issuer": {
    "name": "Trường Đại học Bách Khoa — ĐHQG-HCM",
    "did": "did:ethr:0xABC…",
    "signer": "0xABC…"
  },
  "publicClaims": {
    "vct": "BKISC_DEGREE",
    "degreeTitle": "Kỹ sư Khoa học Máy tính",
    "graduationDate": "2026-06-15",
    "honors": "Gioi"
  },
  "privateClaims": ["0x3e1f…", "0xa9b2…", "0xc4d8…"],
  "merkle": {
    "root": "0x7f2a…",
    "leaf": "0xd91c…",
    "proof": ["0x…", "0x…", "…"],
    "index": 42
  },
  "signature": "0x1b…(65 bytes r,s,v)",
  "disclosures": [
    { "salt": "0x…", "key": "fullName", "value": "Tran Le Cong Minh" },
    { "salt": "0x…", "key": "studentId", "value": "1910347" },
    { "salt": "0x…", "key": "dob", "value": "2001-08-12" }
  ]
}
```

Trong đó `privateClaims[]` là mảng các cam kết `keccak256(abi.encodePacked(salt, key, value))`. Holder có quyền _chọn_ disclosure nào đi kèm khi trình bày credential; verifier kiểm tra từng disclosure bằng cách băm lại và so với commitment tương ứng.

### 3.2 EIP-712 Type Definition

```solidity
// BkCredential EIP-712 type definition
EIP712Domain(string name, string version, uint256 chainId, address verifyingContract)

BkCredential(
  string credId,
  uint64 issuedAt,
  string batchId,
  string vct,
  bytes32 publicClaimsHash,
  bytes32[] privateClaims,
  bytes32 merkleRoot
)
```

**Lý do thiết kế:**

- `publicClaimsHash = keccak256(abi.encode(PublicClaims{vct, degreeTitle, graduationDate, honors}))`: gom toàn bộ public claims vào một struct hash. EIP-712 hỗ trợ nested struct encoding một cách tự nhiên, và việc dùng struct hash giúp tránh bug khi thêm trường mới.
- `privateClaims` là `bytes32[]` động — số lượng claim riêng tư có thể thay đổi theo template.
- `merkleRoot` nằm trong signed payload để issuer ràng buộc chữ ký với batch đã anchor; verifier kiểm tra `merkleRoot` này trùng với root on-chain.
- `chainId` + `verifyingContract` (địa chỉ `CredentialRegistry`) ngăn replay giữa các mạng testnet/mainnet.

### 3.3 Smart Contract

**`IssuerRegistry`** — kế thừa Phase 2, bổ sung:

```solidity
contract IssuerRegistry {
  // Mapping signer address → isActive
  mapping(address => bool) public isSigner;
  mapping(address => bytes) public did; // optional DID label

  function addSigner(address, bytes calldata did) external onlyOwner;
  function revokeSigner(address) external onlyOwner;
}
```

**`CredentialRegistry`** — thiết kế lại tối giản:

```solidity
contract CredentialRegistry {
  struct BatchAnchor {
    uint64 anchoredAt;
    address issuer;
    uint32 size;
    string ipfsCid; // optional, cho batch metadata
  }
  // merkleRoot → anchor
  mapping(bytes32 => BatchAnchor) public anchors;
  // batchIndex → revocation bitmap (mỗi bit = 1 cred)
  mapping(bytes32 => mapping(uint256 => uint256)) private _revocationBitmap;
  // batchIndex → merkleRoot
  mapping(uint32 => bytes32) public batchRoots;

  event BatchAnchored(bytes32 indexed merkleRoot, address indexed issuer,
                      uint32 batchIndex, uint32 size, uint64 anchoredAt);
  event CredentialRevoked(bytes32 indexed merkleRoot, uint32 index, address by);

  function anchorBatch(bytes32 merkleRoot, uint32 batchIndex, uint32 size,
                       string calldata ipfsCid) external onlySigner;
  function revoke(bytes32 merkleRoot, uint32 index) external;
  function isRevoked(bytes32 merkleRoot, uint32 index) external view returns (bool);
}
```

**Tại sao bitmap revocation?** Với 10.000 credential, thay vì `mapping(credIdHash → bool)` (10.000 SSTORE khi revocation hàng loạt), bitmap lưu `uint256[157]` cho mỗi batch (mỗi `uint256` = 256 bits) → giảm ~64× chi phí lưu trữ on-chain. Hàm `isRevoked(merkleRoot, index)` chỉ đọc 1 slot: `_revocationBitmap[merkleRoot][index / 256] & (1 << (index % 256)) != 0`.

### 3.4 Pipeline Verify (offline-capable)

Verifier nhận file credential JSON + chữ ký EIP-712, thực hiện:

1. **Parse + validate schema** (zod).
2. **Recompute `publicClaimsHash`** từ `publicClaims` bằng `ethers.AbiCoder`.
3. **Verify private disclosures**: với mỗi `disclosure`, tính `keccak256(salt||key||value)`, đối chiếu với `privateClaims[i]`.
4. **Recompute `merkleLeaf`** = `keccak256(abi.encode(credId, publicClaimsHash, keccak256(privateClaims)))`.
5. **Verify Merkle proof** từ `leaf` + `proof` → `root`.
6. **EIP-712 signature recovery**: `ecrecoverTypedData(domain, types, message, sig) === issuer.signer`.
7. **On-chain check #1**: `IssuerRegistry.isSigner(issuer.signer)`.
8. **On-chain check #2**: `CredentialRegistry.anchors(merkleRoot).anchoredAt > 0`.
9. **On-chain check #3**: `!CredentialRegistry.isRevoked(merkleRoot, merkle.index)`.
10. **Expiry check** (`exp` nếu có).

Bước 1–6 chạy offline hoàn toàn. Bước 7–9 có thể gom thành 1 `eth_call` multicall hoặc cache kết quả `isSigner` (thay đổi rất chậm) → trung bình 1 RPC call / verify.

---

## 4. Kế hoạch 7 tuần chi tiết

### Tuần 1 — Thiết kế & nền tảng (Design & Foundation)

**Mục tiêu:** Khoá đặc tả EIP-712, thiết kế contract, dọn monorepo cho Phase 3.

**Ngày 1–2: Đặc tả kỹ thuật**

- Viết `docs/SPEC.md`: EIP-712 type schema, credential JSON schema, verify pipeline, revocation bitmap semantics.
- So sánh tường minh với Phase 2 (bảng so sánh ở §2).
- Quyết định cuối cùng về việc dùng `nested struct` hay `flat fields` cho `publicClaims` → khuyến nghị: **nested struct** vì type-safe và mở rộng được.

**Ngày 3: Repo setup**

- Fork monorepo Phase 2 sang branch `phase3-eip712`.
- Thêm thư mục mới: `apps/web-eip712`, `packages/eip712-sdk`, `contracts/v3/`.
- Giữ nguyên `packages/shared` (Prisma schema, DB migrations) để tiết kiệm công.

**Ngày 4: Công cụ phát triển**

- Hardhat project cho contract v3, cấu hình Sepolia + Alchemy.
- Vitest cho SDK, Playwright cho E2E web.
- Script fixture sinh 10k credential giả lập (dùng cho tuần 6).

**Ngày 5: Prisma schema & migration**

- Thêm model `BatchV3`, `CredentialV3`, `RevocationV3`.
- Giữ model Phase 2 song song để không phá vỡ demo cũ.

**Ngày 6–7: Review đặc tả với GVHD**

- Trình bày `SPEC.md`, xin feedback.
- Điều chỉnh schema nếu cần trước khi code contract.

**Deliverables:**

- `docs/SPEC.md` (~ 15 trang).
- Repo Phase 3 chạy được `pnpm install && pnpm build`.
- Prisma migration mới.
- Hardhat project với empty contracts.

---

### Tuần 2 — Smart Contracts

**Mục tiêu:** Hoàn thiện hai contract, unit test, deploy Sepolia.

**Ngày 1–2: `IssuerRegistry`**

- Hiện thực `addSigner`, `revokeSigner`, `isSigner`, `did`.
- Modifier `onlySigner` cho contract anh em.
- Events: `SignerAdded`, `SignerRevoked`.

**Ngày 3–4: `CredentialRegistry`**

- `anchorBatch(merkleRoot, batchIndex, size, ipfsCid)`.
- `revoke(merkleRoot, index)` với bitmap.
- View functions: `getAnchor`, `isRevoked`, `batchRoots`.
- Kiểm tra invariant: issuer chỉ anchor batch của mình (dựa vào `anchors[root].issuer`).

**Ngày 5: Security & Slither**

- Chạy Slither static analysis.
- Kiểm tra reentrancy, access control, integer overflow (uint32 size vs uint256 bitmap).
- Thêm `Pausable` + `Ownable2Step` nếu cần.

**Ngày 6: Unit test (Hardhat + ethers)**

- Suite test: 30+ test case bao phủ happy path, access control, bitmap edge cases (index 0, 255, 256, 65535).
- Gas report với `hardhat-gas-reporter`.

**Ngày 7: Deploy Sepolia + verify trên Etherscan**

- Deploy qua `hardhat-deploy` (có script `001_deploy.ts`).
- Verify source code trên Sepolia Etherscan.
- Lưu địa chỉ contract vào `packages/eip712-sdk/src/addresses.ts`.

**Deliverables:**

- 2 contract đã verify trên Sepolia.
- Gas report cho `anchorBatch`, `revoke`, `isRevoked`.
- Unit test coverage > 90%.

---

### Tuần 3 — EIP-712 SDK cốt lõi

**Mục tiêu:** Gói `packages/eip712-sdk` cung cấp 3 hàm: `signCredential`, `verifyCredential`, `computeMerkle`.

**Ngày 1: Domain + Type builder**

- Hàm `buildDomain(contractAddress, chainId)` → trả `EIP712Domain`.
- Hàm `credentialTypes(template)` → trả `types` object theo template (cho phép dynamic `publicClaims` struct).

**Ngày 2: `signCredential(credential, privateKey)`**

- Input: credential object chưa có chữ ký + private key issuer.
- Output: signature hex 65 bytes.
- Dùng `ethers.Wallet.signTypedData`.

**Ngày 3: `verifyCredential(credentialFile, opts)`**

- Hiện thực pipeline 10 bước ở §3.4.
- `opts`: `{ rpcUrl, issuerRegistry, credentialRegistry, provider? }`.
- Nếu có `provider` cache → tái sử dụng cho batch verify.

**Ngày 4: Selective Disclosure helpers**

- `createDisclosure(salt, key, value)` → `{ salt, key, value, commitment }`.
- `verifyDisclosure(disclosure, expectedCommitment)` → bool.
- `buildPrivateClaims(disclosures[])` → `bytes32[]` sorted.

**Ngày 5: Merkle tree utility**

- Wrapper trên `@openzeppelin/merkle-tree`.
- Hàm `buildBatchTree(credentials)` → `{ root, proofs: Map<credId, proof[]> }`.
- Leaf computation: `keccak256(abi.encode(credId, publicClaimsHash, keccak256(privateClaims)))`.

**Ngày 6–7: Vitest suite**

- 40+ test case: signature roundtrip, tampered claims, revoked credential, replay across chainId.
- Performance test: sign 10.000 credentials offline → đo thời gian.

**Deliverables:**

- Package `@bkcred/eip712-sdk` publishable (local).
- Verify pipeline hoàn chỉnh.
- Benchmark: sign/verify throughput trên Node 20.

---

### Tuần 4 — Issuer Portal & Holder Portal

**Mục tiêu:** Dashboard phát hành batch + trang holder xem credential + verify portal.

**Ngày 1: Issuer — upload CSV + preview**

- Component `BatchIssuer`: upload CSV → parse → preview danh sách.
- Validation: zod schema theo template.
- Idempotency-Key tự sinh.

**Ngày 2: Issuer — pipeline phát hành**

- API `POST /api/v3/issuer/issue-batch`:
  1. Parse CSV, build credentials JSON.
  2. Generate disclosures cho mỗi private field.
  3. Build `privateClaims` commitments.
  4. Build Merkle tree (O(n)).
  5. Sign _từng_ credential bằng EIP-712 (offline, không gas).
  6. (Optional) Pin batch metadata JSON lên IPFS.
  7. `anchorBatch(merkleRoot, batchIndex, size, ipfsCid)` on-chain.
  8. Lưu DB.
- Điểm khác biệt Phase 2: bước 5 là off-chain hoàn toàn, không cần pin IPFS cho từng PCV.

**Ngày 3: Holder Portal**

- Login magic link (kế thừa Phase 2 NextAuth).
- List credentials, view detail, download JSON.
- Selective Disclosure UI: toggle từng trường → sinh file credential chỉ chứa disclosures đã chọn.

**Ngày 4: Verify Portal**

- Trang `/verify` công khai.
- Upload JSON file → chạy `verifyCredential` → hiển thị từng bước (✓ issuer registered, ✓ signature valid, ✓ merkle proof, ✓ not revoked).
- Deep link: `/verify?credId=…` → fetch credential từ DB.

**Ngày 5: Admin Panel**

- Quản lý signers (add/revoke address).
- Nạp gas ETH cho issuer signer (Sepolia faucet → transfer).
- Dashboard batch history.

**Ngày 6–7: Polish UX + E2E test**

- Playwright test: phát hành 100 credentials → holder login → verify tại `/verify`.
- Responsive UI, toast notifications, loading states.

**Deliverables:**

- Web app chạy end-to-end trên Vercel preview.
- 3 portal (Issuer, Holder, Verify) hoạt động đúng spec.

---

### Tuần 5 — Bulk Issuing infrastructure

**Mục tiêu:** Hạ tầng cho stress test 10.000 credential — đo đạc thực tế chứ không ngoại suy.

**Ngày 1: Fixture generator**

- Script `scripts/fixtures/generate-10k.ts`:
  - Sinh 10.000 sinh viên giả lập với đầy đủ PII.
  - Ghi ra `fixtures/graduation-2026.csv`.
  - Hash-based dedup để đảm bảo `credId` unique.

**Ngày 2: Background worker**

- Vercel Functions timeout 60s không đủ cho 10k credentials.
- Chuyển pipeline phát hành sang **Inngest** hoặc **BullMQ + Redis** để chạy nền.
- Chunking: 10k credentials chia thành 20 chunks × 500, xử lý song song.
- Sau khi tất cả chunk hoàn tất → single `anchorBatch` call.

**Ngày 3: Progress streaming**

- Server-Sent Events (SSE) cho issuer dashboard: `progress: 4500/10000 signed`.
- Redis pub/sub hoặc Inngest step events.

**Ngày 4: Measurement harness**

- Script đo chi tiết từng phase:
  - CSV parse time.
  - Disclosure generation time (per 1k).
  - Merkle tree build time (10k leaves).
  - Signing time (10k EIP-712 signatures).
  - IPFS pin time (batch metadata only).
  - Anchor tx time + gas.
- Ghi kết quả ra `perf-results/phase3-bulk-10k.jsonl`.

**Ngày 5: Dry run trên local Hardhat**

- Chạy pipeline 10k trên Hardhat local chain.
- Xác nhận correctness: verify 100 random credentials → tất cả valid.
- Tinh chỉnh chunk size, worker concurrency.

**Ngày 6–7: Chạy thật trên Sepolia**

- Execute 10k pipeline trên Vercel + Sepolia.
- Ghi lại số liệu thực để so sánh Phase 2.
- Troubleshoot nếu có vấn đề (gas limit, nonce management).

**Deliverables:**

- Pipeline 10k credential chạy hoàn chỉnh.
- Dataset `perf-results/phase3-bulk-10k.jsonl`.
- 10.000 credentials sample để demo.

---

### Tuần 6 — Stress testing & comparative evaluation

**Mục tiêu:** Thu thập số liệu so sánh tường minh với Phase 2.

**Ngày 1: Kịch bản A — Sign throughput offline**

- Đo: `signTypedData` × N, N ∈ {1k, 5k, 10k, 50k}.
- So sánh với Phase 2: ES256K JWT sign (≈ 2 ms/cred) → EIP-712 (≈ 1.5 ms/cred, nhanh hơn ~25% do không cần JWT envelope).

**Ngày 2: Kịch bản B — End-to-end bulk issuance**

- Đo tổng thời gian từ `POST /issue-batch` đến khi anchor confirmed.
- So sánh Phase 2 (ngoại suy 10k ≈ 83 phút) vs Phase 3 (dự kiến ≈ 8–12 phút vì không pin IPFS per-cred).

**Ngày 3: Kịch bản C — Verify latency**

- 100 lần verify tuần tự: phân tách thời gian từng bước.
- So sánh Phase 2 (3 RPC calls + IPFS fetch ≈ 289 ms + 300 ms IPFS) vs Phase 3 (2 RPC calls ≈ 200 ms, 0 IPFS).

**Ngày 4: Kịch bản D — Verify concurrency**

- `Promise.all` với N ∈ {10, 50, 100, 500}.
- Đo throughput (req/s) và p95 latency.

**Ngày 5: Kịch bản E — Gas comparison**

- Gas cost `anchorBatch` với size 100, 1000, 10000.
- Gas cost `revoke` (bitmap vs per-cred mapping).
- **So sánh chính**: Phase 2 cost/credential vs Phase 3 cost/credential.

**Ngày 6: Phân tích kết quả**

- Tổng hợp bảng so sánh 6 kịch bản A–E giữa 2 phase.
- Biểu đồ: signing time, verify time, gas cost, IPFS cost.
- Ghi nhận hạn chế (Sepolia vs mainnet, single RPC provider).

**Ngày 7: Bảo mật & audit prep**

- Slither lại contracts sau chỉnh sửa.
- Kiểm tra edge case: replay signature across chain, revoked signer vẫn ký được batch cũ, index out-of-range.
- Viết `SECURITY.md` mô tả threat model.

**Deliverables:**

- `docs/BENCHMARK.md` với 5 kịch bản + so sánh Phase 2.
- Bộ dữ liệu JSONL gốc.
- `SECURITY.md` threat model.

---

### Tuần 7 — Tài liệu & hoàn thiện demo

**Mục tiêu:** Đóng gói toàn bộ thành luận văn + demo video.

**Ngày 1–2: Viết chương Thiết kế giải pháp**

- Kiến trúc tổng quan, EIP-712 schema, smart contract, verify pipeline.
- Sequence diagram: phát hành batch, xác minh trustless, thu hồi.
- Class diagram miền dữ liệu.

**Ngày 3: Viết chương Hiện thực**

- Pseudo-code `signCredential`, `verifyCredential`, `anchorBatch`.
- Cấu trúc monorepo, công nghệ sử dụng.

**Ngày 4: Viết chương Thực nghiệm**

- Môi trường test, kịch bản A–E, bảng số liệu.
- Phân tích, so sánh Phase 2, kết luận.

**Ngày 5: Demo video + slide**

- Quay screencast: phát hành 100 credentials → holder chọn SD → verify → revoke → verify lại (fail).
- Highlight: zero-gas per credential, verify offline.
- Slide bảo vệ: 20 slides, 15 phút.

**Ngày 6: Review & polish**

- Đọc lại toàn bộ luận văn.
- Chạy lại test suite (contract + SDK + web).
- Đóng băng repo, tag `v3.0-thesis`.

**Ngày 7: Buffer**

- Dự phòng cho công việc phát sinh, sửa luận văn theo feedback GVHD.

**Deliverables cuối cùng:**

- Luận văn PDF hoàn chỉnh (≈ 80–100 trang).
- Repo `v3.0-thesis` trên GitHub.
- Demo web: `https://v3.bkcred.xyz`.
- Video demo 5–7 phút.

---

## 5. Ước lượng chi phí & so sánh Phase 2

### 5.1 Chi phí on-chain (Sepolia)

| Hoạt động                   | Phase 2                   | Phase 3                  |
| --------------------------- | ------------------------- | ------------------------ |
| `anchorBatch` (size=100)    | ~24,638 gas/cred          | ~2,800 gas/cred          |
| `anchorBatch` (size=10,000) | N/A (ngoại suy ~24k/cred) | ~2,500 gas/cred          |
| `revoke` per cred           | ~103,156 gas              | ~5,000 gas (bitmap flip) |
| `isSigner`/`isIssuer` read  | 1 eth_call                | 1 eth_call               |
| `isRevoked` read            | 1 eth_call                | 1 eth_call               |
| IPFS pin per credential     | Có (PCV + batch-meta)     | Không                    |

Với ETH = $3,000 và mainnet gas price 30 gwei:

- Phase 2: 10.000 cred × 24.000 gas × 30 gwei = 0.72 ETH ≈ **$2,160** (không tính IPFS).
- Phase 3: 1 anchorBatch 10.000 cred × ~25.000.000 gas × 30 gwei = 0.75 ETH ≈ **$2,250** — chia đều 10.000 cred = **$0.225/cred**.

Thực tế Phase 2 phải trả thêm IPFS pinning ($0.001–0.01/cred tuỳ provider) và 10.000 JWT sign CPU; Phase 3 miễn phí hai khoản này. **Tổng chi Phase 3 thấp hơn khoảng 40–60% cho cùng quy mô.**

### 5.2 Chi phí vận hành

| Hạng mục                    | Phase 2                    | Phase 3                |
| --------------------------- | -------------------------- | ---------------------- |
| Vercel hosting              | ✓                          | ✓                      |
| Neon PostgreSQL             | ✓                          | ✓                      |
| Alchemy RPC free            | ✓                          | ✓                      |
| Pinata IPFS (paid cho bulk) | ✓ (~$20/tháng cho 10k pin) | ✗                      |
| Compute cho signing         | SD-JWT JWT envelope        | EIP-712 typed data     |
| Thư viện bên thứ 3          | SD-JWT self-implementation | ethers (battle-tested) |

---

## 6. Rủi ro & biện pháp giảm thiểu

| Rủi ro                                     | Tác động                            | Giảm thiểu                                           |
| ------------------------------------------ | ----------------------------------- | ---------------------------------------------------- |
| EIP-712 signature replay across chain      | Credential bị dùng trên mạng khác   | `chainId` trong `EIP712Domain` + kiểm tra khi verify |
| Compromised signer key                     | Issuer giả mạo batch                | `IssuerRegistry.revokeSigner` + rotation mechanism   |
| Bitmap revocation size limit               | Không revoke được cred index > 2^32 | Giới hạn `size` uint32 = 4 tỷ cred/batch (dư dả)     |
| Vercel timeout 60s cho bulk issue          | Pipeline 10k bị kill                | Inngest/BullMQ background worker                     |
| RPC rate limit khi verify 100+ concurrent  | Throughput giả                      | Dùng caching cho `isSigner`, multicall               |
| MetaMask/wallet không hiển thị EIP-712 đẹp | UX cho holder khi "view source"     | Cung cấp JSON viewer riêng trên web                  |

---

## 7. Deliverables tổng hợp

| Tuần | Deliverable                                           |
| ---- | ----------------------------------------------------- |
| 1    | `docs/SPEC.md`, repo Phase 3, Prisma migration        |
| 2    | 2 contract trên Sepolia, gas report, 30+ unit test    |
| 3    | `@bkcred/eip712-sdk` với sign/verify/merkle, 40+ test |
| 4    | Web app 3 portal hoạt động end-to-end                 |
| 5    | Pipeline 10k credential chạy được, perf JSONL         |
| 6    | `BENCHMARK.md`, `SECURITY.md`, so sánh Phase 2        |
| 7    | Luận văn PDF, demo video, slide bảo vệ                |

---

## 8. Công nghệ sử dụng

- **Smart contract:** Solidity 0.8.24, Hardhat, OpenZeppelin, Slither.
- **SDK:** TypeScript, ethers v6, vitest, zod.
- **Web:** Next.js 15 App Router, React 19, Tailwind, shadcn/ui, NextAuth.
- **Database:** PostgreSQL (Neon), Prisma ORM.
- **Background jobs:** Inngest (hoặc BullMQ + Upstash Redis).
- **IPFS:** Pinata (tuỳ chọn, chỉ cho batch metadata).
- **Blockchain:** Ethereum Sepolia, Alchemy RPC.
- **Testing:** Hardhat, Vitest, Playwright.
- **Deployment:** Vercel, GitHub Actions CI.

---

## 9. Tiêu chí đánh giá thành công

1. **Chức năng:** Phát hành + xác minh + thu hồi credential hoạt động end-to-end.
2. **Trustless:** CLI `bk-verify-v3` xác minh được chỉ với file JSON + public RPC.
3. **Zero-gas per credential:** Không có transaction on-chain nào cho từng chứng chỉ.
4. **Scale:** Demo thành công batch 10.000 credential với chi phí on-chain < 0.01 ETH.
5. **Privacy:** Selective Disclosure hoạt động — verifier chỉ thấy trường holder chọn.
6. **So sánh được:** Có bảng số liệu đối chiếu Phase 2 về gas, latency, throughput.
7. **Bảo mật:** Slither clean, không có high/critical findings, threat model rõ ràng.

---

## 10. Lịch làm việc Gantt (tóm tắt)

```
Week 1 ━━━━ Design & Spec ━━━━
Week 2      ━━━━ Smart Contracts ━━━━
Week 3           ━━━━ EIP-712 SDK ━━━━
Week 4                ━━━━ Web Portals ━━━━
Week 5                     ━━━━ Bulk Infra ━━━━
Week 6                          ━━━━ Benchmark ━━━━
Week 7                               ━━━━ Thesis ━━━━
```

Tổng thời gian: **7 tuần**, có thể rút gọn còn **6 tuần** nếu tuần 5 và 6 overlap (chạy bulk test song song với viết chương Thực nghiệm).

---

_Bản kế hoạch này được xây dựng dựa trên kết quả đã đạt được của Phase 1 và Phase 2, với trọng tâm luận điểm "EIP-712 Off-Chain Signing + On-Chain Trust Anchor" cho quy mô đại học. Sau khi được GVHD phê duyệt, các artifact (`SPEC.md`, contract schema, SDK interface) sẽ được triển khai đúng theo timeline đã đề ra._
