2.1 Verifiable Credentials
2.1.1 Khái niệm Verifiable Credential
Verifiable Credential (VC) là một chuẩn dữ liệu được W3C phát hành nhằm mô
tả tập hợp các khẳng định (claims) mà một bên đưa ra về một chủ thể, đồng thời
cho phép bên thứ ba kiểm chứng tính xác thực của các khẳng định đó mà không cần
liên lạc trực tiếp với bên phát hành [1]. Khác với các loại giấy tờ truyền thống (chứng
chỉ PDF, mã QR nội bộ), VC mang tính kiểm chứng mật mã: chữ ký số của issuer
được gắn trực tiếp vào credential, cho phép bất kỳ verifier nào có public key của
issuer cũng có thể tự xác nhận tính toàn vẹn của dữ liệu. W3C đã công bố Verifiable
Credentials Data Model v2.0 như một Recommendation chính thức vào tháng 5 năm
2025 [1].
Mỗi VC gồm ba thành phần chính: credential metadata (thông tin về issuer,
ngày phát hành, ngày hết hạn, loại credential), credential subject (tập các claim
về người nhận), và proof (chữ ký hoặc bằng chứng mật mã cho phép kiểm chứng).
Định dạng biểu diễn phổ biến là JSON-LD (được W3C khuyến nghị chính thức) hoặc
JWT (được sử dụng rộng rãi trong thực tiễn kỹ thuật)

2.1.2 Mô hình Issuer – Holder – Verifier
W3C VC Data Model định nghĩa một hệ sinh thái ba bên [1]. Issuer là bên tạo
và ký credential. Holder là bên nhận và lưu trữ credential. Verifier là bên nhận
và kiểm chứng credential khi holder trình bày. Điểm then chốt của mô hình này là
verifier không cần liên hệ issuer theo thời gian thực để xác minh — thay vào đó,
verifier chỉ cần kiểm tra chữ ký mật mã dựa trên public key của issuer.
Trong BK Credential System, mô hình này được cụ thể hóa như sau: issuer là một
tổ chức đã được đăng ký trên blockchain (ví dụ: BKISC), holder là sinh viên nhận
chứng chỉ, và verifier là bất kỳ bên nào muốn xác minh credential thông qua portal
web hoặc công cụ CLI mà không cần tin tưởng vào backend của trường.

2.2 Selective Disclosure JWT (SD-JWT)
2.2.1 JWT và hạn chế trong bảo vệ quyền riêng tư
JSON Web Token (JWT) là một chuẩn biểu diễn dữ liệu dạng JSON compact,
được ký bằng khóa bí mật hoặc cặp khóa bất đối xứng [2]. JWT được sử dụng phổ
biến trong các hệ thống xác thực và cấp phép. Tuy nhiên, khi dùng JWT thuần túy
8
để biểu diễn credential, toàn bộ payload đều hiển thị cho verifier — holder không
có khả năng che giấu những trường thông tin không cần thiết mà vẫn giữ được tính
hợp lệ của chữ ký. Điều này gây rủi ro rò rỉ dữ liệu cá nhân khi holder phải trình
credential cho nhiều verifier khác nhau.

2.2.2 Cơ chế SD-JWT
SD-JWT (Selective Disclosure for JWTs) là một cơ chế bổ sung cho JWT, cho
phép holder lựa chọn những phần dữ liệu nào sẽ tiết lộ cho verifier mà không làm
mất hiệu lực chữ ký của issuer [3]. Cơ chế SD cốt lõi — bao gồm hashing, disclosure
format và mảng \_sd[] — được định nghĩa trong RFC 9901 [3], IETF Proposed
Standard được công bố chính thức vào tháng 11 năm 2025. Phần profile dành cho
Verifiable Credentials — bao gồm trường vct, kiểu typ: vc+sd-jwt và quy ước iss
là DID — được định hướng theo tài liệu IETF draft-ietf-oauth-sd-jwt-vc (hiện
tại là draft-16, tháng 4 năm 2026) [4], vốn kế thừa và xây dựng trên nền tảng của
RFC 9901.
Nguyên lý hoạt động như sau: thay vì đặt giá trị gốc của mỗi claim trực tiếp trong
JWT payload, issuer thay thế mỗi claim bằng một hash commitment tính từ một
bộ ba [salt, claimName, claimValue]. Cụ thể, với mỗi claim cần che giấu:

1. Issuer tạo ngẫu nhiên một giá trị salt (16 byte).
2. Issuer mã hóa bộ ba [salt, claimName, claimValue] thành chuỗi
   base64url(JSON.stringify([salt, claimName, claimValue])). Chuỗi này
   được gọi là một Disclosure.
3. Issuer tính hash: base64url(SHA-256(Disclosure)) và đưa vào mảng \_sd[]
   trong JWT payload.
4. Toàn bộ Disclosures được lưu riêng, nối với JWT bằng ký tự ~.
   Khi chia sẻ credential, holder chỉ đính kèm những Disclosure tương ứng với các
   claim mà mình muốn tiết lộ. Verifier kiểm chứng bằng cách tính lại hash của mỗi
   Disclosure và so sánh với mảng \_sd[] trong JWT — nếu khớp, claim đó được xác
   nhận là hợp lệ và đến từ issuer.

2.3 Blockchain và Smart Contracts
2.3.1 Blockchain và tính bất biến
Blockchain là một cấu trúc dữ liệu phân tán, trong đó các giao dịch được nhóm
thành các khối và liên kết nhau thành chuỗi bằng hàm băm mật mã [5]. Bất kỳ sự
thay đổi nào ở một khối sẽ làm vô hiệu tất cả các khối tiếp theo, khiến việc giả mạo
lịch sử giao dịch trở nên cực kỳ tốn kém về mặt tính toán. Tính bất biến này làm cho
blockchain trở thành nền tảng lý tưởng để lưu trữ các trust anchor — những dữ liệu
mà bất kỳ bên nào cũng có thể kiểm tra và không ai có thể chỉnh sửa sau khi đã ghi.
2.3.2 Ethereum, EVM và Smart Contracts
Ethereum là nền tảng blockchain hỗ trợ smart contract — các đoạn mã chạy
tự động trên mạng phân tán và không thể bị sửa đổi sau khi triển khai [6]. Smart
contract được thực thi bởi Ethereum Virtual Machine (EVM), một môi trường tính
toán đồng nhất được mọi node trên mạng chạy. Bất kỳ ai cũng có thể gọi hàm của
smart contract và kết quả thực thi là minh bạch, xác định và không thể phủ nhận.
Trong BK Credential System, smart contracts đóng vai trò trust anchor on-chain:
IssuerRegistry quản lý danh sách các địa chỉ Ethereum của tổ chức phát hành hợp
lệ, còn CredentialRegistry lưu trữ các Merkle root của từng batch credential và
trạng thái revocation. Nhờ đó, verifier có thể truy vấn trực tiếp blockchain để kiểm
tra tính hợp lệ của một credential, hoàn toàn không cần backend của HCMUT.

2.3.3 Sepolia Testnet
Sepolia là mạng thử nghiệm của Ethereum, sử dụng cơ chế đồng thuận Proof-ofStake tương đương mainnet nhưng dùng ETH không có giá trị thực. Việc triển khai
trên Sepolia cho phép đo lường chi phí gas và kiểm tra hành vi của smart contract
trong điều kiện gần giống mainnet mà không phát sinh chi phí thực sự. BK Credential
System sử dụng Sepolia trong toàn bộ giai đoạn phát triển và thử nghiệm.

2.4 Merkle Tree và Merkle Proof
2.4.1 Cấu trúc Merkle Tree
Merkle tree là một cấu trúc dữ liệu cây nhị phân trong đó mỗi nút lá (leaf node)
chứa hash của một phần dữ liệu, còn mỗi nút trong (internal node) chứa hash của
hai nút con bên dưới nó. Nút gốc (Merkle root) là hash duy nhất đại diện cho toàn
bộ tập dữ liệu: bất kỳ thay đổi nào ở bất kỳ lá nào đều sẽ truyền ngược lên và thay
đổi Merkle root. Tính chất này tạo ra một cam kết (commitment) ngắn gọn, bất biến
cho toàn bộ tập dữ liệu [5, 7].
2.4.2 Merkle Proof và xác minh thành viên
Với Merkle tree, có thể chứng minh rằng một phần tử cụ thể thuộc tập dữ liệu
mà không cần tiết lộ toàn bộ tập đó. Bằng chứng này — gọi là Merkle proof hay
inclusion proof — bao gồm chuỗi các nút anh em (sibling hashes) dọc theo đường
đi từ lá lên gốc. Verifier chỉ cần lấy hash của phần tử cần kiểm tra, kết hợp lần lượt
với từng sibling hash trong proof, rồi so sánh kết quả cuối cùng với Merkle root đã
được lưu on-chain. Nếu khớp, phần tử đó được xác nhận là thuộc batch đã anchor.
Độ phức tạp của phép kiểm tra này chỉ là O(log n) với n là số lượng phần tử trong
tập.

2.4.3 Ứng dụng trong Merkle Batch Issuance
BK Credential System dùng Merkle tree để gom nhiều credential vào một batch.
Cụ thể, issuer tính hash của từng credential, xây dựng Merkle tree từ tập hash đó (sử
dụng thư viện @openzeppelin/merkle-tree), rồi chỉ anchor một Merkle root duy
nhất lên blockchain thay vì ghi từng credential riêng lẻ. Mỗi credential được cấp kèm
theo Merkle proof của chính nó (các trường merkleRoot, merkleLeaf, merkleProof
nhúng trực tiếp trong JWT payload). Verifier tự kiểm tra credential có thuộc về batch
đã anchor chỉ bằng phép tính Merkle proof cục bộ, không cần truy vấn thêm dữ liệu
nào khác ngoài Merkle root trên blockchain.
