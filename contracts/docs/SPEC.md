# BK Credential System — Phase 3 Technical Specification

## EIP-712 Off-Chain Signing + On-Chain Trust Anchor

| Thuộc tính    | Giá trị                                                        |
| ------------- | -------------------------------------------------------------- |
| Phiên bản     | 1.0.0                                                          |
| Tác giả       | BK Credential Team                                             |
| Đề tài        | Thiết kế và hiện thực giải pháp cấp phát chứng chỉ số sử dụng Blockchain |
| Phase         | 3 — EIP-712 Trust Anchor                                       |
| Kế thừa       | Phase 1 (HK251-DAGD1-434), Phase 2 (HK252-DATN-131)           |
| Solidity      | ^0.8.20                                                        |
| EIP tham chiếu| EIP-712 (Typed Structured Data Hashing and Signing)            |

---

## Mục lục

1. [Overview & Design Thesis](#1-overview--design-thesis)
2. [EIP-712 Domain & Type Schema](#2-eip-712-domain--type-schema)
3. [Credential JSON Schema](#3-credential-json-schema)
4. [Selective Disclosure — Salted-Hash Commitment](#4-selective-disclosure--salted-hash-commitment)
5. [Smart Contract Interface](#5-smart-contract-interface)
6. [Merkle Tree Construction](#6-merkle-tree-construction)
7. [Verify Pipeline — 10 bước](#7-verify-pipeline--10-bước)
8. [So sánh Phase 2 vs Phase 3](#8-so-sánh-phase-2-vs-phase-3)
9. [Security Considerations](#9-security-considerations)
10. [Appendix](#10-appendix)

---

## 1. Overview & Design Thesis

### 1.1 Bối cảnh

Phase 2 (BK Credential System — HK252-DATN-131) đã hiện thực thành công hệ thống cấp phát chứng chỉ số trên blockchain với ba tính chất cốt lõi:

- **Trustless verification**: verifier kiểm tra chứng chỉ mà không cần tin tưởng bên thứ ba.
- **Selective disclosure**: holder chọn trường thông tin để chia sẻ (SD-JWT).
- **Batch issuance**: phát hành hàng loạt thông qua Merkle anchor.

Tuy nhiên, Phase 2 gặp hai vấn đề ở quy mô đại học (≥ 10.000 sinh viên/đợt tốt nghiệp):

1. **Chi phí vận hành IPFS**: mỗi credential cần pin Public Canonical View (PCV) lên IPFS — phát sinh $0.001–$0.01/cred/tháng và thêm điểm thất bại (IPFS gateway downtime).
2. **Độ phức tạp SD-JWT**: cần thư viện SD-JWT tự triển khai (không có thư viện chuẩn cho ES256K trên Web3), JWT envelope overhead, và `_sd_alg` metadata phức tạp.

### 1.2 Luận điểm Phase 3

> **Nếu blockchain chỉ đóng vai trò "Mỏ neo niềm tin" (Trust Anchor), và toàn bộ chữ ký trên chứng chỉ được tạo ra off-chain bằng EIP-712 — ta có thể giữ lại các đảm bảo an toàn của Phase 2 trong khi giảm đáng kể chi phí và độ phức tạp vận hành.**

Điều này đạt được nhờ:

| Thành phần          | Cơ chế                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Trust Anchor        | `IssuerRegistry` + `CredentialRegistry` + Merkle root on-chain   |
| Signing             | EIP-712 `signTypedData` off-chain (zero gas per credential)      |
| Selective Disclosure| Salted keccak256 commitment trong EIP-712 struct                 |
| Revocation          | Bitmap on-chain (1 bit/credential, ~64× rẻ hơn mapping)         |
| Verify              | `ethers.verifyTypedData` — thư viện battle-tested, có sẵn        |

### 1.3 Mô hình hoạt động tổng quan

```
┌─────────────────────────────────────────────────────────┐
│                   OFF-CHAIN (Zero Gas)                   │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Issuer   │→│  EIP-712 SDK │→│  10.000 credentials │  │
│  │  Portal   │  │  signTyped   │  │  + Merkle tree     │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ merkleRoot (1 tx)
┌────────────────────────▼────────────────────────────────┐
│              ON-CHAIN TRUST ANCHOR (Sepolia)             │
│  ┌────────────────┐  ┌─────────────────────────────────┐ │
│  │ IssuerRegistry │  │     CredentialRegistry          │ │
│  │  - isSigner()  │  │  - anchorBatch() [1 tx/batch]   │ │
│  │  - addSigner() │  │  - isRevoked()  [bitmap]        │ │
│  └────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. EIP-712 Domain & Type Schema

### 2.1 EIP-712 Domain Separator

```solidity
EIP712Domain({
    name:              "BKCredential",
    version:           "3",
    chainId:           <target_chain_id>,     // 11155111 (Sepolia)
    verifyingContract: <CredentialRegistry>   // deployed address
})
```

**Lý do thiết kế:**

- `name = "BKCredential"`: định danh duy nhất cho hệ thống, phân biệt với các dApp khác trên cùng chain.
- `version = "3"`: tách biệt Phase 3 khỏi Phase 2, ngăn replay signature giữa hai version.
- `chainId`: ngăn replay giữa Sepolia testnet và mainnet (hoặc các L2).
- `verifyingContract = CredentialRegistry address`: ràng buộc chữ ký với contract cụ thể — nếu deploy contract mới, signature cũ không replay được.

### 2.2 Type Definitions — Quyết định: Nested Struct

**Quyết định thiết kế: dùng `nested struct` cho `PublicClaims`**, không phải `flat fields`.

**Lý do:**

1. **Type-safe**: mỗi trường public claim được đặt tên rõ ràng trong struct, tránh bug khi thay đổi thứ tự trường.
2. **Mở rộng**: thêm trường mới vào `PublicClaims` không thay đổi `BkCredential` struct — chỉ cần cập nhật `PublicClaims` definition.
3. **EIP-712 native**: EIP-712 hỗ trợ nested struct encoding (`hashStruct` đệ quy) — ethers v6 `signTypedData` xử lý tự nhiên.
4. **MetaMask display**: khi holder "Sign" trên MetaMask (nếu cần), nested struct hiển thị có cấu trúc rõ ràng hơn flat fields.

**Phương án bị loại — flat `publicClaimsHash`:**

```solidity
// ❌ REJECTED: không type-safe, mất khả năng hiển thị trên wallet
BkCredential(
    string credId,
    uint64 issuedAt,
    string batchId,
    string vct,
    bytes32 publicClaimsHash,  // opaque hash — không rõ nội dung
    bytes32[] privateClaims,
    bytes32 merkleRoot
)
```

### 2.3 Type Definitions — Chính thức

```solidity
// ─── Nested struct: PublicClaims ───────────────────────────
// Chứa tất cả thông tin công khai trên credential.
// Mỗi trường đều là string để tối đa tương thích.

struct PublicClaims {
    string vct;             // Verifiable Credential Type, e.g. "BKISC_DEGREE"
    string degreeTitle;     // "Kỹ sư Khoa học Máy tính"
    string graduationDate;  // ISO-8601: "2026-06-15"
    string honors;          // "Xuất sắc" | "Giỏi" | "Khá" | ""
}

// ─── Top-level struct: BkCredential ───────────────────────
// Payload chính được ký bằng EIP-712 signTypedData.

struct BkCredential {
    string         credId;         // URN UUID: "urn:uuid:3f8e2d1a-..."
    uint64         issuedAt;       // Unix timestamp
    string         batchId;        // "GRAD-2026-01"
    PublicClaims   publicClaims;   // ← nested struct
    bytes32[]      privateClaims;  // salted-hash commitments
    bytes32        merkleRoot;     // batch Merkle root (anchored on-chain)
}
```

### 2.4 EIP-712 Encoding Rules

Theo [EIP-712 spec](https://eips.ethereum.org/EIPS/eip-712):

**`encodeType(BkCredential)`:**

```
BkCredential(string credId,uint64 issuedAt,string batchId,PublicClaims publicClaims,bytes32[] privateClaims,bytes32 merkleRoot)PublicClaims(string vct,string degreeTitle,string graduationDate,string honors)
```

> Lưu ý: referenced type `PublicClaims` được nối vào cuối, sắp xếp alphabetically theo tên type.

**`hashStruct(publicClaims)`:**

```
keccak256(
    keccak256("PublicClaims(string vct,string degreeTitle,string graduationDate,string honors)")
    ‖ keccak256(bytes(vct))
    ‖ keccak256(bytes(degreeTitle))
    ‖ keccak256(bytes(graduationDate))
    ‖ keccak256(bytes(honors))
)
```

**`hashStruct(credential)`:**

```
keccak256(
    keccak256(encodeType(BkCredential))
    ‖ keccak256(bytes(credId))
    ‖ uint256(issuedAt)                       // left-padded to 32 bytes
    ‖ keccak256(bytes(batchId))
    ‖ hashStruct(publicClaims)                // nested struct hash
    ‖ keccak256(abi.encodePacked(privateClaims))  // array encoding
    ‖ merkleRoot                              // bytes32 as-is
)
```

**`signHash`:**

```
keccak256("\x19\x01" ‖ domainSeparator ‖ hashStruct(credential))
```

### 2.5 ethers v6 Types Object

```typescript
const types = {
    PublicClaims: [
        { name: "vct",            type: "string" },
        { name: "degreeTitle",    type: "string" },
        { name: "graduationDate", type: "string" },
        { name: "honors",         type: "string" },
    ],
    BkCredential: [
        { name: "credId",        type: "string"        },
        { name: "issuedAt",      type: "uint64"        },
        { name: "batchId",       type: "string"        },
        { name: "publicClaims",  type: "PublicClaims"  },
        { name: "privateClaims", type: "bytes32[]"     },
        { name: "merkleRoot",    type: "bytes32"       },
    ],
} as const;
```

---

## 3. Credential JSON Schema

### 3.1 Cấu trúc hoàn chỉnh

Mỗi credential Phase 3 là một JSON object kèm chữ ký EIP-712:

```json
{
    "@context": "https://bkcred.xyz/v3",
    "type": "BkCredential",
    "credId": "urn:uuid:3f8e2d1a-7b4c-4e9f-a1d2-8c5b6f0e3a7d",
    "issuedAt": 1750000000,
    "batchId": "GRAD-2026-01",

    "issuer": {
        "name": "Trường Đại học Bách Khoa — ĐHQG-HCM",
        "did": "did:ethr:sepolia:0xABC...DEF",
        "signer": "0xABC...DEF"
    },

    "publicClaims": {
        "vct": "BKISC_DEGREE",
        "degreeTitle": "Kỹ sư Khoa học Máy tính",
        "graduationDate": "2026-06-15",
        "honors": "Giỏi"
    },

    "privateClaims": [
        "0x3e1f9a2b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
        "0xa9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
        "0xc4d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8"
    ],

    "merkle": {
        "root": "0x7f2a...64hex",
        "leaf": "0xd91c...64hex",
        "proof": [
            "0x1234...64hex",
            "0x5678...64hex",
            "0x9abc...64hex"
        ],
        "index": 42
    },

    "signature": "0x1b...65bytes_r_s_v",

    "disclosures": [
        {
            "salt": "0xdeadbeef...32bytes",
            "key": "fullName",
            "value": "Trần Lê Công Minh"
        },
        {
            "salt": "0xcafebabe...32bytes",
            "key": "studentId",
            "value": "1910347"
        },
        {
            "salt": "0xfeedface...32bytes",
            "key": "dob",
            "value": "2001-08-12"
        }
    ]
}
```

### 3.2 Định nghĩa trường

| Trường                | Kiểu            | Bắt buộc | Mô tả                                                              |
| --------------------- | --------------- | -------- | ------------------------------------------------------------------- |
| `@context`            | string          | ✓        | URL schema version, cố định `"https://bkcred.xyz/v3"`               |
| `type`                | string          | ✓        | Cố định `"BkCredential"`                                            |
| `credId`              | string          | ✓        | URN UUID v4, định danh duy nhất cho credential                      |
| `issuedAt`            | uint64          | ✓        | Unix timestamp (giây) thời điểm phát hành                          |
| `batchId`             | string          | ✓        | ID batch tốt nghiệp, e.g. `"GRAD-2026-01"`                        |
| `issuer.name`         | string          | ✓        | Tên tổ chức phát hành                                               |
| `issuer.did`          | string          | ✓        | DID của issuer (did:ethr format)                                    |
| `issuer.signer`       | address (hex)   | ✓        | Ethereum address của signer key                                     |
| `publicClaims`        | PublicClaims    | ✓        | Object chứa các trường công khai (xem §2.3)                        |
| `privateClaims`       | bytes32[]       | ✓        | Mảng commitment hashes cho trường riêng tư                          |
| `merkle.root`         | bytes32 (hex)   | ✓        | Merkle root của batch (đã anchor on-chain)                          |
| `merkle.leaf`         | bytes32 (hex)   | ✓        | Leaf hash của credential này trong tree                             |
| `merkle.proof`        | bytes32[] (hex) | ✓        | Merkle proof path từ leaf → root                                    |
| `merkle.index`        | uint32          | ✓        | Vị trí credential trong batch (dùng cho revocation bitmap)          |
| `signature`           | bytes (hex)     | ✓        | EIP-712 signature 65 bytes (r ‖ s ‖ v)                              |
| `disclosures`         | Disclosure[]    | ✗        | Mảng các disclosure đã chọn chia sẻ (selective disclosure)          |
| `disclosures[].salt`  | bytes32 (hex)   | ✓*       | Salt ngẫu nhiên 32 bytes                                            |
| `disclosures[].key`   | string          | ✓*       | Tên trường (e.g. `"fullName"`, `"studentId"`)                      |
| `disclosures[].value` | string          | ✓*       | Giá trị trường                                                      |
| `exp`                 | uint64          | ✗        | Unix timestamp hết hạn (tuỳ chọn)                                   |

> `✓*` = bắt buộc nếu disclosure tồn tại

### 3.3 Credential dạng Selective Disclosure (Holder gửi cho Verifier)

Khi holder chọn chỉ chia sẻ `fullName` và `degreeTitle`, file gửi cho verifier sẽ chứa:

```json
{
    "@context": "https://bkcred.xyz/v3",
    "type": "BkCredential",
    "credId": "urn:uuid:3f8e2d1a-...",
    "issuedAt": 1750000000,
    "batchId": "GRAD-2026-01",
    "issuer": { "...": "..." },
    "publicClaims": { "...": "..." },
    "privateClaims": ["0x3e1f...", "0xa9b2...", "0xc4d8..."],
    "merkle": { "...": "..." },
    "signature": "0x1b...",
    "disclosures": [
        { "salt": "0xdeadbeef...", "key": "fullName", "value": "Trần Lê Công Minh" }
    ]
}
```

> Lưu ý: `privateClaims` luôn đầy đủ (vì nằm trong EIP-712 signed payload). Verifier không thể đoán nội dung trường riêng tư chưa được disclose vì không biết `salt`.

---

## 4. Selective Disclosure — Salted-Hash Commitment

### 4.1 Cơ chế

Mỗi trường riêng tư (PII) được bảo vệ bằng salted-hash commitment:

```
commitment = keccak256(abi.encodePacked(salt, key, value))
```

Trong đó:

- `salt`: 32 bytes ngẫu nhiên, sinh bằng `crypto.getRandomValues()` hoặc `ethers.randomBytes(32)`.
- `key`: tên trường dưới dạng UTF-8 string (e.g. `"fullName"`, `"studentId"`, `"dob"`).
- `value`: giá trị trường dưới dạng UTF-8 string.

### 4.2 Tại sao `abi.encodePacked` thay vì `abi.encode`?

- `abi.encodePacked(salt, key, value)` cho ra kết quả compact hơn (không padding), phù hợp cho commitment scheme.
- Không có rủi ro hash collision ở đây vì `salt` cố định 32 bytes → phần đầu luôn xác định, phần `key‖value` phía sau không bị nhầm lẫn.

### 4.3 Quy trình

**Phía Issuer (khi phát hành):**

```
Với mỗi trường PII (key, value):
  1. salt ← randomBytes(32)
  2. commitment ← keccak256(abi.encodePacked(salt, key, value))
  3. Lưu disclosure = { salt, key, value } vào DB
  4. Thêm commitment vào privateClaims[]
```

**Phía Holder (khi chia sẻ):**

```
1. Mở credential trên Holder Portal
2. Toggle ON/OFF từng trường PII (fullName ✓, studentId ✓, dob ✗)
3. Download credential-sd.json chỉ chứa disclosures đã chọn
4. Gửi file cho verifier
```

**Phía Verifier (khi xác minh):**

```
Với mỗi disclosure trong credential:
  1. Tính lại: recomputed = keccak256(abi.encodePacked(salt, key, value))
  2. Kiểm tra: recomputed ∈ privateClaims[]
  3. Nếu khớp → trường hợp lệ, hiển thị value
  4. Nếu không khớp → credential bị giả mạo → REJECT
```

### 4.4 So sánh với SD-JWT (Phase 2)

| Tiêu chí              | Phase 2 (SD-JWT)                     | Phase 3 (Salted-Hash)           |
| ---------------------- | ------------------------------------ | ------------------------------- |
| Thuật toán hash        | SHA-256                              | keccak256                       |
| Cấu trúc disclosure    | Base64url(JSON([salt, key, value]))  | { salt, key, value } plaintext  |
| Nằm trong signed data? | `_sd[]` trong JWT payload            | `privateClaims[]` trong EIP-712 |
| Thư viện cần thiết     | SD-JWT parser (tự triển khai)        | `ethers.solidityPackedKeccak256` |
| Metadata overhead      | `_sd_alg`, JWT header, disclosures   | Không có overhead               |
| Verify phía verifier   | Cần SD-JWT library                   | 1 dòng keccak256                |

**Kết luận**: Salted-hash trong EIP-712 đơn giản hơn đáng kể, và keccak256 là native trong Ethereum ecosystem.

---

## 5. Smart Contract Interface

### 5.1 `IssuerRegistry`

Quản lý danh sách signer addresses hợp lệ. Kế thừa logic từ Phase 2, tối giản hóa.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IssuerRegistry
 * @notice Quản lý danh sách signer addresses được phép ký credential và anchor batch.
 *         Owner (admin đại học) có quyền thêm/thu hồi signer.
 *
 * @dev Sử dụng Ownable2Step để tránh mất quyền admin do gửi nhầm address.
 *      Pausable cho phép dừng khẩn cấp khi phát hiện signer bị compromised.
 */
contract IssuerRegistry is Ownable2Step, Pausable {

    // ─── State ─────────────────────────────────────────────
    mapping(address => bool)  public isSigner;
    mapping(address => bytes) public did;       // Optional DID label (did:ethr:...)

    // ─── Events ────────────────────────────────────────────
    event SignerAdded(address indexed signer, bytes did, uint64 addedAt);
    event SignerRevoked(address indexed signer, uint64 revokedAt);

    // ─── Errors ────────────────────────────────────────────
    error ZeroAddress();
    error AlreadySigner();
    error NotSigner();

    // ─── Constructor ───────────────────────────────────────
    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Modifiers ─────────────────────────────────────────
    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    // ─── Admin functions ───────────────────────────────────

    /**
     * @notice Thêm một signer address mới.
     * @param signer Address của signer (ví issuer).
     * @param _did   DID label tuỳ chọn (e.g. "did:ethr:sepolia:0x...").
     */
    function addSigner(address signer, bytes calldata _did)
        external
        onlyOwner
        whenNotPaused
    {
        if (signer == address(0)) revert ZeroAddress();
        if (isSigner[signer]) revert AlreadySigner();

        isSigner[signer] = true;
        did[signer] = _did;

        emit SignerAdded(signer, _did, uint64(block.timestamp));
    }

    /**
     * @notice Thu hồi quyền signer. Credential đã ký trước đó vẫn hợp lệ
     *         (verifier kiểm tra thời điểm ký vs thời điểm revoke).
     * @param signer Address cần thu hồi.
     */
    function revokeSigner(address signer) external onlyOwner {
        if (!isSigner[signer]) revert NotSigner();

        isSigner[signer] = false;
        // Giữ lại `did[signer]` cho audit trail

        emit SignerRevoked(signer, uint64(block.timestamp));
    }

    // ─── Emergency ─────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

**Điểm thiết kế quan trọng:**

1. **`Ownable2Step`**: yêu cầu pending owner `acceptOwnership()` — tránh mất quyền admin do gửi nhầm address.
2. **`Pausable`**: cho phép dừng khẩn cấp `addSigner` khi phát hiện signer key bị compromised.
3. **Custom errors**: tiết kiệm gas so với `require(... , "string")`.
4. **`did` mapping giữ lại sau revoke**: phục vụ audit trail — biết signer nào từng ký dưới DID gì.

### 5.2 `CredentialRegistry`

Lưu trữ Merkle root anchor và bitmap revocation.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CredentialRegistry
 * @notice Trust Anchor: lưu Merkle root của batch tốt nghiệp và bitmap revocation.
 *         Mỗi batch tốt nghiệp chỉ cần 1 transaction `anchorBatch`.
 *
 * @dev Revocation dùng bitmap: mỗi uint256 slot chứa 256 bits,
 *      mỗi bit đại diện cho 1 credential trong batch.
 *      Với batch 10.000 credential: cần 40 slots (10000/256 = 39.06).
 */
contract CredentialRegistry is Pausable {

    // ─── Types ─────────────────────────────────────────────

    struct BatchAnchor {
        uint64  anchoredAt;   // Timestamp khi anchor
        address issuer;       // Signer address đã anchor batch này
        uint32  size;         // Số credential trong batch
        string  ipfsCid;      // CID của batch metadata (tuỳ chọn)
    }

    // ─── State ─────────────────────────────────────────────

    /// @notice IssuerRegistry address — dùng để kiểm tra msg.sender là signer hợp lệ
    address public immutable issuerRegistry;

    /// @notice merkleRoot → BatchAnchor
    mapping(bytes32 => BatchAnchor) public anchors;

    /// @notice batchIndex → merkleRoot (cho lookup theo index)
    mapping(uint32 => bytes32) public batchRoots;

    /// @notice merkleRoot → wordIndex → bitmap (mỗi bit = 1 credential)
    mapping(bytes32 => mapping(uint256 => uint256)) private _revocationBitmap;

    /// @notice Counter cho batchIndex tự tăng
    uint32 public nextBatchIndex;

    // ─── Events ────────────────────────────────────────────

    event BatchAnchored(
        bytes32 indexed merkleRoot,
        address indexed issuer,
        uint32  batchIndex,
        uint32  size,
        uint64  anchoredAt
    );

    event CredentialRevoked(
        bytes32 indexed merkleRoot,
        uint32  index,
        address indexed revokedBy,
        uint64  revokedAt
    );

    // ─── Errors ────────────────────────────────────────────

    error NotSigner();
    error RootAlreadyAnchored();
    error RootNotAnchored();
    error IndexOutOfRange();
    error AlreadyRevoked();
    error ZeroRoot();
    error ZeroSize();

    // ─── Constructor ───────────────────────────────────────

    constructor(address _issuerRegistry) {
        issuerRegistry = _issuerRegistry;
    }

    // ─── Modifiers ─────────────────────────────────────────

    modifier onlySigner() {
        // Check IssuerRegistry.isSigner(msg.sender)
        (bool ok, bytes memory data) = issuerRegistry.staticcall(
            abi.encodeWithSignature("isSigner(address)", msg.sender)
        );
        if (!ok || !abi.decode(data, (bool))) revert NotSigner();
        _;
    }

    // ─── Core functions ────────────────────────────────────

    /**
     * @notice Anchor một batch tốt nghiệp. Chi phí: ~25k gas cho root + 1 SSTORE.
     *
     * @param merkleRoot Merkle root của batch credential.
     * @param size       Số credential trong batch (uint32, max 4,294,967,295).
     * @param ipfsCid    IPFS CID cho batch metadata (có thể rỗng).
     *
     * @dev batchIndex được tự tăng để tránh collision.
     *      Một merkleRoot chỉ được anchor 1 lần.
     */
    function anchorBatch(
        bytes32 merkleRoot,
        uint32  size,
        string calldata ipfsCid
    ) external onlySigner whenNotPaused {
        if (merkleRoot == bytes32(0)) revert ZeroRoot();
        if (size == 0) revert ZeroSize();
        if (anchors[merkleRoot].anchoredAt != 0) revert RootAlreadyAnchored();

        uint32 batchIndex = nextBatchIndex++;

        anchors[merkleRoot] = BatchAnchor({
            anchoredAt: uint64(block.timestamp),
            issuer:     msg.sender,
            size:       size,
            ipfsCid:    ipfsCid
        });

        batchRoots[batchIndex] = merkleRoot;

        emit BatchAnchored(merkleRoot, msg.sender, batchIndex, size, uint64(block.timestamp));
    }

    /**
     * @notice Thu hồi 1 credential trong batch bằng bitmap flip.
     *
     * @param merkleRoot Root của batch chứa credential.
     * @param index      Vị trí credential trong batch (0-based).
     *
     * @dev Gas cost: ~5,000 (1 SLOAD + 1 SSTORE warm slot).
     *      Chỉ signer gốc (issuer của batch) hoặc owner mới được revoke.
     */
    function revoke(bytes32 merkleRoot, uint32 index)
        external
        onlySigner
    {
        BatchAnchor storage anchor = anchors[merkleRoot];
        if (anchor.anchoredAt == 0) revert RootNotAnchored();
        if (index >= anchor.size) revert IndexOutOfRange();

        uint256 wordIndex = index / 256;
        uint256 bitIndex  = index % 256;
        uint256 mask      = 1 << bitIndex;

        uint256 word = _revocationBitmap[merkleRoot][wordIndex];
        if (word & mask != 0) revert AlreadyRevoked();

        _revocationBitmap[merkleRoot][wordIndex] = word | mask;

        emit CredentialRevoked(merkleRoot, index, msg.sender, uint64(block.timestamp));
    }

    // ─── View functions ────────────────────────────────────

    /**
     * @notice Kiểm tra credential có bị thu hồi không.
     * @return revoked `true` nếu bit tại `index` đã được set.
     */
    function isRevoked(bytes32 merkleRoot, uint32 index)
        external
        view
        returns (bool revoked)
    {
        uint256 wordIndex = index / 256;
        uint256 bitIndex  = index % 256;
        revoked = (_revocationBitmap[merkleRoot][wordIndex] & (1 << bitIndex)) != 0;
    }

    /**
     * @notice Lấy thông tin anchor của một batch.
     */
    function getAnchor(bytes32 merkleRoot)
        external
        view
        returns (
            uint64  anchoredAt,
            address issuer,
            uint32  size,
            string memory ipfsCid
        )
    {
        BatchAnchor memory a = anchors[merkleRoot];
        return (a.anchoredAt, a.issuer, a.size, a.ipfsCid);
    }

    // ─── Emergency ─────────────────────────────────────────

    function pause() external onlySigner { _pause(); }
    function unpause() external onlySigner { _unpause(); }
}
```

### 5.3 Bitmap Revocation — Chi tiết kỹ thuật

**Bố cục bộ nhớ:**

```
_revocationBitmap[merkleRoot][wordIndex] → uint256 (256 bits)

Với batch size = 10,000:
  - Word 0:  bit 0–255    → credential index 0–255
  - Word 1:  bit 0–255    → credential index 256–511
  - ...
  - Word 39: bit 0–15     → credential index 9984–9999
  
  Tổng: ceil(10000 / 256) = 40 slots (uint256)
```

**Phép toán:**

```solidity
// Revoke credential tại index i:
wordIndex = i / 256;
bitIndex  = i % 256;
_revocationBitmap[root][wordIndex] |= (1 << bitIndex);

// Check revocation:
isRevoked = (_revocationBitmap[root][wordIndex] & (1 << bitIndex)) != 0;
```

**Gas analysis:**

| Thao tác             | Gas (estimate)         | So sánh Phase 2                      |
| -------------------- | ---------------------- | ------------------------------------- |
| `revoke` (cold slot) | ~22,100 (SSTORE cold)  | ~103,156 (mapping credIdHash → bool)  |
| `revoke` (warm slot) | ~5,000 (SSTORE warm)   | ~103,156                              |
| `isRevoked` (read)   | ~2,100 (SLOAD)         | ~2,100 (tương đương)                  |
| Batch revoke 256 creds| ~5,000 (1 SSTORE)     | ~26,407,936 (256 × 103,156)           |

> **Trường hợp đặc biệt batch revoke**: Nếu cần thu hồi 256 credential liên tiếp (cùng word), chỉ cần 1 SSTORE — tiết kiệm ~5,280× so với Phase 2.

---

## 6. Merkle Tree Construction

### 6.1 Leaf Computation

Mỗi credential được hash thành 1 leaf trong Merkle tree:

```
leaf = keccak256(abi.encode(
    credId,                                        // string
    hashStruct(publicClaims),                       // bytes32 (EIP-712 struct hash)
    keccak256(abi.encodePacked(privateClaims[]))    // bytes32 (array hash)
))
```

**Lý do encode cả `publicClaims` và `privateClaims` vào leaf:**

- Ràng buộc nội dung credential với batch — thay đổi bất kỳ trường nào sẽ thay đổi leaf, khiến Merkle proof không khớp.
- Verifier kiểm tra: leaf do mình tính ≟ leaf trong credential → nếu khớp, chứng tỏ credential chưa bị chỉnh sửa kể từ khi anchor.

### 6.2 Tree Construction

Sử dụng `@openzeppelin/merkle-tree` (StandardMerkleTree):

```typescript
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

// Mỗi leaf là tuple [credId, publicClaimsHash, privateClaimsHash]
const leaves: [string, string, string][] = credentials.map(cred => [
    cred.credId,
    hashPublicClaims(cred.publicClaims),     // EIP-712 hashStruct
    hashPrivateClaims(cred.privateClaims),    // keccak256(encodePacked(...))
]);

const tree = StandardMerkleTree.of(leaves, ["string", "bytes32", "bytes32"]);

// tree.root → bytes32 (anchor on-chain)
// tree.getProof(index) → bytes32[] (đính kèm credential)
```

### 6.3 Verification

**Off-chain (verifier):**

```typescript
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

// Recompute leaf từ credential
const leaf = computeLeaf(credential);

// Verify proof
const isValid = StandardMerkleTree.verify(
    credential.merkle.root,
    ["string", "bytes32", "bytes32"],
    [credential.credId, publicClaimsHash, privateClaimsHash],
    credential.merkle.proof
);
```

**On-chain** (không bắt buộc — chỉ nếu cần smart contract verify):

```solidity
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

bool valid = MerkleProof.verify(proof, merkleRoot, leaf);
```

---

## 7. Verify Pipeline — 10 bước

### 7.1 Tổng quan

```
┌─────────────────────────────────────────────────┐
│             OFFLINE (bước 1–6)                   │
│   Không cần network, chạy hoàn toàn local        │
│                                                   │
│  1. Parse + validate schema                       │
│  2. Recompute publicClaimsHash                    │
│  3. Verify private disclosures                    │
│  4. Recompute merkleLeaf                          │
│  5. Verify Merkle proof                           │
│  6. EIP-712 signature recovery                    │
│                                                   │
├─────────────────────────────────────────────────┤
│             ONLINE (bước 7–9)                    │
│   Cần RPC endpoint (2 eth_call)                  │
│                                                   │
│  7. Check isSigner(recoveredAddress)              │
│  8. Check anchors[merkleRoot].anchoredAt > 0      │
│  9. Check !isRevoked(merkleRoot, index)            │
│                                                   │
├─────────────────────────────────────────────────┤
│             LOCAL (bước 10)                       │
│  10. Expiry check (nếu có trường `exp`)           │
└─────────────────────────────────────────────────┘
```

### 7.2 Chi tiết từng bước

#### Bước 1: Parse + Validate Schema

```typescript
import { z } from "zod";

const CredentialSchema = z.object({
    "@context": z.literal("https://bkcred.xyz/v3"),
    type: z.literal("BkCredential"),
    credId: z.string().startsWith("urn:uuid:"),
    issuedAt: z.number().int().positive(),
    batchId: z.string().min(1),
    issuer: z.object({
        name: z.string(),
        did: z.string().startsWith("did:ethr:"),
        signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }),
    publicClaims: z.object({
        vct: z.string(),
        degreeTitle: z.string(),
        graduationDate: z.string(),
        honors: z.string(),
    }),
    privateClaims: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
    merkle: z.object({
        root: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        leaf: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        proof: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
        index: z.number().int().nonnegative(),
    }),
    signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
    disclosures: z.array(z.object({
        salt: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        key: z.string(),
        value: z.string(),
    })).optional(),
    exp: z.number().int().positive().optional(),
});
```

**Failure mode:** `INVALID_SCHEMA` — credential không đúng format.

#### Bước 2: Recompute `publicClaimsHash`

```typescript
const publicClaimsHash = ethers.TypedDataEncoder.hashStruct(
    "PublicClaims",
    { PublicClaims: types.PublicClaims },
    credential.publicClaims
);
```

**Failure mode:** N/A — bước này không fail, chỉ tính hash để dùng cho bước 4.

#### Bước 3: Verify Private Disclosures

```typescript
for (const disclosure of credential.disclosures ?? []) {
    const commitment = ethers.solidityPackedKeccak256(
        ["bytes32", "string", "string"],
        [disclosure.salt, disclosure.key, disclosure.value]
    );

    if (!credential.privateClaims.includes(commitment)) {
        throw new VerifyError("DISCLOSURE_MISMATCH", disclosure.key);
    }
}
```

**Failure mode:** `DISCLOSURE_MISMATCH` — disclosure hash không khớp với bất kỳ commitment nào trong `privateClaims[]`.

#### Bước 4: Recompute `merkleLeaf`

```typescript
const privateClaimsHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32[]"],
        [credential.privateClaims]
    )
);

const leaf = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "bytes32", "bytes32"],
        [credential.credId, publicClaimsHash, privateClaimsHash]
    )
);
```

**Failure mode:** Leaf không khớp `credential.merkle.leaf` → `LEAF_MISMATCH`.

#### Bước 5: Verify Merkle Proof

```typescript
const isValidProof = StandardMerkleTree.verify(
    credential.merkle.root,
    ["string", "bytes32", "bytes32"],
    [credential.credId, publicClaimsHash, privateClaimsHash],
    credential.merkle.proof
);
```

**Failure mode:** `INVALID_MERKLE_PROOF` — proof không dẫn từ leaf đến root.

#### Bước 6: EIP-712 Signature Recovery

```typescript
const domain = {
    name: "BKCredential",
    version: "3",
    chainId: expectedChainId,
    verifyingContract: credentialRegistryAddress,
};

const recoveredAddress = ethers.verifyTypedData(
    domain,
    types,
    {
        credId: credential.credId,
        issuedAt: credential.issuedAt,
        batchId: credential.batchId,
        publicClaims: credential.publicClaims,
        privateClaims: credential.privateClaims,
        merkleRoot: credential.merkle.root,
    },
    credential.signature
);

if (recoveredAddress.toLowerCase() !== credential.issuer.signer.toLowerCase()) {
    throw new VerifyError("SIGNATURE_MISMATCH");
}
```

**Failure mode:** `SIGNATURE_MISMATCH` — recovered address ≠ claimed signer.

#### Bước 7: On-chain — Check isSigner

```typescript
const issuerRegistry = new ethers.Contract(issuerRegistryAddress, IssuerRegistryABI, provider);
const valid = await issuerRegistry.isSigner(recoveredAddress);
if (!valid) throw new VerifyError("SIGNER_NOT_REGISTERED");
```

**Failure mode:** `SIGNER_NOT_REGISTERED` — signer đã bị thu hồi hoặc chưa được đăng ký.

#### Bước 8: On-chain — Check Anchor Exists

```typescript
const credRegistry = new ethers.Contract(credentialRegistryAddress, CredentialRegistryABI, provider);
const [anchoredAt] = await credRegistry.getAnchor(credential.merkle.root);
if (anchoredAt === 0n) throw new VerifyError("BATCH_NOT_ANCHORED");
```

**Failure mode:** `BATCH_NOT_ANCHORED` — merkleRoot chưa được anchor on-chain.

#### Bước 9: On-chain — Check Not Revoked

```typescript
const revoked = await credRegistry.isRevoked(credential.merkle.root, credential.merkle.index);
if (revoked) throw new VerifyError("CREDENTIAL_REVOKED");
```

**Failure mode:** `CREDENTIAL_REVOKED` — credential đã bị thu hồi.

#### Bước 10: Expiry Check

```typescript
if (credential.exp && Date.now() / 1000 > credential.exp) {
    throw new VerifyError("CREDENTIAL_EXPIRED");
}
```

**Failure mode:** `CREDENTIAL_EXPIRED` — credential đã hết hạn.

### 7.3 Error Code Summary

| Code                    | Bước | Nghiêm trọng | Mô tả                                     |
| ----------------------- | ---- | ------------- | ------------------------------------------ |
| `INVALID_SCHEMA`        | 1    | Critical      | JSON không đúng format credential          |
| `DISCLOSURE_MISMATCH`   | 3    | Critical      | Disclosure hash không khớp commitment      |
| `LEAF_MISMATCH`         | 4    | Critical      | Leaf tính lại ≠ leaf trong credential      |
| `INVALID_MERKLE_PROOF`  | 5    | Critical      | Merkle proof không hợp lệ                  |
| `SIGNATURE_MISMATCH`    | 6    | Critical      | Chữ ký EIP-712 không khớp signer          |
| `SIGNER_NOT_REGISTERED` | 7    | Critical      | Signer chưa đăng ký hoặc đã bị thu hồi   |
| `BATCH_NOT_ANCHORED`    | 8    | Critical      | Batch chưa được anchor on-chain            |
| `CREDENTIAL_REVOKED`    | 9    | Warning       | Credential đã bị thu hồi                   |
| `CREDENTIAL_EXPIRED`    | 10   | Warning       | Credential đã hết hạn (nếu có `exp`)       |

### 7.4 Tối ưu RPC Calls

Bước 7–9 có thể gom thành 1 multicall:

```typescript
// Option A: Multicall3 (nếu deploy trên mạng có Multicall3)
const multicall = new ethers.Contract(MULTICALL3_ADDRESS, Multicall3ABI, provider);
const results = await multicall.aggregate3([
    { target: issuerRegistry, callData: isSigner.encode(recoveredAddress) },
    { target: credRegistry,   callData: getAnchor.encode(merkleRoot) },
    { target: credRegistry,   callData: isRevoked.encode(merkleRoot, index) },
]);

// Option B: Cache isSigner() (thay đổi rất chậm)
// → chỉ cần 1 RPC call cho bước 8+9 (getAnchor + isRevoked)
```

---

## 8. So sánh Phase 2 vs Phase 3

### 8.1 Kiến trúc

| Thành phần                | Phase 2 (HK252-DATN-131)                        | Phase 3 (EIP-712 Trust Anchor)               |
| ------------------------- | ------------------------------------------------ | --------------------------------------------- |
| Contract chính            | `CertificateRegistry` (ERC-721 + AccessControl)  | `IssuerRegistry` + `CredentialRegistry`       |
| Định dạng credential      | SD-JWT VC (ES256K JWT + disclosures)              | EIP-712 typed signature + JSON                |
| On-chain per credential   | 1 `mintCertificate()` tx (~103k gas)              | 0 tx (zero-gas per credential)                |
| On-chain per batch        | N transactions                                    | 1 `anchorBatch()` (~25k gas)                  |
| Metadata storage          | IPFS (PCV bắt buộc pin per credential)            | Off-chain JSON (IPFS optional cho batch meta) |
| Token standard            | ERC-721 NFT                                       | Không dùng token — pure data + signature      |
| Revocation mechanism      | `mapping(tokenId → bool revoked)`                 | Bitmap `uint256[]` (256 bits/slot)             |

### 8.2 Chi phí (10.000 credential batch)

| Hạng mục               | Phase 2                             | Phase 3                          | Giảm       |
| ----------------------- | ----------------------------------- | -------------------------------- | ---------- |
| On-chain gas            | 10k × ~103k gas ≈ 1.03B gas        | 1 × ~25M gas                    | **~41×**   |
| Quy đổi ETH (30 gwei)  | ~30.9 ETH                          | ~0.75 ETH                       | **~41×**   |
| Quy đổi USD ($3000/ETH)| ~$92,700                            | ~$2,250                          | **~41×**   |
| Chi phí/credential      | ~$9.27                              | ~$0.225                          | **~41×**   |
| IPFS pinning            | 10k pin × $0.005 ≈ $50/tháng       | 0 (hoặc 1 pin cho batch meta)   | **~100%**  |
| Signing CPU             | 10k × 2ms (SD-JWT ES256K) = 20s    | 10k × 1.5ms (EIP-712) = 15s     | **25%**    |

### 8.3 Verify Latency

| Bước                    | Phase 2                              | Phase 3                          |
| ----------------------- | ------------------------------------ | -------------------------------- |
| Schema parse            | ~5ms (JWT decode)                    | ~2ms (JSON parse + zod)         |
| Signature verify        | ~3ms (ES256K secp256k1)              | ~2ms (ecrecover)                |
| IPFS fetch (PCV)        | ~300ms (gateway + download)          | 0ms (không cần)                 |
| RPC calls               | 3 × ~100ms = ~300ms                 | 2 × ~100ms = ~200ms            |
| **Tổng**                | **~608ms**                           | **~204ms**                      |
| **Cải thiện**           | —                                    | **~3× nhanh hơn**              |

### 8.4 Độ phức tạp vận hành

| Hạng mục                      | Phase 2          | Phase 3          |
| ------------------------------ | ---------------- | ---------------- |
| Thư viện bên thứ 3            | SD-JWT (tự viết) | ethers (chuẩn)   |
| IPFS infrastructure           | Bắt buộc         | Tuỳ chọn         |
| Số lượng moving parts          | 5 (contract, JWT, IPFS, DB, RPC) | 3 (contract, JSON, RPC) |
| Holder cần ví Web3?           | Cần (nhận NFT)   | Không             |
| Token on-chain (ERC-721)      | Có               | Không             |

---

## 9. Security Considerations

### 9.1 EIP-712 Signature Replay

**Threat:** Kẻ tấn công lấy signature từ Sepolia, replay trên mainnet hoặc L2 khác.

**Mitigation:** `EIP712Domain` bao gồm `chainId` + `verifyingContract`. Verifier **phải** kiểm tra domain separator khớp với chain hiện tại.

```typescript
// Verifier PHẢI kiểm tra:
assert(domain.chainId === expectedChainId);
assert(domain.verifyingContract === expectedRegistryAddress);
```

### 9.2 Compromised Signer Key

**Threat:** Private key của signer bị lộ → kẻ tấn công ký credential giả.

**Mitigation:**

1. `IssuerRegistry.revokeSigner(compromisedAddress)` → tất cả verify sau đó fail tại bước 7.
2. Credential đã ký trước khi revoke: verifier CÓ THỂ chấp nhận nếu `anchoredAt < revokeTimestamp` (tuỳ policy).
3. Key rotation: `addSigner(newAddress)` → batch mới ký bằng key mới.

### 9.3 Bitmap Overflow

**Threat:** `index >= size` nhưng vẫn pass `isRevoked` check (vì bit chưa set = not revoked).

**Mitigation:** `CredentialRegistry.revoke()` kiểm tra `index < anchor.size`. Verifier cũng phải check `credential.merkle.index < batchSize` tại bước 4.

### 9.4 Front-Running `anchorBatch`

**Threat:** Kẻ tấn công front-run `anchorBatch` với cùng `merkleRoot` nhưng sai `size` hoặc `issuer`.

**Mitigation:** `anchorBatch` kiểm tra `anchors[merkleRoot].anchoredAt == 0` — root chỉ được anchor 1 lần. Nếu bị front-run, issuer thật sẽ phải tạo batch mới với merkleRoot khác (thay đổi bất kỳ credential → root khác).

### 9.5 Disclosure Brute-Force

**Threat:** Kẻ tấn công thử brute-force giá trị PII từ commitment (biết key, thử value).

**Mitigation:** Salt 32 bytes (256 bits entropy) → brute-force infeasible. Ngay cả với key+value đã biết (e.g. `studentId = "1910347"`), cần thử 2^256 salt → không khả thi.

### 9.6 Merkle Proof Forgery

**Threat:** Tạo credential giả với Merkle proof hợp lệ nhưng nội dung khác.

**Mitigation:** Merkle leaf bao gồm `credId + publicClaimsHash + privateClaimsHash` → thay đổi bất kỳ nội dung nào sẽ thay đổi leaf → proof không khớp root đã anchor on-chain.

### 9.7 Threat Model Summary

| Threat                          | Severity | Likelihood | Mitigation                      | Status       |
| ------------------------------- | -------- | ---------- | ------------------------------- | ------------ |
| Signature replay across chain   | High     | Medium     | chainId + verifyingContract     | ✅ Mitigated |
| Compromised signer key          | Critical | Low        | revokeSigner + key rotation     | ✅ Mitigated |
| Bitmap index overflow           | Medium   | Low        | index < size check              | ✅ Mitigated |
| anchorBatch front-running       | Low      | Low        | Root uniqueness constraint      | ✅ Mitigated |
| Disclosure brute-force          | High     | Negligible | 256-bit salt                    | ✅ Mitigated |
| Merkle proof forgery            | Critical | Negligible | Content-bound leaf computation  | ✅ Mitigated |

---

## 10. Appendix

### A.1 ethers v6 — Sign Credential (Reference Implementation)

```typescript
import { ethers } from "ethers";

// ─── Domain ────────────────────────────────────────────
const domain = {
    name: "BKCredential",
    version: "3",
    chainId: 11155111, // Sepolia
    verifyingContract: "0x1234...CredentialRegistry",
};

// ─── Types (nested struct) ─────────────────────────────
const types = {
    PublicClaims: [
        { name: "vct",            type: "string" },
        { name: "degreeTitle",    type: "string" },
        { name: "graduationDate", type: "string" },
        { name: "honors",         type: "string" },
    ],
    BkCredential: [
        { name: "credId",        type: "string"       },
        { name: "issuedAt",      type: "uint64"       },
        { name: "batchId",       type: "string"       },
        { name: "publicClaims",  type: "PublicClaims" },
        { name: "privateClaims", type: "bytes32[]"    },
        { name: "merkleRoot",    type: "bytes32"      },
    ],
};

// ─── Message ───────────────────────────────────────────
const message = {
    credId: "urn:uuid:3f8e2d1a-7b4c-4e9f-a1d2-8c5b6f0e3a7d",
    issuedAt: 1750000000,
    batchId: "GRAD-2026-01",
    publicClaims: {
        vct: "BKISC_DEGREE",
        degreeTitle: "Kỹ sư Khoa học Máy tính",
        graduationDate: "2026-06-15",
        honors: "Giỏi",
    },
    privateClaims: [
        "0x3e1f9a2b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
        "0xa9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    ],
    merkleRoot: "0x7f2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
};

// ─── Sign ──────────────────────────────────────────────
const wallet = new ethers.Wallet("0xPRIVATE_KEY");
const signature = await wallet.signTypedData(domain, types, message);
console.log("Signature:", signature); // 0x...130 hex chars (65 bytes)

// ─── Verify ────────────────────────────────────────────
const recovered = ethers.verifyTypedData(domain, types, message, signature);
console.log("Recovered:", recovered); // === wallet.address
```

### A.2 Selective Disclosure — Code Example

```typescript
import { ethers } from "ethers";

// ─── Create Disclosure ─────────────────────────────────
function createDisclosure(key: string, value: string) {
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const commitment = ethers.solidityPackedKeccak256(
        ["bytes32", "string", "string"],
        [salt, key, value]
    );
    return { salt, key, value, commitment };
}

// ─── Verify Disclosure ─────────────────────────────────
function verifyDisclosure(
    disclosure: { salt: string; key: string; value: string },
    expectedCommitment: string
): boolean {
    const recomputed = ethers.solidityPackedKeccak256(
        ["bytes32", "string", "string"],
        [disclosure.salt, disclosure.key, disclosure.value]
    );
    return recomputed === expectedCommitment;
}

// ─── Usage ─────────────────────────────────────────────
const d1 = createDisclosure("fullName", "Trần Lê Công Minh");
const d2 = createDisclosure("studentId", "1910347");
const d3 = createDisclosure("dob", "2001-08-12");

const privateClaims = [d1.commitment, d2.commitment, d3.commitment];
// → privateClaims[] goes into EIP-712 signed payload

// Verifier side:
const isValid = verifyDisclosure(d1, privateClaims[0]); // true
```

### A.3 Gas Estimation Formulas

```
# anchorBatch
gas = 21000 (base)
    + 6400  (SSTORE cold: anchors[merkleRoot])     × 3 fields
    + 2100  (SSTORE cold: batchRoots[batchIndex])
    + ~5000 (calldata + keccak256 + event)
≈ 25,000–30,000 gas

# Gas per credential (batch of N):
gas_per_cred = gas_anchorBatch / N
             = 25,000 / 10,000
             = 2.5 gas/cred

# revoke (warm slot — same word already touched)
gas = 5000 (SSTORE warm: bitmap word OR)
    + 2100 (SLOAD: read current bitmap word)
    + ~3000 (calldata + event)
≈ 5,000–8,000 gas

# isRevoked (view)
gas = 2100 (SLOAD: read bitmap word)
    + ~500  (bit shift + AND)
≈ 2,600 gas
```

### A.4 Credential JSON Schema (Zod — Complete)

```typescript
import { z } from "zod";

const bytes32Hex = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const addressHex = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const PublicClaimsSchema = z.object({
    vct: z.string().min(1),
    degreeTitle: z.string().min(1),
    graduationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    honors: z.string(),
});

export const DisclosureSchema = z.object({
    salt: bytes32Hex,
    key: z.string().min(1),
    value: z.string(),
});

export const MerkleProofSchema = z.object({
    root: bytes32Hex,
    leaf: bytes32Hex,
    proof: z.array(bytes32Hex),
    index: z.number().int().nonnegative(),
});

export const IssuerSchema = z.object({
    name: z.string().min(1),
    did: z.string().startsWith("did:ethr:"),
    signer: addressHex,
});

export const BkCredentialSchema = z.object({
    "@context": z.literal("https://bkcred.xyz/v3"),
    type: z.literal("BkCredential"),
    credId: z.string().startsWith("urn:uuid:"),
    issuedAt: z.number().int().positive(),
    batchId: z.string().min(1),
    issuer: IssuerSchema,
    publicClaims: PublicClaimsSchema,
    privateClaims: z.array(bytes32Hex).min(1),
    merkle: MerkleProofSchema,
    signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
    disclosures: z.array(DisclosureSchema).optional(),
    exp: z.number().int().positive().optional(),
});

export type BkCredential = z.infer<typeof BkCredentialSchema>;
export type PublicClaims = z.infer<typeof PublicClaimsSchema>;
export type Disclosure = z.infer<typeof DisclosureSchema>;
```

### A.5 Constants & Addresses

```typescript
// ─── EIP-712 Domain Constants ──────────────────────────
export const EIP712_DOMAIN = {
    name: "BKCredential",
    version: "3",
} as const;

// ─── Chain IDs ─────────────────────────────────────────
export const CHAIN_IDS = {
    SEPOLIA: 11155111,
    MAINNET: 1,
    HARDHAT: 31337,
} as const;

// ─── Credential Types ──────────────────────────────────
export const CREDENTIAL_TYPES = {
    BKISC_DEGREE: "BKISC_DEGREE",       // Bằng Kỹ sư KHMT
    BKEE_DEGREE: "BKEE_DEGREE",         // Bằng Kỹ sư Điện-Điện tử
    BKME_DEGREE: "BKME_DEGREE",         // Bằng Kỹ sư Cơ khí
    TRANSCRIPT: "TRANSCRIPT",            // Bảng điểm
} as const;
```

---

_Phiên bản 1.0.0 — Đặc tả kỹ thuật Phase 3 EIP-712 Trust Anchor._
_Tham chiếu: [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [OpenZeppelin Contracts v5](https://docs.openzeppelin.com/contracts/5.x/), [ethers v6](https://docs.ethers.org/v6/)._
