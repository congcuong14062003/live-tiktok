# AI mỗi ngày — Quiz LIVE có bảng xếp hạng

Ứng dụng chọn từ tiếng Anh đúng với bốn phương án A–D bằng bình luận, hiển thị câu trả lời gần đây, cộng điểm tự động và xếp hạng trực tiếp. Giao diện hồng nhung lấy cảm hứng từ video `Download.mp4`; ảnh nền mới được tạo riêng cho app. Ngân hàng từ và hiệu ứng nền kế thừa từ `D:\VIDEO-AI-TIKTOK\quiz-live`; thư mục mẫu không bị sửa.

## Bắt đầu

1. Nhấp đúp `START_QUIZ.bat`, giữ cửa sổ này mở.
2. Mở `http://127.0.0.1:8094/admin.html` (hoặc nhấp đúp `OPEN_ADMIN.bat`).
3. Trong TikTok LIVE Studio, thêm Browser Source `http://127.0.0.1:8094/live.html`, kích thước **1080 × 1920**. Có thể nhấp đúp `OPEN_LIVE.bat` để xem thử.
4. Bắt đầu phát LIVE trên TikTok, rồi tại trang admin bấm **Kết nối** cho `@aimoingay.tips`. Chỉ khi trạng thái báo **Đã kết nối** thì bình luận mới được chấm tự động.
5. Chọn cấp độ và nhấn **Bắt đầu / Làm lại** ở trang admin.

Trang admin có bộ đếm **Đã nhận bình luận thật**. Sau khi kết nối, hãy nhờ một tài khoản khác bình luận thử: bộ đếm phải tăng. Nút **Gửi thử** chỉ kiểm tra luật chấm điểm nội bộ và không làm tăng bộ đếm này.

Ứng dụng dùng Node.js 24 đi kèm trong `runtime/node.exe`; không cần thay bản Node.js đang cài trên máy. Gói đọc chat đã được cài trong dự án.

Khi lấy dự án từ Git trên máy khác, thư mục `runtime/` và `node_modules/` không được đưa vào repository. Hãy cài Node.js 24, chạy `npm install`, rồi đặt `node.exe` vào `runtime/node.exe` để dùng `START_QUIZ.bat`; hoặc chạy `node server.js` trực tiếp.

## Luật chơi

- Mỗi hiệp 15 câu. Mỗi câu mặc định có 10 giây nhận đáp án, 3 giây hiện đáp án, sau đó tự chuyển câu.
- Mỗi câu hiện một nghĩa tiếng Việt và **bốn từ tiếng Anh A, B, C, D**. Người xem bình luận một chữ cái đáp án, ví dụ `A` hoặc `a`. Không phân biệt chữ hoa, chữ thường; có thể thêm một dấu `.`, `!` hoặc `?` ở cuối. Bình luận nguyên từ tiếng Anh không được tính điểm.
- Ba phương án sai lấy từ cùng cấp độ, không trùng từ hoặc trùng nghĩa tiếng Việt với phương án đúng. Vị trí đáp án đúng được xáo mỗi câu.
- Người đúng đầu tiên: **13 điểm**; những người đúng tiếp theo: **10 điểm**. Mỗi tài khoản chỉ được cộng điểm một lần trong mỗi câu.
- Khi hết thời gian, điểm câu đó bị khóa. Bình luận đến muộn vẫn hiện trong danh sách gần đây với nhãn **muộn**, nhưng không được cộng điểm. Bình luận khi quiz chưa bắt đầu hoặc đang tạm dừng cũng hiện với lý do tương ứng.
- Sau câu 15 và thời gian hiện đáp án, popup tổng kết hiển thị **top 3 người chơi của hiệp**, gồm avatar, tên, `@username` và điểm. Hiệp mới tự bắt đầu với bảng điểm mới.
- Màn tổng kết mặc định hiện **18 giây** với avatar, username và hiệu ứng chúc mừng. Có thể đặt 15–30 giây; đặt 0 để bỏ qua popup.
- Trang admin có ô gửi bình luận thử để kiểm tra điểm trước khi phát thật. Điểm thử sẽ xuất hiện trên màn hình; bấm **Xóa điểm** để làm sạch.
- **Bắt đầu / Làm lại** đặt lại bảng điểm. **Dừng** dừng quiz nhưng không tự ngắt kết nối chat.

## Âm thanh và giọng đọc

Nhạc nền chill không lời phát lặp trong lúc chơi. Tiếng báo thời gian vang từ mốc 5 giây, giây cuối nổi bật hơn. Khi có người đầu tiên trả lời đúng hoặc khi mở đáp án, app phát một đoạn chuông ba nốt rõ hơn tiếng bíp cũ. Không có thuyết minh tiếng Việt, kể cả lúc tổng kết top 3. Khi mở đáp án, trình duyệt vẫn phát âm từ tiếng Anh. Font Nunito nằm ngay trong dự án nên không cần tải font khi phát.

Phát âm tiếng Anh dùng giọng có sẵn trong trình duyệt LIVE, ưu tiên giọng Mỹ hoặc Google nếu có. Trước buổi phát, mở màn LIVE, bấm **Bật âm thanh** nếu nút này xuất hiện, rồi bấm **Thử phát âm tiếng Anh** trong admin. Khung xem thử trong admin đã tắt tiếng. Chỉ bật âm thanh từ một Browser Source. Thêm `?volume=0.5` vào URL live để giảm âm lượng, hoặc `?mute=1` để tắt toàn bộ âm thanh.

## Lưu ý về kết nối TikTok

TikTok hiện không có API công khai để đọc bình luận LIVE. App dùng `tiktok-live-connector`, một thư viện không chính thức. Kết nối cần dịch vụ ký của Euler Stream; thư viện có thể ngừng hoạt động khi TikTok đổi giao thức hoặc khi nhà cung cấp giới hạn truy cập. App không cần mật khẩu TikTok. Trạng thái và lỗi kết nối được hiển thị trong admin, và app tự thử kết nối lại sau 15 giây khi lỗi. Chỉ kiểm tra được kết nối thật khi tài khoản đang LIVE.

App bỏ qua lô bình luận cũ có thể được thư viện gửi ngay khi vừa kết nối. Điểm được tính theo thời điểm máy chủ **nhận** bình luận; nếu mạng hoặc TikTok chuyển chat chậm qua mốc hết giờ, bình luận đó sẽ không được điểm. Có thể tăng thời gian đoán ở trang admin khi cần.

Nếu bình luận không hiện, trước tiên kiểm tra cửa sổ `START_QUIZ.bat` còn mở và trang admin báo **Đã kết nối**. Trên màn LIVE, nhãn góc trên bên phải hiển thị trạng thái kết nối chat. Trang admin có bộ đếm **Đã nhận bình luận thật** và dòng bình luận gần nhất kèm lý do có hoặc không được điểm. Nếu bộ đếm vẫn là 0 sau khi một tài khoản khác bình luận trong LIVE, app chưa nhận được sự kiện từ TikTok; việc tăng thời gian câu hỏi không xử lý được trường hợp này. Nếu bộ đếm tăng nhưng điểm không tăng, xem lý do ở dòng bình luận gần nhất.

Trang admin còn hiển thị **Độ trễ TikTok → app** ước tính từ thời điểm TikTok ghi vào sự kiện chat đến lúc server nhận. Số này chỉ xuất hiện nếu sự kiện có timestamp hợp lệ; đây là ước tính và có thể lệch do đồng hồ máy. Khi app nhận chat, điểm và bình luận được đẩy tới Browser Source ngay; bộ cập nhật đồng hồ 200 ms không trì hoãn việc chấm điểm.

Ngân hàng có đúng **2.000 từ đơn**: A1 576, A2 569, B1 489, B2 316, C1 25, C2 25. Bộ bổ sung 497 từ A1–B2 nằm trong `extra_bank.tsv`, với nghĩa tiếng Việt ngắn cho từng từ. Năm từ xuất hiện trong video mẫu được bổ sung hoặc chỉnh nghĩa: blind, release, consist, luxury, globe. Chế độ trộn dùng chu kỳ 30 câu gồm A1 ×10, A2 ×8, B1 ×7, B2 ×3, C1 ×1 và C2 ×1; cả sáu cấp đều có thể xuất hiện, còn hai cấp khó rất hiếm. Những cặp có cùng nghĩa, cùng chữ đầu và cùng độ dài đã được phân biệt bằng gợi ý cụ thể hơn. Nguồn tham khảo khi biên soạn: [Oxford 3000](https://www.oxfordlearnersdictionaries.com/about/wordlists/) và [từ điển Anh–Việt mở](https://github.com/skypediacode/english-vietnamese-dictionary). Toàn bộ 2.000 mục chưa được giáo viên duyệt từng mục.
