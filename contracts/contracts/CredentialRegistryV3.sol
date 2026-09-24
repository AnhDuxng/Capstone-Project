// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IssuerRegistry.sol";

/**
 * @title CredentialRegistryV3
 * @notice Phase 3 — On-chain Trust Anchor for EIP-712 credential batches.
 *
 * Design principles (see SPEC.md §5):
 * - One `anchorBatch` tx per graduation batch (≈25k gas) anchors a Merkle root
 *   covering up to 2^32 credentials — zero gas per individual credential.
 * - Bitmap revocation: each credential is a single bit in a uint256 word,
 *   reducing revocation storage by ~64× compared to per-credential mapping.
 * - Only active signers (checked via IssuerRegistry) may anchor batches or revoke credentials.
 * - `verifyingContract` in the EIP-712 domain points to THIS contract address,
 *   preventing cross-contract replay.
 * - Multi-revocation helper (`revokeBatch`) and bulk status view (`isRevokedBatch`)
 *   for high-performance verification.
 * - Emergency control: inherits `Pausable` and `Ownable2Step` so university admins
 *   can pause state-changing operations during security incidents without disrupting read-only verification.
 *
 * @dev Contract is intentionally minimal — all credential data lives off-chain.
 */
contract CredentialRegistryV3 is Ownable2Step, Pausable {
    // ────────────────────────── Types ────────────────────────────

    struct BatchAnchor {
        uint64 anchoredAt;   // block.timestamp when anchored
        address issuer;      // signer who called anchorBatch
        uint32 size;         // number of credentials in this batch
        string ipfsCid;      // optional IPFS CID for batch metadata
    }

    // ────────────────────────── Storage ──────────────────────────

    /// @notice Reference to the IssuerRegistry for signer checks.
    IssuerRegistry public immutable issuerRegistry;

    /// @notice merkleRoot → BatchAnchor metadata.
    mapping(bytes32 => BatchAnchor) public anchors;

    /// @notice batchIndex → merkleRoot (for enumeration).
    mapping(uint32 => bytes32) public batchRoots;

    /// @notice merkleRoot → wordIndex → bitmap (each bit = 1 credential).
    mapping(bytes32 => mapping(uint256 => uint256)) private _revocationBitmap;

    /// @notice Auto-incrementing counter for batchIndex.
    uint32 public nextBatchIndex;

    // ────────────────────────── Events ───────────────────────────

    event BatchAnchored(
        bytes32 indexed merkleRoot,
        address indexed issuer,
        uint32 batchIndex,
        uint32 size,
        uint64 anchoredAt
    );

    event CredentialRevoked(
        bytes32 indexed merkleRoot,
        uint32 index,
        address revokedBy
    );

    event CredentialsBulkRevoked(
        bytes32 indexed merkleRoot,
        uint32 count,
        address revokedBy
    );

    // ────────────────────────── Errors ───────────────────────────

    error NotActiveSigner(address caller);
    error NotOriginalIssuer(address caller, address originalIssuer);
    error ZeroMerkleRoot();
    error ZeroBatchSize();
    error BatchAlreadyAnchored(bytes32 merkleRoot);
    error BatchNotFound(bytes32 merkleRoot);
    error IndexOutOfRange(uint32 index, uint32 batchSize);
    error AlreadyRevoked(bytes32 merkleRoot, uint32 index);
    error InvalidPagination();
    error EmptyIndicesArray();
    error ZeroAddress();

    // ────────────────────────── Modifiers ────────────────────────

    modifier onlySigner() {
        if (!issuerRegistry.isSigner(msg.sender)) {
            revert NotActiveSigner(msg.sender);
        }
        _;
    }

    // ────────────────────────── Constructor ──────────────────────

    /**
     * @param initialOwner The admin address who will own emergency pause controls.
     * @param _issuerRegistry Address of the deployed IssuerRegistry.
     */
    constructor(address initialOwner, address _issuerRegistry) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        require(_issuerRegistry != address(0), "Zero IssuerRegistry");
        issuerRegistry = IssuerRegistry(_issuerRegistry);
    }

    // ────────────────────────── Admin / Emergency Controls ──────

    /**
     * @notice Pause anchorBatch and revocation operations in an emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ────────────────────────── Write functions ──────────────────

    /**
     * @notice Anchor a batch Merkle root on-chain.
     * @param merkleRoot The Merkle root covering all credentials in this batch.
     * @param size       Number of credentials in the batch (used for index bounds).
     * @param ipfsCid    Optional IPFS CID for batch metadata JSON.
     * @return batchIndex The assigned batch index.
     */
    function anchorBatch(
        bytes32 merkleRoot,
        uint32 size,
        string calldata ipfsCid
    ) external whenNotPaused onlySigner returns (uint32 batchIndex) {
        if (merkleRoot == bytes32(0)) revert ZeroMerkleRoot();
        if (size == 0) revert ZeroBatchSize();
        if (anchors[merkleRoot].anchoredAt != 0) {
            revert BatchAlreadyAnchored(merkleRoot);
        }

        batchIndex = nextBatchIndex++;

        anchors[merkleRoot] = BatchAnchor({
            anchoredAt: uint64(block.timestamp),
            issuer: msg.sender,
            size: size,
            ipfsCid: ipfsCid
        });

        batchRoots[batchIndex] = merkleRoot;

        emit BatchAnchored(merkleRoot, msg.sender, batchIndex, size, uint64(block.timestamp));
    }

    /**
     * @notice Revoke a single credential by its index within a batch.
     * @dev Only the batch's original issuer (who is still an active signer) can revoke.
     * @param merkleRoot The batch Merkle root.
     * @param index      The credential index within the batch (0-based).
     */
    function revoke(bytes32 merkleRoot, uint32 index) external whenNotPaused onlySigner {
        BatchAnchor storage anchor = anchors[merkleRoot];
        if (anchor.anchoredAt == 0) revert BatchNotFound(merkleRoot);
        if (index >= anchor.size) revert IndexOutOfRange(index, anchor.size);
        if (msg.sender != anchor.issuer) revert NotOriginalIssuer(msg.sender, anchor.issuer);

        _revokeInternal(merkleRoot, index);

        emit CredentialRevoked(merkleRoot, index, msg.sender);
    }

    /**
     * @notice Revoke multiple credentials within the same batch in a single transaction.
     * @param merkleRoot The batch Merkle root.
     * @param indices    Array of credential indices within the batch.
     */
    function revokeBatch(bytes32 merkleRoot, uint32[] calldata indices) external whenNotPaused onlySigner {
        BatchAnchor storage anchor = anchors[merkleRoot];
        if (anchor.anchoredAt == 0) revert BatchNotFound(merkleRoot);
        if (msg.sender != anchor.issuer) revert NotOriginalIssuer(msg.sender, anchor.issuer);
        uint256 len = indices.length;
        if (len == 0) revert EmptyIndicesArray();

        for (uint256 i = 0; i < len; i++) {
            uint32 index = indices[i];
            if (index >= anchor.size) revert IndexOutOfRange(index, anchor.size);
            _revokeInternal(merkleRoot, index);
            emit CredentialRevoked(merkleRoot, index, msg.sender);
        }

        emit CredentialsBulkRevoked(merkleRoot, uint32(len), msg.sender);
    }

    // ────────────────────────── View functions ───────────────────

    /**
     * @notice Check if a single credential has been revoked.
     * @param merkleRoot The batch Merkle root.
     * @param index      The credential index within the batch.
     * @return True if the credential at `index` has been revoked.
     */
    function isRevoked(bytes32 merkleRoot, uint32 index) external view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitMask = 1 << (index % 256);
        return (_revocationBitmap[merkleRoot][wordIndex] & bitMask) != 0;
    }

    /**
     * @notice Check revocation status for multiple credentials in a single call.
     * @param merkleRoot The batch Merkle root.
     * @param indices    Array of credential indices to check.
     * @return statuses Array of boolean flags indicating if each credential is revoked.
     */
    function isRevokedBatch(bytes32 merkleRoot, uint32[] calldata indices)
        external
        view
        returns (bool[] memory statuses)
    {
        uint256 len = indices.length;
        statuses = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            uint32 index = indices[i];
            uint256 wordIndex = index / 256;
            uint256 bitMask = 1 << (index % 256);
            statuses[i] = (_revocationBitmap[merkleRoot][wordIndex] & bitMask) != 0;
        }
    }

    /**
     * @notice Get full anchor data for a batch.
     * @param merkleRoot The batch Merkle root.
     * @return anchoredAt Timestamp when the batch was anchored.
     * @return issuer     The signer who anchored this batch.
     * @return size       Number of credentials in the batch.
     * @return ipfsCid    Optional IPFS CID.
     */
    function getAnchor(bytes32 merkleRoot)
        external
        view
        returns (uint64 anchoredAt, address issuer, uint32 size, string memory ipfsCid)
    {
        BatchAnchor memory a = anchors[merkleRoot];
        return (a.anchoredAt, a.issuer, a.size, a.ipfsCid);
    }

    /**
     * @notice Get total number of anchored batches.
     */
    function getBatchCount() external view returns (uint32) {
        return nextBatchIndex;
    }

    /**
     * @notice Get a paginated list of anchored batch Merkle roots and metadata.
     * @param offset Starting index (batchIndex).
     * @param limit  Maximum number of batches to return.
     */
    function getBatches(uint32 offset, uint32 limit)
        external
        view
        returns (bytes32[] memory roots, BatchAnchor[] memory batchAnchors)
    {
        uint32 total = nextBatchIndex;
        if (offset >= total && total > 0) revert InvalidPagination();

        uint32 size = limit;
        if (offset + size > total) {
            size = total - offset;
        }

        roots = new bytes32[](size);
        batchAnchors = new BatchAnchor[](size);

        for (uint32 i = 0; i < size; i++) {
            bytes32 root = batchRoots[offset + i];
            roots[i] = root;
            batchAnchors[i] = anchors[root];
        }
    }

    // ────────────────────────── Internal Helpers ─────────────────

    function _revokeInternal(bytes32 merkleRoot, uint32 index) internal {
        uint256 wordIndex = index / 256;
        uint256 bitMask = 1 << (index % 256);

        if (_revocationBitmap[merkleRoot][wordIndex] & bitMask != 0) {
            revert AlreadyRevoked(merkleRoot, index);
        }

        _revocationBitmap[merkleRoot][wordIndex] |= bitMask;
    }
}
