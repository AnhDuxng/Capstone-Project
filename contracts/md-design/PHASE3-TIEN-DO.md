# Phase 3 — Theo dõi tiến độ

> Cập nhật lần cuối: 2026-09-21  
> Kế hoạch gốc: [PHASE3-KE-HOACH-EIP712-TRUST-ANCHOR.md](./PHASE3-KE-HOACH-EIP712-TRUST-ANCHOR.md)

---

## Tổng quan

| Tuần | Tên                      | Tiến độ         | Status          |
| ---- | ------------------------ | --------------- | --------------- |
| 1    | Thiết kế & nền tảng      | ██████████ 100% | ✅ Hoàn thành   |
| 2    | Smart Contracts          | ██████████ 100% | ✅ Hoàn thành   |
| 3    | EIP-712 SDK cốt lõi      | ██████████ 100% | ✅ Hoàn thành   |
| 4    | Issuer & Holder Portal   | ██████████ 100% | ✅ Hoàn thành   |
| 5    | Bulk Issuing infra       | ██████████ 100% | ✅ Hoàn thành   |
| 6    | Stress test & evaluation | ██████████ 100% | ✅ Hoàn thành   |
| 7    | Tài liệu & demo          | ░░░░░░░░░░ 0%   | ⏳ Chưa bắt đầu |

---

## Tuần 1 — Thiết kế & nền tảng

### Ngày 1–2: Đặc tả kỹ thuật

- [x] Viết `docs/SPEC.md`: EIP-712 type schema, credential JSON schema, verify pipeline, revocation bitmap
- [x] So sánh tường minh với Phase 2 (bảng so sánh §2)
- [x] Quyết định `nested struct` cho `publicClaims`

📁 Output: [`docs/SPEC.md`](../docs/SPEC.md) (~56 KB, hoàn chỉnh)

### Ngày 3: Repo setup

- [x] ~~Fork monorepo sang branch~~ → Giữ flat structure trên `main`
- [x] Tạo `IssuerRegistry.sol` skeleton (Ownable2Step, custom errors)
- [x] Tạo `CredentialRegistryV3.sol` skeleton (anchorBatch, bitmap revocation)
- [x] Tạo `deploy-v3.ts` deploy script
- [x] Tạo test suites: 29 tests passing
- [x] Nâng Solidity 0.8.20 → 0.8.24

📁 Output: [`IssuerRegistry.sol`](../contracts/IssuerRegistry.sol), [`CredentialRegistryV3.sol`](../contracts/CredentialRegistryV3.sol)

### Ngày 4: Công cụ phát triển

- [x] Hardhat project cho contract v3, cấu hình Sepolia + Alchemy (có sẵn từ Phase 2)
- [ ] ~~Vitest cho SDK~~ → Chuyển sang **Tuần 3** (khi code SDK)
- [ ] ~~Playwright cho E2E web~~ → Chuyển sang **Tuần 4** (khi code web portal)
- [x] Script fixture sinh 10k credential giả lập

📁 Output: [`generate-10k.ts`](../scripts/fixtures/generate-10k.ts), [`graduation-2026.csv`](../fixtures/graduation-2026.csv) (10k records, 1.6 MB, 193ms)

### Ngày 5: Prisma schema & migration

- [x] Thêm model `BatchV3`, `CredentialV3`, `RevocationV3`, `DisclosureV3`
- [x] Giữ model Phase 2 song song (coexist với suffix `_v3`)
- [x] Cấu hình Prisma Client singleton ([`lib/prisma.ts`](../web/lib/prisma.ts))
- [x] Chạy `npx prisma generate` thành công (Prisma v6)

📁 Output: [`schema.prisma`](../web/prisma/schema.prisma), [`lib/prisma.ts`](../web/lib/prisma.ts)

### Ngày 6–7: Review đặc tả với GVHD

- [ ] Trình bày `SPEC.md`, xin feedback
- [ ] Điều chỉnh schema nếu cần

### Deliverables Tuần 1

| Deliverable                       | Status | Ghi chú                                 |
| --------------------------------- | ------ | --------------------------------------- |
| `docs/SPEC.md` (~15 trang)        | ✅     | 56 KB, hoàn chỉnh                       |
| Repo Phase 3 build được           | ✅     | `npx hardhat compile` OK, 29 tests pass |
| Prisma migration mới              | 🔄     | Đang làm                                |
| Hardhat project + empty contracts | ✅     | 2 skeleton contracts + gas report       |

---

## Tuần 2 — Smart Contracts

### Ngày 1–2: `IssuerRegistry`

- [x] Hiện thực `addSigner`, `revokeSigner`, `isSigner`, `did`, `updateDid`
- [x] Danh sách signer & phân trang (`getAllSigners`, `getSigners`, `getSignerCount`)
- [x] Ownable2Step ownership transfer bảo mật 2 bước
- [x] Events: `SignerAdded`, `SignerRevoked`, `SignerDidUpdated`
- [x] Unit test suite đầy đủ (20 test cases passing)

📁 Output: [`IssuerRegistry.sol`](../contracts/IssuerRegistry.sol), [`IssuerRegistry.test.ts`](../test/IssuerRegistry.test.ts)

### Ngày 3–4: `CredentialRegistryV3`

- [x] `anchorBatch(merkleRoot, size, ipfsCid)` với kiểm tra `ZeroBatchSize`, `ZeroMerkleRoot`
- [x] `revoke(merkleRoot, index)` với bitmap & kiểm tra `NotOriginalIssuer`, `NotActiveSigner`
- [x] Thu hồi hàng loạt `revokeBatch(merkleRoot, indices[])` tối ưu gas
- [x] View functions & phân trang: `getAnchor`, `isRevoked`, `isRevokedBatch`, `getBatchCount`, `getBatches`
- [x] Invariant & access control: chỉ Issuer gốc của batch & Signer active mới được anchor/revoke
- [x] Unit test suite đầy đủ (27 test cases passing)

📁 Output: [`CredentialRegistryV3.sol`](../contracts/CredentialRegistryV3.sol), [`CredentialRegistryV3.test.ts`](../test/CredentialRegistryV3.test.ts)

### Ngày 5: Security & Slither

- [x] Đánh giá an toàn static analysis (Checklist Slither detector mapping)
- [x] Kiểm tra reentrancy, access control, integer overflow / index bounds (51 test cases passing)
- [x] Thêm cơ chế tạm dừng khẩn cấp `Pausable` + `Ownable2Step` cho `CredentialRegistryV3`
- [x] Viết báo cáo phân tích bảo mật [`docs/SECURITY.md`](../docs/SECURITY.md)

📁 Output: [`SECURITY.md`](../docs/SECURITY.md), [`CredentialRegistryV3.sol`](../contracts/CredentialRegistryV3.sol)

### Ngày 6: Unit test (Hardhat + ethers) & Coverage

- [x] 52 test cases bao phủ happy path, access control, bitmap edge cases (index 0, 255, 256, 65535, 99999)
- [x] Code coverage đạt **100% Statements / 100% Lines / 100% Functions** cho cả 2 Smart Contracts (`solidity-coverage`)
- [x] Gas report chi tiết với `hardhat-gas-reporter`: `anchorBatch` (~105k gas/batch), `revoke` (~56k gas), `revokeBatch` (~90k gas cho 4 items)

📁 Output: [`CredentialRegistryV3.test.ts`](../test/CredentialRegistryV3.test.ts), [`IssuerRegistry.test.ts`](../test/IssuerRegistry.test.ts), `./coverage/`

### Ngày 7: Deploy Sepolia / Local & Manifest

- [x] Chạy script deploy `deploy-v3.ts` và tạo manifest tự động [`deployments-v3.json`](../deployments-v3.json)
- [x] Verify source code & cấu hình Sepolia (`hardhat.config.ts` + Etherscan V2 API config)
- [x] Lưu địa chỉ contract vào file cấu hình manifest phục vụ SDK & Web App

📁 Output: [`deploy-v3.ts`](../scripts/deploy-v3.ts), [`deployments-v3.json`](../deployments-v3.json)

### Deliverables Tuần 2

| Deliverable                  | Status | Ghi chú                                                            |
| ---------------------------- | ------ | ------------------------------------------------------------------ |
| 2 contract deploy & manifest | ✅     | `IssuerRegistry` + `CredentialRegistryV3` (`deployments-v3.json`)  |
| Gas report                   | ✅     | `anchorBatch` ~105k gas, `revoke` ~56k gas, `revokeBatch` ~90k gas |
| Unit test coverage > 90%     | ✅     | **100% Lines & Statements** (52/52 passing tests)                  |

---

## Tuần 3 — EIP-712 SDK cốt lõi

### Ngày 1: Domain + Type builder

- [x] `buildDomain(contractAddress, chainId, name?, version?)` → trả về `EIP712Domain` chuẩn checksummed
- [x] `credentialTypes()` → trả về `types` map theo đúng SPEC.md §2.5 (`PublicClaims` nested struct + `BkCredential`)
- [x] TypeScript interfaces hoàn chỉnh: `PublicClaims`, `BkCredentialPayload`, `CredentialFile`, `Disclosure`, `MerkleProofData`
- [x] Unit test suite cho SDK Domain & Types (6 test cases passing)

📁 Output: [`src/sdk/domain.ts`](../src/sdk/domain.ts), [`src/sdk/index.ts`](../src/sdk/index.ts), [`test/sdk/domain.test.ts`](../test/sdk/domain.test.ts)

### Ngày 2: `signCredential(credential, privateKey)`

- [x] `signCredential(payload, signer, domain)` → tạo chữ ký EIP-712 65 bytes hex (`0x...` r, s, v)
- [x] `recoverSignerAddress(payload, signature, domain)` → khôi phục địa chỉ ví đã ký bằng `ethers.verifyTypedData`
- [x] `verifySignature(payload, signature, expectedSignerAddress, domain)` → kiểm tra chữ ký & khả năng chống chỉnh sửa
- [x] Kiểm tra chống gian lận & chống Replay Attack (sai `publicClaims`, `merkleRoot`, `privateClaims`, hoặc sai `chainId`/`contractAddress` đều làm verify thất bại)
- [x] Unit test suite cho SDK Signing & Verification (13 test cases passing)

📁 Output: [`src/sdk/signer.ts`](../src/sdk/signer.ts), [`test/sdk/signer.test.ts`](../test/sdk/signer.test.ts)

### Ngày 3: `verifyCredential(credentialFile, opts)`

- [x] Pipeline 10 bước chuẩn hóa theo [SPEC.md §7](file:///d:/DACN-main/contracts/docs/SPEC.md#L808-L1012):
  1. `INVALID_SCHEMA` (Zod parse credId, did:ethr, signature 65-byte format)
  2. Recompute `publicClaimsHash` (TypedDataEncoder)
  3. `DISCLOSURE_MISMATCH` (Kiểm tra disclosures commitment)
  4. `LEAF_MISMATCH` (Tính lại OpenZeppelin double keccak256 leaf hash)
  5. `INVALID_MERKLE_PROOF` (StandardMerkleTree.verify proof path)
  6. `SIGNATURE_MISMATCH` (Recovers EIP-712 signer address)
  7. `SIGNER_NOT_REGISTERED` (Check `IssuerRegistry.isSigner`)
  8. `BATCH_NOT_ANCHORED` (Check `CredentialRegistryV3.getAnchor`)
  9. `CREDENTIAL_REVOKED` (Check `CredentialRegistryV3.isRevoked` bitmap)
  10. `CREDENTIAL_EXPIRED` (Check timestamp hết hạn `exp`)
- [x] Tùy chọn `skipOnlineChecks: true` cho chế độ xác minh offline (bước 1–6 + 10)
- [x] Unit test suite cho Verification Pipeline (11 test cases passing)

📁 Output: [`src/sdk/verifier.ts`](../src/sdk/verifier.ts), [`test/sdk/verifier.test.ts`](../test/sdk/verifier.test.ts)

### Ngày 4: Selective Disclosure helpers

- [x] `createDisclosure(key, value, salt?)` → sinh salt ngẫu nhiên 32 bytes & tính commitment hash `keccak256(abi.encodePacked(salt, key, value))`
- [x] `computeDisclosureCommitment(salt, key, value)` → hàm tính salted-hash commitment dùng `ethers.solidityPackedKeccak256`
- [x] `verifyDisclosure(disclosure, expectedCommitment)` → đối chiếu disclosure với commitment hoặc mảng `privateClaims[]`
- [x] `buildPrivateClaims(disclosures[])` → mảng 32-byte hex commitments phục vụ `BkCredentialPayload.privateClaims`
- [x] `filterDisclosures(disclosures[], selectedKeys[])` → trợ thủ lọc disclosures theo danh sách trường được Holder cấp phép chia sẻ
- [x] Unit test suite cho Selective Disclosure Helpers (9 test cases passing)

📁 Output: [`src/sdk/disclosure.ts`](../src/sdk/disclosure.ts), [`test/sdk/disclosure.test.ts`](../test/sdk/disclosure.test.ts)

### Ngày 5: Merkle tree utility

- [x] Wrapper trên `@openzeppelin/merkle-tree` (`StandardMerkleTree`)
- [x] `computePublicClaimsHash(publicClaims)` & `computePrivateClaimsHash(privateClaims)`
- [x] `buildBatchTree(credentials)` → `{ root, proofsMap, tree }`
- [x] `verifyMerkleProof(root, leafTuple, proof)` → `boolean`
- [x] Unit test suite cho Merkle Tree Utility (6 test cases passing)

📁 Output: [`src/sdk/merkle.ts`](../src/sdk/merkle.ts), [`test/sdk/merkle.test.ts`](../test/sdk/merkle.test.ts)

### Ngày 6–7: Test suite & Performance benchmark

- [x] 45 test cases cho SDK (Domain, Signer, Verifier, Disclosure, Merkle) + 51 test cases Smart Contracts = **96 test cases passing 100%**
- [x] Benchmark script [`scripts/benchmark-sdk.ts`](../scripts/benchmark-sdk.ts) đo hiệu năng thực tế:
  - **Selective Disclosure Generation:** ~24,570 ops/sec (10,000 items in 407 ms)
  - **Merkle Tree Construction:** 1,000 items in 1.3s | 10,000 items in 14.0s
  - **EIP-712 Signing:** **~779 credentials/sec** (1,000 items in 1,283 ms)
  - **10-Step Verification Pipeline:** **~202 verifications/sec** (1,000 items in 4,942 ms)

📁 Output: [`scripts/benchmark-sdk.ts`](../scripts/benchmark-sdk.ts)

### Deliverables Tuần 3

| Deliverable                        | Status        |
| ---------------------------------- | ------------- |
| EIP-712 SDK (`src/sdk/`)           | ✅ Hoàn thành |
| Verify pipeline 10 bước hoàn chỉnh | ✅ Hoàn thành |
| Benchmark sign/verify throughput   | ✅ Hoàn thành |

---

## Tuần 4 — Issuer Portal & Holder Portal

### Ngày 1: Issuer — upload CSV + preview

- [x] Component `BatchIssuer`: upload CSV → parse → preview
- [x] Validation: zod schema

### Ngày 2: Issuer — pipeline phát hành

- [x] API `POST /api/v3/issuer/issue-batch` (8 bước pipeline)
- [x] Thao tác nhanh & Dashboard đợt cấp phát V3
- [x] Trang xem lịch sử đợt cấp (Batch History)
- [x] Trang chi tiết đợt cấp (Batch Detail) và thu hồi đơn lẻ

### Ngày 3: Holder Portal

- [x] Login Privy email, list credentials, download JSON
- [x] Selective Disclosure UI (toggle ẩn/hiện, tải bản trình bày JSON)

### Ngày 4: Verify Portal

- [x] Upload JSON → `verifyCredential` → hiển thị từng bước
- [x] Deep link: `/v3/verify?credId=…`

### Ngày 5: Admin Panel

- [x] Quản lý signers (thêm/thu hồi on-chain)
- [x] Quản lý thu hồi on-chain & đồng bộ DB

### Ngày 6–7: Polish UX + Integration

- [x] Tích hợp Sidebar/Header, banner quảng bá Phase 3
- [x] Responsive UI, toast, loading states, compile 100% sạch

### Deliverables Tuần 4

| Deliverable                                       | Status | Ghi chú                             |
| ------------------------------------------------- | ------ | ----------------------------------- |
| Web app E2E (dashboard, issuer, holder, verifier) | ✅     | Hoàn thành, 100% typescript checked |
| 3 portal hoạt động đúng spec                      | ✅     | Đã chạy và tích hợp thành công      |

---

## Tuần 5 — Bulk Issuing Infrastructure

### Ngày 1: Fixture generator

- [x] `generate-10k.ts` — đã làm sớm (Tuần 1 Ngày 4)

### Ngày 2: Background worker & Chunking Engine

- [x] Chunking 20 × 500 (`chunkArray` & `executeBulkIssuancePipeline`) trong [`contracts/src/sdk/bulk.ts`](../src/sdk/bulk.ts)
- [x] Background Job Manager (`BulkJobManager`) trong [`web/lib/v3/job-manager.ts`](../../web/lib/v3/job-manager.ts)
- [x] Async Bulk Issuance API Route (`POST /api/v3/issuer/issue-batch/async`) & Job polling (`GET /api/v3/issuer/jobs/[jobId]`)
- [x] Standalone Bulk Issuance Worker CLI [`scripts/workers/bulk-issuance-worker.ts`](../scripts/workers/bulk-issuance-worker.ts)
- [x] Chạy thực tế 10.000 credentials trong **27.82s** (Signing: 804 creds/sec, Verification sampling: 100% pass)
- [x] Unit test suite đầy đủ cho Bulk module ([`test/sdk/bulk.test.ts`](../test/sdk/bulk.test.ts)) — 100/100 tests pass

📁 Output: [`src/sdk/bulk.ts`](../src/sdk/bulk.ts), [`web/lib/v3/job-manager.ts`](../../web/lib/v3/job-manager.ts), [`scripts/workers/bulk-issuance-worker.ts`](../scripts/workers/bulk-issuance-worker.ts), [`test/sdk/bulk.test.ts`](../test/sdk/bulk.test.ts)

### Ngày 3: Progress streaming (Server-Sent Events)

- [x] SSE Event Subscription trong [`web/lib/v3/job-manager.ts`](../../web/lib/v3/job-manager.ts) (`subscribe`, `unsubscribe`, `notifySubscribers`)
- [x] Server-Sent Events API Route [`GET /api/v3/issuer/jobs/[jobId]/stream`](../../web/app/api/v3/issuer/jobs/[jobId]/stream/route.ts)
- [x] Tích hợp Live Progress Monitor cho Issuer Dashboard ([`web/app/admin/v3/issue/page.tsx`](../../web/app/admin/v3/issue/page.tsx))
- [x] Hiển thị chi tiết Stage Indicators (Cam kết Salt → Merkle Tree → Ký EIP-712 → Lưu CSDL), Progress bar $0\% \rightarrow 100\%$, Chunk counters, Live Throughput (ops/s) và Terminal Live Log ticker.

📁 Output: [`web/app/api/v3/issuer/jobs/[jobId]/stream/route.ts`](../../web/app/api/v3/issuer/jobs/[jobId]/stream/route.ts), [`web/app/admin/v3/issue/page.tsx`](../../web/app/admin/v3/issue/page.tsx)

### Ngày 4: Measurement harness & Empirical Benchmark Dataset

- [x] Script đo đạc đa tầng chuyên sâu [`scripts/measurement-harness.ts`](../scripts/measurement-harness.ts)
- [x] Đo lường chi tiết 6 pha: CSV parsing, Disclosure generation, Merkle tree construction, EIP-712 signing, IPFS formatting, On-chain gas amortized cost, và 100-sample verification latency distribution.
- [x] Xuất bộ dữ liệu thô chuẩn JSON Lines [`perf-results/phase3-bulk-10k.jsonl`](../perf-results/phase3-bulk-10k.jsonl)
- [x] Xuất báo cáo tổng kết thực nghiệm [`perf-results/PHASE3-BULK-10K-BENCHMARK.md`](../perf-results/PHASE3-BULK-10K-BENCHMARK.md):
  - Ký EIP-712: **850 creds/s**
  - Tổng thời gian 10.000 chứng chỉ: **25.81s** (~**387 creds/s**)
  - Chi phí phân bổ on-chain: **10.5 gas/credential** ($O(1)$ thay vì $O(N)$)
  - Độ trễ xác minh offline: **5.89 ms** (p50: 5.53 ms, p90: 6.84 ms)

📁 Output: [`scripts/measurement-harness.ts`](../scripts/measurement-harness.ts), [`perf-results/phase3-bulk-10k.jsonl`](../perf-results/phase3-bulk-10k.jsonl), [`perf-results/PHASE3-BULK-10K-BENCHMARK.md`](../perf-results/PHASE3-BULK-10K-BENCHMARK.md)

### Ngày 5: Dry run trên local Hardhat & Full On-Chain Verification

- [x] Script thử nghiệm toàn trình [`scripts/dry-run-local-10k.ts`](../scripts/dry-run-local-10k.ts) triển khai contract, đăng ký signer, cấp phát 10k và neo on-chain
- [x] Pipeline 10k hoàn thành trong **22.18s** (Tốc độ ký EIP-712: **1.228 creds/s**)
- [x] Giao dịch `anchorBatch` on-chain thành công (167.804 gas, phân bổ ~16.78 gas/cred)
- [x] Xác minh 100/100 mẫu ngẫu nhiên qua **toàn bộ 10 bước xác minh on-chain** (`skipOnlineChecks: false`) — Tỉ lệ đạt **100% Pass**
- [x] Kiểm thử bất biến bảo mật:
  - Thu hồi on-chain bitmap chỉ số 42 $\rightarrow$ Xác minh trả về lỗi `CREDENTIAL_REVOKED` đúng chuẩn
  - Kiểm tra chỉ số liền kề 43 $\rightarrow$ Vẫn hợp lệ (không bị ảnh hưởng bitwise)
  - Thử nghiệm sửa đổi dữ liệu công khai $\rightarrow$ Bị chặn tại bước 4 (`LEAF_MISMATCH`)
  - Thử nghiệm sửa đổi cam kết ẩn danh $\rightarrow$ Bị chặn tại bước 3 (`DISCLOSURE_MISMATCH`)

📁 Output: [`scripts/dry-run-local-10k.ts`](../scripts/dry-run-local-10k.ts)

### Ngày 6–7: Chạy thật trên Sepolia

- [x] Execute 10k pipeline thành công trên Sepolia Testnet ([`scripts/execute-sepolia-10k.ts`](../scripts/execute-sepolia-10k.ts))
- [x] Ghi lại số liệu thực nghiệm on-chain & đối chiếu Sepolia Etherscan:
  - **Transaction Hash:** [`0x54b11343452cc34c4e73b992cdc3dfacb386a9f0a207dbc82822cc59c3734d3e`](https://sepolia.etherscan.io/tx/0x54b11343452cc34c4e73b992cdc3dfacb386a9f0a207dbc82822cc59c3734d3e)
  - **Block Number:** `11654826` (Thời gian xác nhận block: `10.65 s`)
  - **Contract CredentialRegistryV3:** [`0xa5FaCAeA0925e9D1cEFb6a2E7A0509Ed63378c9f`](https://sepolia.etherscan.io/address/0xa5FaCAeA0925e9D1cEFb6a2E7A0509Ed63378c9f)
  - **IssuerRegistry:** [`0x5B7f91FF33EB0032Ce803aCF2B9f00a6DbaD744F`](https://sepolia.etherscan.io/address/0x5B7f91FF33EB0032Ce803aCF2B9f00a6DbaD744F)
  - **Signer:** `0x6dc04124c8032a72E579de839747c55FB0d5329B`
  - **Merkle Root:** `0xc3689e9f25b9c247d87a6c3b83aba9f55b1251ccc365ad1fc47901842cf683f7`
  - **Gas tiêu thụ on-chain:** `167,804 gas` (chi phí phân bổ siêu nhỏ: **16.78 gas/credential**)
  - **Phí giao dịch thực:** `0.000188 SepoliaETH` (Effective Gas Price: `1.12 Gwei`)
  - **Xác minh Live On-Chain:** **10/10 Passed (100% Pass Rate)**
  - **Result on Sepolia testnet: https://sepolia.etherscan.io/tx/0x54b11343452cc34c4e73b992cdc3dfacb386a9f0a207dbc82822cc59c3734d3e**

📁 Output: [`scripts/execute-sepolia-10k.ts`](../scripts/execute-sepolia-10k.ts)

### Deliverables Tuần 5

| Deliverable             | Status | Ghi chú                                                 |
| ----------------------- | ------ | ------------------------------------------------------- |
| Pipeline 10k hoàn chỉnh | ✅     | Đã chạy thực tế cả Local & Sepolia Testnet              |
| Dataset `perf-results/` | ✅     | `phase3-bulk-10k.jsonl`, `PHASE3-BULK-10K-BENCHMARK.md` |
| 10k credentials sample  | ✅     | Xác minh Live On-Chain 100% Pass Rate                   |

---

## Tuần 6 — Stress Testing & Comparative Evaluation

### Ngày 1: Benchmark Scenarios A–E Script

- [x] Thiết kế và hiện thực script benchmark toàn diện [`scripts/benchmark-scenarios.ts`](../scripts/benchmark-scenarios.ts) với 5 kịch bản đánh giá chuyên sâu
- [x] Hỗ trợ chạy riêng từng kịch bản (`--scenario=A,C,E`) hoặc toàn bộ
- [x] Xuất dữ liệu thô JSON Lines cho từng kịch bản và báo cáo Markdown tổng hợp tự động

📁 Output: [`scripts/benchmark-scenarios.ts`](../scripts/benchmark-scenarios.ts)

### Ngày 2: Kịch bản A — Cryptographic Throughput (1k, 5k, 10k, 50k)

- [x] Đo throughput ký EIP-712 offline cho các batch N ∈ {1,000; 5,000; 10,000; 50,000}
- [x] Kết quả thực nghiệm:

| Batch Size | Sign Time | Throughput      | Merkle Tree | Disclosures | Heap (MB) |
| ---------- | --------- | --------------- | ----------- | ----------- | --------- |
| 1,000      | 1.34s     | **747 creds/s** | 1.40s       | 0.14s       | 219       |
| 5,000      | 7.07s     | **707 creds/s** | 7.51s       | 0.58s       | 320       |
| 10,000     | 13.48s    | **742 creds/s** | 14.95s      | 1.22s       | 428       |
| 50,000     | 61.78s    | **809 creds/s** | 78.97s      | 6.01s       | 995       |

- [x] **Nhận xét:** Throughput ổn định ~707–809 creds/s qua mọi batch size → xác nhận O(N) linear scalability

📁 Output: [`perf-results/scenario-a.jsonl`](../perf-results/scenario-a.jsonl)

### Ngày 2: Kịch bản B — End-to-End Bulk Issuance Pipeline (10k)

- [x] Đo toàn trình từ CSV upload → anchor on-chain readiness
- [x] Kết quả thực nghiệm:

| Phase              | Duration  | Throughput        |
| ------------------ | --------- | ----------------- |
| CSV Parsing        | 39.72 ms  | 251,762 records/s |
| Salted Disclosures | 1,093 ms  | 9,149 ops/s       |
| Merkle Tree        | 14,339 ms | 697 leaves/s      |
| EIP-712 Signing    | 12,103 ms | **826 creds/s**   |
| **Total Pipeline** | **27.54s**| **363 creds/s**   |

📁 Output: [`perf-results/scenario-b.jsonl`](../perf-results/scenario-b.jsonl)

### Ngày 3: Kịch bản C — Detailed Verification Latency (1000 sequential)

- [x] Đo 1000 lượt xác minh tuần tự (offline, 10-step pipeline) với warmup 5 lượt
- [x] Kết quả phân phối độ trễ:

| Metric     | Value                      |
| ---------- | -------------------------- |
| Average    | **5.502 ms**               |
| Min        | 4.322 ms                   |
| Median p50 | 5.234 ms                   |
| p90        | 6.551 ms                   |
| p95        | 7.406 ms                   |
| p99        | 8.959 ms                   |
| Max        | 11.211 ms                  |
| Std Dev    | 0.888 ms                   |
| Throughput | **~182 verifications/sec** |
| Pass Rate  | **1000/1000 (100%)**       |

📁 Output: [`perf-results/scenario-c.jsonl`](../perf-results/scenario-c.jsonl) (197 KB, 1001 records)

### Ngày 3: Kịch bản D — Concurrent Load Testing (C = 10, 50, 100, 500)

- [x] Stress-test API xác minh với tải đồng thời tăng dần (1000 requests tổng cộng)
- [x] Kết quả thực nghiệm:

| Concurrency | Total Time | Throughput     | Avg Latency | p95 Latency | p99 Latency  | Pass Rate |
| ----------- | ---------- | -------------- | ----------- | ----------- | ------------ | --------- |
| C = 10      | 5.42s      | **184 req/s**  | 29.87 ms    | 55.16 ms    | 70.51 ms     | 100%      |
| C = 50      | 5.35s      | **187 req/s**  | 137.25 ms   | 262.31 ms   | 291.15 ms    | 100%      |
| C = 100     | 6.00s      | **167 req/s**  | 305.35 ms   | 609.49 ms   | 693.02 ms    | 100%      |
| C = 500     | 6.15s      | **163 req/s**  | 1535.80 ms  | 2924.57 ms  | 3052.18 ms   | 100%      |

📁 Output: [`perf-results/scenario-d.jsonl`](../perf-results/scenario-d.jsonl)

### Ngày 4: Kịch bản E — Gas Scalability (N = 100, 1000, 10000)

- [x] So sánh chi phí gas on-chain giữa Phase 2 (ERC-721) và Phase 3 (Merkle root anchor)
- [x] Kết quả phân tích:

| Batch Size | Phase 3 Gas/Cred | Phase 3 Cost | Phase 2 Gas Total | Phase 2 Cost | Gas Reduction |
| ---------- | ---------------- | ------------ | ----------------- | ------------ | ------------- |
| 100        | **1,050 gas**    | **$9.45**    | 10,315,600        | $928.40      | ~98×          |
| 1,000      | **105 gas**      | **$9.45**    | 103,156,000       | $9,284.04    | ~982×         |
| 10,000     | **10.5 gas**     | **$9.45**    | 1,031,560,000     | $92,840.40   | **~9,824×**   |

📁 Output: [`perf-results/scenario-e.jsonl`](../perf-results/scenario-e.jsonl)

### Ngày 4: Tổng hợp báo cáo benchmark

- [x] Xuất báo cáo tổng hợp [`docs/BENCHMARK.md`](../docs/BENCHMARK.md) với Executive Summary, bảng so sánh Phase 2 vs Phase 3, và Methodology
- [x] Tất cả 5 bộ dữ liệu JSONL thô lưu tại `perf-results/scenario-{a,b,c,d,e}.jsonl`

📁 Output: [`docs/BENCHMARK.md`](../docs/BENCHMARK.md), [`perf-results/`](../perf-results/)

### Phân tích & bảo mật

- [x] Tổng hợp bảng so sánh A–E giữa 2 phase (biểu đồ): đã tổng hợp chi tiết trong [`docs/BENCHMARK.md`](../docs/BENCHMARK.md)
- [x] Slither static analysis & checklist: hoàn thành rà soát 10 hạng mục an ninh trong [`docs/SECURITY.md`](../docs/SECURITY.md) (§4)
- [x] `SECURITY.md` threat model (STRIDE matrix): hoàn thành ma trận 6 chiều STRIDE, phân tích mật mã (second-preimage, cross-chain replay, selective disclosure) trong [`docs/SECURITY.md`](../docs/SECURITY.md)
- [x] Bộ kiểm thử an ninh tự động: hoàn thành script [`scripts/security-tests.ts`](../scripts/security-tests.ts) với **33/33 kịch bản tấn công vượt qua** (second-preimage, cross-chain replay, forgery, expired, brute-force, schema injection, bitmap isolation)
- [x] Bộ kiểm thử hợp đồng thông minh & SDK: **100/100 tests passed** (`npx hardhat test`)

### Deliverables Tuần 6

| Deliverable                 | Status        | Ghi chú                                                    |
| --------------------------- | ------------- | ---------------------------------------------------------- |
| `docs/BENCHMARK.md`         | ✅ Hoàn thành | Báo cáo tổng hợp 5 kịch bản A–E                           |
| Bộ dữ liệu JSONL gốc       | ✅ Hoàn thành | 5 files: `scenario-{a,b,c,d,e}.jsonl` (~200 KB tổng cộng) |
| Benchmark script            | ✅ Hoàn thành | `scripts/benchmark-scenarios.ts` (chạy tự động 5 kịch bản) |
| `docs/SECURITY.md` (STRIDE) | ✅ Hoàn thành | Ma trận STRIDE, Slither mapping, phân tích mật mã học      |
| `security-tests.ts`         | ✅ Hoàn thành | Bộ kiểm thử mô phỏng 33 kịch bản tấn công (100% pass)     |

---

## Tuần 7 — Tài liệu & Hoàn thiện Demo

### Viết luận văn

- [ ] Chương Thiết kế giải pháp (Ngày 1–2)
- [ ] Chương Hiện thực (Ngày 3)
- [ ] Chương Thực nghiệm (Ngày 4)

### Demo & trình bày

- [ ] Demo video 5–7 phút (Ngày 5)
- [ ] Slide bảo vệ 20 slides (Ngày 5)
- [ ] Review & polish (Ngày 6)
- [ ] Buffer / sửa theo feedback GVHD (Ngày 7)

### Deliverables cuối cùng

| Deliverable                      | Status |
| -------------------------------- | ------ |
| Luận văn PDF (80–100 trang)      | ⏳     |
| Repo tag `v3.0-thesis`           | ⏳     |
| Demo web `https://v3.bkcred.xyz` | ⏳     |
| Video demo 5–7 phút              | ⏳     |

---

## Ghi chú điều chỉnh so với plan gốc

| #   | Điều chỉnh                                            | Lý do                                         |
| --- | ------------------------------------------------------ | --------------------------------------------- |
| 1   | Không fork sang branch `phase3-eip712`                 | Chạy local, không push Git liên tục           |
| 2   | Không tạo monorepo (`apps/`, `packages/`)              | Project hiện tại flat structure, giữ đơn giản |
| 3   | Vitest → chuyển Tuần 3                                 | Chưa có SDK để test                           |
| 4   | Playwright → chuyển Tuần 4                             | Chưa có web portal để E2E                     |
| 5   | Fixture generator → làm sớm Tuần 1 Ngày 4             | Có data sẵn để dev                            |
| 6   | Contract skeleton → làm sớm Tuần 1 Ngày 3             | Verify compile + gas report ngay              |
| 7   | Gộp Tuần 6 benchmark (PDF Week 6) vào 1 script tự động | Tối ưu thời gian, dữ liệu nhất quán          |

