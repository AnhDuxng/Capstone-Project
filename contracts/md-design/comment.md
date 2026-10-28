I. Nhận xét tổng quan

GĐ3 có hướng cải tiến hợp lý và khối lượng kỹ thuật tốt: 2 smart contract tách vai trò, SDK 6 module, 4 portal, bộ test 97 case, benchmark 5 kịch bản và neo thử 10.000 credential lên Sepolia. GĐ2 tự thừa nhận thiếu benchmark quy mô lớn, và GĐ3 đã bù đúng chỗ đó.

Tuy nhiên, nếu chấm nghiêm túc, tôi thấy ba vấn đề lớn:

Phần so sánh GĐ2–GĐ3, vốn là luận điểm trung tâm của báo cáo, mô tả GĐ2 sai so với chính báo cáo GĐ2.
Thiết kế mới có ít nhất một lỗ hổng logic (bypass thu hồi) và nhiều thuộc tính bảo mật bị bỏ ngỏ hoặc thụt lùi so với GĐ2.
Số liệu thực nghiệm có nhiều chỗ tự mâu thuẫn và không so sánh cùng điều kiện.
II. Điểm mạnh của GĐ3
Kiến trúc gọn hơn: bỏ cơ chế pin IPFS cho từng credential, dùng StandardMerkleTree của OpenZeppelin, và tách IssuerRegistry / CredentialRegistryV3.
Cơ chế bitmap revocation cùng bộ test biên (index 0, 255, 256, 65535) là ý tưởng hay.
Xử lý batch lớn (chunk 20×500, SSE) và benchmark có phân tích từng bước.
Có STRIDE, bộ test tấn công 33 case, và bảng địa chỉ contract/tx để kiểm chứng.
III. GĐ3 mô tả GĐ2 không đúng với báo cáo GĐ2
GĐ3 khẳng định về GĐ2 Báo cáo GĐ2 thực tế
Mỗi credential là NFT ERC-721, mint ~103.156 gas/cred, 10k cred ≈ 1,03 tỷ gas GĐ2 không có ERC-721/NFT. Đã dùng Merkle batch, đo được ~24.638 gas/cred (N=100). Con số 103.156 chính là gas của lệnh revoke (Bảng 5.5 GĐ2)
Sinh viên bắt buộc có ví Web3 để nhận NFT GĐ2 ghi rõ "không yêu cầu ví blockchain cho holder", dùng magic link
Một contract "CertificateRegistry" nguyên khối GĐ2 đã có IssuerRegistry + CredentialRegistry
Xác minh ~608 ms (IPFS + 3 RPC) GĐ2 đo ~289 ms, không có bước IPFS trong pipeline xác minh
Leaf = keccak256(credId ‖ pcvCid) GĐ2: leaf = keccak256(canonicalize(pcvJson)), credId không tham gia
Revoke ~45.000 gas GĐ2 đo thực tế ~103.154 gas
Code coverage <80% GĐ2 không có số liệu coverage

Báo cáo GĐ3 còn tự mâu thuẫn: mục 1.1 nói GĐ2 là "SD-JWT VC + on-chain Merkle registry", còn mục 1.4 lại nói là NFT.

Hệ quả là "9.785× rẻ hơn" và "165.000× tiết kiệm" so với một baseline không tồn tại. Nếu so với GĐ2 thật (~22–25k gas/cred ở N=10k, tôi ước tính), mức cải thiện chỉ cỡ 2.000–2.500×. Vẫn rất tốt, nhưng khác xa con số báo cáo.

Chi phí USD cũng không cùng điều kiện. $92.700 tính ở 30 gwei, còn $0,56 tính ở ~1,1 gwei của Sepolia. Cùng 30 gwei thì 105k gas ≈ $9,5 và 167k gas ≈ $15.

IV. Vấn đề thiết kế và bảo mật của GĐ3
Bypass thu hồi qua index. Leaf chỉ gồm (credId, pubHash, privHash), struct ký không có index, và Merkle proof của OZ dùng sorted-pair nên không xác định vị trí. Nếu đúng như báo cáo mô tả, holder có thể sửa index trong file JSON sang bit chưa bị thu hồi để qua bước 9. GĐ2 thu hồi theo credIdHash nằm trong nội dung đã ký nên không có lỗ hổng này. 33 test tấn công không có case này.
Struct đã ký thiếu trường. Không có exp (nhưng bước 10 kiểm tra hết hạn), không có issuer, không có subject/holder.
Không có holder binding. GĐ2 đã nêu đây là hạn chế và hứa giải quyết, nhưng GĐ3 không đề cập và STRIDE cũng không có. File bị lộ thì ai cũng trình được, và nếu ẩn tên thì credential không chứng minh được thuộc về ai.
Ngữ nghĩa revokeSigner không nhất quán. Mục 3.3.1 nói batch cũ vẫn hợp lệ, nhưng bước 7 kiểm tra isSigner tại thời điểm xác minh, nên hủy signer làm vô hiệu toàn bộ credential cũ. Ngược lại, revoke() yêu cầu onlySigner và msg.sender == anchor.issuer, nên signer đã bị hủy không thể thu hồi credential của mình. Admin/owner cũng không thu hồi được, dù Admin Panel (mục 4.4.4) mô tả chức năng này.
Thụt lùi về bảo vệ dữ liệu. GĐ2 mã hóa disclosure và khóa issuer (AES-256-GCM + KEK). GĐ3 lưu DisclosureV3(salt, key, value) không thấy nhắc mã hóa, và không nói cách bảo quản khóa ký khi bulk.ts ký ở server.
Mất tính "trustless khi backend chết". Đây là luận điểm chính của GĐ2. GĐ3 bỏ IPFS nên dữ liệu chỉ còn ở file của sinh viên và DB Neon. Deep-link /v3/verify?credId= cũng phải hỏi DB. Đồng thời anchorBatch vẫn nhận ipfsCid và lưu string on-chain, trái với "eliminated IPFS".
Job manager chỉ nằm trong bộ nhớ. GĐ2 có idempotency key. Nếu tắt trình duyệt sau khi neo on-chain nhưng trước /anchor-confirm, salt của 10.000 credential có thể mất.
Phạm vi bị thu hẹp. GĐ2 có template, đa issuer, CLI bk-verify, QR. GĐ3 chỉ còn schema cố định 4 trường, và không thấy CLI.
V. Số liệu và trình bày
Bitmap "~64×": 1 slot = 256 bit thì phải là 256×. Bảng 2.2 coi revoke chỉ ~5.000 gas, bỏ qua 21k gas nền, trong khi Bảng 3.2 tự ghi lần đầu ~56k.
Gas neo là 105k (Hardhat) nhưng 167.804 (Sepolia thật). Mục 1.4 còn ghi "up to 232 certificates".
Throughput: 779 / 809 / 363 cred/s và 202 / 181,8 / 186,9 verif/s xuất hiện lẫn lộn giữa abstract và bảng. Heap 50k cred: 348 MB (Bảng 5.3) nhưng "dưới 250 MB" ở mục 6.3.2. Tổng Bảng 5.4 lệch ~33 ms.
Xây Merkle 10k leaf mất 14 s, chiếm 52% tổng thời gian. Với thư viện OZ thì con số này bất thường.
Kịch bản C và D chạy offline trong một process (không RPC), còn GĐ2 đo có RPC (15–92 req/s). Con số "204 ms online" không có bảng đo nào trong Chương 5.
