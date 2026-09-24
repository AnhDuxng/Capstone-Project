// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title IssuerRegistry
 * @notice Phase 3 — Manages authorized signer addresses for EIP-712 credential issuance.
 *
 * Design:
 * - Only the contract owner (university admin) can add/revoke signers and update DIDs.
 * - Uses Ownable2Step for secure two-step ownership transfer.
 * - Stores optional DID label per signer for cross-system reference (e.g. "did:ethr:sepolia:0xABC...").
 * - Exposes `isSigner` for CredentialRegistryV3 to gate `anchorBatch`.
 * - Provides enumeration view functions (`getAllSigners`, `getSigners`, `getSignerCount`) for Web Dashboard & Verifier.
 *
 * @dev See SPEC.md §5 — IssuerRegistry interface.
 */
contract IssuerRegistry is Ownable2Step {
    // ────────────────────────── Storage ──────────────────────────

    /// @notice Whether an address is an active signer.
    mapping(address => bool) public isSigner;

    /// @notice Optional DID label for a signer.
    mapping(address => bytes) public did;

    /// @dev Internal list of all registered signers (both active and revoked).
    address[] private _signers;

    /// @dev Index mapping to track signer position in _signers array (1-based index to treat 0 as absent).
    mapping(address => uint256) private _signerIndices;

    // ────────────────────────── Events ───────────────────────────

    event SignerAdded(address indexed signer, bytes did);
    event SignerRevoked(address indexed signer);
    event SignerDidUpdated(address indexed signer, bytes newDid);

    // ────────────────────────── Errors ───────────────────────────

    error ZeroAddress();
    error AlreadySigner(address signer);
    error NotSigner(address signer);
    error InvalidPagination();

    // ────────────────────────── Constructor ──────────────────────

    /**
     * @param initialOwner The admin address that will own this registry.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    // ────────────────────────── Admin functions ──────────────────

    /**
     * @notice Register a new signer address.
     * @param signer   The Ethereum address that will sign EIP-712 credentials.
     * @param didLabel Optional DID string (pass empty bytes if not used).
     */
    function addSigner(address signer, bytes calldata didLabel) external onlyOwner {
        if (signer == address(0)) revert ZeroAddress();
        if (isSigner[signer]) revert AlreadySigner(signer);

        isSigner[signer] = true;
        did[signer] = didLabel;

        if (_signerIndices[signer] == 0) {
            _signers.push(signer);
            _signerIndices[signer] = _signers.length;
        }

        emit SignerAdded(signer, didLabel);
    }

    /**
     * @notice Update the DID label for an active signer.
     * @param signer The signer address whose DID is being updated.
     * @param newDid The new DID label.
     */
    function updateDid(address signer, bytes calldata newDid) external onlyOwner {
        if (!isSigner[signer]) revert NotSigner(signer);

        did[signer] = newDid;
        emit SignerDidUpdated(signer, newDid);
    }

    /**
     * @notice Revoke a signer — they can no longer anchor new batches.
     * @dev Does NOT invalidate batches already anchored by this signer.
     * @param signer The address to revoke.
     */
    function revokeSigner(address signer) external onlyOwner {
        if (!isSigner[signer]) revert NotSigner(signer);

        isSigner[signer] = false;

        emit SignerRevoked(signer);
    }

    // ────────────────────────── View Functions ────────────────────

    /**
     * @notice Get total number of historical signers ever registered.
     */
    function getSignerCount() external view returns (uint256) {
        return _signers.length;
    }

    /**
     * @notice Get all signers ever registered.
     */
    function getAllSigners() external view returns (address[] memory) {
        return _signers;
    }

    /**
     * @notice Get a paginated list of signers.
     * @param offset Starting index in the array.
     * @param limit  Maximum number of signers to return.
     */
    function getSigners(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result, bool[] memory activeStatus)
    {
        uint256 total = _signers.length;
        if (offset >= total && total > 0) revert InvalidPagination();

        uint256 size = limit;
        if (offset + size > total) {
            size = total - offset;
        }

        result = new address[](size);
        activeStatus = new bool[](size);

        for (uint256 i = 0; i < size; i++) {
            address s = _signers[offset + i];
            result[i] = s;
            activeStatus[i] = isSigner[s];
        }
    }
}
