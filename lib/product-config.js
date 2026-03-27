export const categoryOptions = [
  { value: "fashion", label: "Thời trang" },
  { value: "skincare", label: "Mỹ phẩm / Skincare" },
  { value: "home", label: "Gia dụng" },
  { value: "electronics", label: "Điện tử / Phụ kiện" },
  { value: "food", label: "Thực phẩm / Đồ uống" },
  { value: "footwear", label: "Giày dép" },
  { value: "bags", label: "Túi xách / Ví" },
  { value: "accessories", label: "Phụ kiện" },
  { value: "fragrance", label: "Nước hoa / Hương thơm" },
  { value: "pet", label: "Thú cưng" },
  { value: "sports", label: "Thể thao / Fitness" },
  { value: "other", label: "Khác" }
];

export const channelOptions = ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"];

export const subcategoryMap = {
  fashion: ["Đồ ngủ", "Áo thun", "Quần short", "Đồ mặc nhà", "Streetwear"],
  skincare: ["Serum", "Kem dưỡng", "Toner", "Sữa rửa mặt", "Chống nắng"],
  home: ["Nhà bếp", "Phòng ngủ", "Lưu trữ", "Dọn dẹp", "Trang trí"],
  electronics: ["Tai nghe", "Sạc", "Phụ kiện điện thoại", "Desk setup", "Smart devices"],
  food: ["Ăn vặt", "Healthy", "Đồ uống", "Tiện lợi", "Quà tặng"],
  footwear: ["Sneaker", "Giày bệt", "Sandal", "Giày cao gót", "Dép"],
  bags: ["Túi đeo vai", "Túi tote", "Túi mini", "Ba lô", "Ví"],
  accessories: ["Nón", "Thắt lưng", "Khăn", "Kính", "Trang sức"],
  fragrance: ["Nước hoa", "Body mist", "Tinh dầu thơm", "Nến thơm", "Xịt phòng"],
  pet: ["Đồ ăn", "Phụ kiện", "Đồ chơi", "Chăm sóc", "Đệm / ổ nằm"],
  sports: ["Đồ tập", "Phụ kiện tập", "Bình nước", "Yoga", "Chạy bộ"],
  other: ["Phổ thông", "Lifestyle", "Theo mùa", "Quà tặng", "Khác"]
};

export const toneOptions = ["Review tự nhiên", "Chuyên gia", "Chốt sale mạnh"];
export const brandStyleOptions = ["Cao cấp tối giản", "Trẻ trung hiện đại", "Chuyên gia đáng tin", "Bình dân chỉn chu"];
export const moodOptions = ["Tinh gọn sang trọng", "Ấm áp gần gũi", "Năng động cuốn hút", "Tự tin thuyết phục"];

export const samplePresets = {
  fashion: {
    productName: "SERA - Set áo cổ sen phối ren và chân váy chữ A Selina",
    category: "fashion",
    subcategory: 4,
    channel: 2,
    tone: 1,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "nữ yêu thích phong cách nữ tính và chỉn chu",
    shortDescription: "set thời trang nữ mang tinh thần thanh lịch, mềm mại và tinh tế",
    highlights: "cổ sen phối ren\nchân váy chữ A\nform lên dáng gọn",
    priceSegment: "phân khúc trung cao",
    attributes: "vải tex\nS, M, L\nmàu kem"
  },
  skincare: {
    productName: "Serum phục hồi da B5 + Niacinamide",
    category: "skincare",
    subcategory: 0,
    channel: 2,
    tone: 1,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "nữ 22 đến 35 tuổi, da khô và da nhạy cảm",
    shortDescription: "serum phục hồi, cấp ẩm và làm dịu da với kết cấu mỏng nhẹ",
    highlights: "thấm nhanh\nêm da\nhợp routine sáng tối",
    priceSegment: "329k",
    attributes: "Niacinamide, B5\nda khô, da nhạy cảm\nmỏng nhẹ, ráo nhanh"
  },
  electronics: {
    productName: "Tai nghe bluetooth chống ồn",
    category: "electronics",
    subcategory: 0,
    channel: 1,
    tone: 1,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "người đi làm và người thích setup gọn gàng",
    shortDescription: "tai nghe gọn, đeo êm, chống ồn và pin lâu",
    highlights: "chống ồn chủ động\nkết nối ổn định\npin bền bỉ",
    priceSegment: "1.290k",
    attributes: "chống ồn, cảm ứng\nBluetooth 5.3\npin 30 giờ"
  },
  home: {
    productName: "Kệ để bàn đa năng tối giản",
    category: "home",
    subcategory: 0,
    channel: 1,
    tone: 1,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "người làm việc tại nhà và người thích không gian gọn gàng",
    shortDescription: "thiết kế gọn, dễ sắp xếp đồ và phù hợp nhiều góc làm việc",
    highlights: "dễ vệ sinh\nbố cục ngăn hợp lý\nphù hợp bàn nhỏ",
    priceSegment: "459k",
    attributes: "đa công năng\n32 x 18 x 20 cm\ngỗ phủ melamine"
  },
  food: {
    productName: "Granola hạt mix vị cacao",
    category: "food",
    subcategory: 0,
    channel: 2,
    tone: 0,
    brandStyle: 1,
    mood: 1,
    targetCustomer: "dân văn phòng và người thích đồ ăn nhẹ lành mạnh",
    shortDescription: "granola giòn nhẹ, dễ ăn và tiện dùng trong ngày",
    highlights: "giòn nhẹ\ndễ mang theo\nvị cacao vừa miệng",
    priceSegment: "129k",
    attributes: "yến mạch, hạt điều, hạnh nhân\nvị cacao\nhũ 300g"
  },
  footwear: {
    productName: "Sneaker đế êm phối màu tối giản",
    category: "footwear",
    subcategory: 0,
    channel: 2,
    tone: 1,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "người thích outfit gọn và ưu tiên độ êm chân hằng ngày",
    shortDescription: "sneaker gọn dáng, đế êm và dễ kết hợp cùng nhiều outfit thường nhật",
    highlights: "đế êm\nform gọn\nphối đồ linh hoạt",
    priceSegment: "890k",
    attributes: "da tổng hợp / canvas\n36-39\ntrắng kem"
  },
  bags: {
    productName: "Túi đeo vai mini form cứng",
    category: "bags",
    subcategory: 0,
    channel: 2,
    tone: 1,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "nữ trẻ theo phong cách tối giản và thanh lịch",
    shortDescription: "form túi gọn, cứng cáp và đủ tinh tế để đi làm hoặc đi chơi nhẹ",
    highlights: "form cứng giữ dáng\nngăn chứa gọn\nphối đồ dễ",
    priceSegment: "459k",
    attributes: "da PU mềm\n22 x 14 cm\nden bong nhe"
  }
};

export const categoryHints = {
  fashion: { short: "Thiết kế gọn gàng, dễ mặc, tôn dáng và giữ cảm giác chỉn chu.", highlights: "Cổ sen phối ren\nForm chữ A tôn dáng\nMặc đi làm hoặc đi chơi", attrs: "vải tex\nS, M, L\nmàu kem", target: "Khách hàng yêu thích sự chỉn chu, thanh lịch hoặc đồ mặc nhà tinh tế..." },
  skincare: { short: "Kết cấu mỏng nhẹ, dễ dùng hằng ngày và phù hợp nhiều routine.", highlights: "Thấm nhanh không bết\nDịu nhẹ cho da nhạy cảm\nDùng sáng và tối", attrs: "Niacinamide, B5\nda khô, da nhạy cảm\nmỏng nhẹ, ráo nhanh", target: "Da khô, da nhạy cảm, người muốn routine tối giản nhưng hiệu quả..." },
  home: { short: "Thiết kế tiện dụng, gọn gàng và phù hợp nhiều không gian sống.", highlights: "Lắp đặt nhanh\nTối ưu góc làm việc\nDễ phối cùng nội thất", attrs: "đa công năng\n32 x 18 x 20 cm\ngỗ phủ melamine", target: "Người ở căn hộ, gia đình trẻ, người thích không gian gọn gàng..." },
  electronics: { short: "Thiết bị gọn, rõ công năng và hữu ích trong nhịp dùng hằng ngày.", highlights: "Kết nối nhanh\nPin ổn định\nDễ thao tác", attrs: "chống ồn, cảm ứng\nBluetooth 5.3\npin 30 giờ", target: "Người đi làm, dân công nghệ, người thích setup gọn..." },
  food: { short: "Hương vị dễ dùng, tiện mang theo và rõ thành phần.", highlights: "Giòn nhẹ dễ ăn\nNgọt vừa\nTiện mang đi", attrs: "yến mạch, hạnh nhân\nvị cacao\nhũ 300g", target: "Dân văn phòng, người thích đồ ăn nhẹ lành mạnh, người bận rộn..." },
  footwear: { short: "Form giày gọn, dễ đi và hoàn thiện outfit rõ hơn.", highlights: "Đế êm\nÔm chân vừa\nDễ phối đồ", attrs: "da tổng hợp / canvas\n36-39\ntrắng kem", target: "Người ưu tiên độ êm chân và tính ứng dụng hằng ngày..." },
  bags: { short: "Thiết kế gọn, sang và dễ phối cùng nhiều outfit thường ngày.", highlights: "Form túi đứng dáng\nNgăn chứa vừa đủ\nĐeo vai nhẹ", attrs: "da PU mềm\n22 x 14 cm\nden bong nhe", target: "Người thích phụ kiện gọn, chỉn chu và dễ mang theo..." },
  accessories: { short: "Điểm nhấn nhỏ nhưng đủ nâng tổng thể trang phục gọn và có gu hơn.", highlights: "Hoàn thiện outfit\nDễ phối màu\nNhìn tinh tế hơn", attrs: "kim loại mạ / vải\nfree size\nbe / den", target: "Người thích hoàn thiện outfit bằng những chi tiết tinh tế..." },
  fragrance: { short: "Mùi hương tinh gọn, dễ tạo thiện cảm và phù hợp nhiều ngữ cảnh dùng.", highlights: "Mood sạch hiện đại\nDùng đi làm hoặc đi chơi\nLưu hương dễ chịu", attrs: "hương hoa gỗ\n50ml\nđộ lưu hương 6-8h", target: "Người thích mùi hương sạch, hiện đại và dễ dùng hằng ngày..." },
  pet: { short: "Sản phẩm tiện dụng, an tâm và phù hợp nhu cầu chăm sóc thú cưng hằng ngày.", highlights: "An toàn khi dùng\nDễ vệ sinh\nTiện cho lịch sinh hoạt", attrs: "cho chó mèo nhỏ\nvải mềm / thành phần rõ ràng\ndễ vệ sinh", target: "Người nuôi tìm giải pháp an toàn, gọn và đáng tin cho thú cưng..." },
  sports: { short: "Thiết kế thực dụng, bền và tạo cảm giác sẵn sàng cho nhịp vận động.", highlights: "Cầm nắm chắc\nĐộ bền tốt\nDễ mang theo", attrs: "vải co giãn / nhựa bền\nfree size / 750ml\nphù hợp gym, yoga, chạy bộ", target: "Người tập luyện thường xuyên, ưu tiên độ bền và sự tiện dụng..." },
  other: { short: "Sản phẩm có điểm khác biệt rõ ràng, dễ hiểu và dễ tạo thiện cảm.", highlights: "Điểm mạnh rõ\nDễ dùng\nGiá trị thực tế", attrs: "đặc điểm nổi bật\nkích thước cơ bản\nưu điểm chính", target: "Người cần một sản phẩm rõ công năng, dễ dùng, dễ cân nhắc mua..." }
};
