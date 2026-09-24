# BK Credential System — Phase 3 Bulk 10K Benchmark Report

> **Measurement Date:** 2026-08-18T14:31:39.471Z  
> **Environment:** Node.js v24.15.0, Hardhat / Ethers.js v6  
> **Dataset:** `fixtures/graduation-2026.csv` (10,000 records)  
> **Raw Dataset JSONL:** [`perf-results/phase3-bulk-10k.jsonl`](./phase3-bulk-10k.jsonl)

---

## 1. Executive Summary

| Metric | Phase 2 (ERC-721 + IPFS) | Phase 3 (EIP-712 Trust Anchor) | Improvement |
|---|---|---|---|
| **Batch Issuance Throughput** | ~2 creds/sec (IPFS bottleneck) | **387 creds/sec** | **~194× faster** |
| **EIP-712 Signing Speed** | ~500 creds/sec (ES256K JWT) | **850 creds/sec** | **~1.7× faster** |
| **Total 10K Issuance Time** | ~83 minutes (extrapolated) | **25.81 seconds** | **~180× faster** |
| **On-Chain Gas / Credential** | ~103,156 gas/cred ($O(N)$) | **10.5 gas/cred ($O(1)$)** | **~9,824× gas reduction** |
| **Verification Latency (Offline)** | N/A (requires IPFS fetch) | **5.89 ms / verification** | **Zero-gas & Instant** |
| **Verification Pass Rate** | 100% | **100% (100/100 sampled)** | **100% Cryptographic Correctness** |

---

## 2. Phase-by-Phase Performance Breakdown (10,000 Credentials)

| Phase | Duration | Throughput / Rate | Heap Memory (Used / Total) |
|---|---|---|---|
| **1. CSV Parsing** | 33.75 ms | 296,296 records/sec | 204.01 MB / 279.2 MB |
| **2. Salted Disclosures Generation** | 1094 ms | ~9,141 ops/sec | 337.26 MB / 465.57 MB |
| **3. Merkle Tree Construction ($N=10k$)** | 12949 ms | ~772 leaves/sec | 337.27 MB / 465.57 MB |
| **4. EIP-712 Typed Signing (20 chunks)** | 11766 ms | **850 creds/sec** | 337.27 MB / 465.57 MB |
| **5. IPFS Metadata Prep** | 0.39 ms | Instant (223 bytes) | 337.27 MB / 465.57 MB |
| **TOTAL PIPELINE DURATION** | **25.81 s** | **387 creds/sec** | **358.52 MB** |

---

## 3. Verification Latency Distribution (100 Sampled Credentials)

- **Average Latency:** `5.89 ms` (~170 verifications/sec)
- **Minimum Latency:** `4.19 ms`
- **Median (p50):** `5.53 ms`
- **p90:** `6.84 ms`
- **p99:** `17.51 ms`
- **Maximum Latency:** `17.51 ms`

---

## 4. Cryptographic Commitments

- **Merkle Root:** `0x066246053be608da38d14417bf773dd2169254d7a8221383347e10006bf044e3`
- **Total Leaves:** `10,000`
- **Issuer Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Signature Schema:** EIP-712 Typed Data (`BkCredential`)
