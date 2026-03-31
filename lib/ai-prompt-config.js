export const aiCategoryNotes = {
  fashion: "Với thời trang, ưu tiên cảm giác mặc lên người, form dáng, độ rơi của chất liệu, màu sắc và độ hoàn thiện của tổng thể outfit. Có thể dùng bullet catalog nếu phù hợp.",
  skincare: "Với skincare, ưu tiên kết cấu, độ thấm, cảm giác trên da, thành phần chính và trải nghiệm sau khi dùng. Tránh văn điều trị hay hứa hẹn quá mức.",
  home: "Với gia dụng, ưu tiên công năng thực tế, độ tiện lợi, chất liệu và cách sản phẩm hòa vào nhịp sống hằng ngày.",
  electronics: "Với điện tử, chuyển tính năng thành trải nghiệm dùng thực tế. Tránh chỉ liệt kê thông số khô cứng.",
  food: "Với thực phẩm, gợi hương vị, cảm giác thưởng thức, quy cách và độ tiện khi dùng hằng ngày.",
  footwear: "Với giày dép, ưu tiên cảm giác lên chân, độ êm, độ gọn và cách đôi giày hoàn thiện tổng thể outfit.",
  bags: "Với túi xách hoặc ví, ưu tiên form túi, chất liệu, độ gọn, ngăn chứa và cảm giác mang theo hằng ngày.",
  accessories: "Với phụ kiện, ưu tiên chi tiết thiết kế, độ tinh tế và vai trò hoàn thiện diện mạo.",
  fragrance: "Với nước hoa và hương thơm, ưu tiên mood, cá tính, nhóm hương và ấn tượng lưu lại hơn là liệt kê khô cứng.",
  pet: "Với sản phẩm thú cưng, ưu tiên độ an tâm, độ phù hợp và lợi ích rõ ràng cho cả thú cưng lẫn người nuôi.",
  sports: "Với thể thao/fitness, ưu tiên cảm giác vận động, độ linh hoạt, độ bền và công năng thực tế trong quá trình tập luyện.",
  motherBaby: "Với mẹ và bé, ưu tiên an toàn chất liệu, tính vệ sinh, độ phù hợp theo độ tuổi và sự an tâm trong sử dụng hằng ngày.",
  healthCare: "Với sản phẩm sức khỏe, ưu tiên ngôn ngữ rõ ràng, thực tế, tránh hứa hẹn điều trị. Tập trung vào hỗ trợ theo dõi/chăm sóc tại nhà.",
  booksStationery: "Với sách và văn phòng phẩm, ưu tiên trải nghiệm đọc/viết, bố cục tiện dụng và giá trị dùng đều đặn mỗi ngày.",
  toysGames: "Với đồ chơi và trò chơi, ưu tiên độ phù hợp độ tuổi, tính an toàn, mức tương tác và giá trị giải trí/giáo dục thực tế.",
  autoMoto: "Với ô tô/xe máy/xe đạp, ưu tiên độ tương thích lắp đặt, độ bền, độ ổn định khi di chuyển và tính an toàn sử dụng.",
  phoneTablet: "Với điện thoại/tablet, chuyển thông số thành lợi ích thực tế: màn hình, pin, độ mượt, và sự tiện trong sinh hoạt hằng ngày.",
  computerOffice: "Với máy tính và thiết bị văn phòng, ưu tiên hiệu quả công việc, độ ổn định kết nối và khả năng tương thích hệ sinh thái.",
  cameraDrone: "Với camera/drone, ưu tiên chất lượng ghi hình, độ ổn định, và tính tiện dụng trong bối cảnh quay/chụp thực tế.",
  homeAppliances: "Với điện gia dụng, ưu tiên bối cảnh sử dụng thật trong gia đình: tiết kiệm thời gian, dễ thao tác, dễ vệ sinh.",
  toolsHardware: "Với dụng cụ/cải tạo nhà, ưu tiên độ bền, hiệu năng thực tế, tính an toàn khi thao tác và giá trị sử dụng dài hạn.",
  other: "Luôn ưu tiên giá trị thực, trải nghiệm dùng và sự chỉn chu trong câu chữ."
};

export const aiCategoryQualityRules = {
  fashion: {
    good: "Câu chữ phải gợi được cảm giác nhìn bằng mắt và cảm giác mặc trên người: bề mặt vải, độ rơi, độ gọn, độ nữ tính hoặc sắc nét của tổng thể. Nếu là catalog, phần bullet phải sạch, có gu, không rao hàng rẻ tiền.",
    avoid: "Tránh các từ sáo như siêu xinh, cực phẩm, must-have, sang chảnh, hot trend nếu không có chi tiết nâng đỡ. Tránh biến mô tả thành văn sale chợ."
  },
  skincare: {
    good: "Câu chữ phải gợi được kết cấu, độ thấm, độ êm, độ ráo, cảm giác trên da và bối cảnh dùng trong routine hằng ngày. Thành phần nên được đặt trong ngữ cảnh lợi ích thực tế.",
    avoid: "Tránh ngôn ngữ điều trị, cam kết tuyệt đối, hoặc văn bác sĩ/phác đồ. Không được nghe như claim y khoa."
  },
  home: {
    good: "Câu chữ phải đặt sản phẩm vào đời sống thật: bàn làm việc, căn hộ, góc bếp, phòng ngủ, sự gọn gàng và tiện dụng hằng ngày.",
    avoid: "Tránh văn liệt kê khô khan hoặc nói quá chung chung kiểu đa năng, tiện lợi mà không nói tiện ở đâu, dùng thế nào."
  },
  electronics: {
    good: "Biến thông số thành trải nghiệm: đeo êm ra sao, pin lâu giúp gì, kết nối ổn định mang lại cảm giác gì trong dùng hằng ngày.",
    avoid: "Tránh đọc như bảng spec. Tránh slogan công nghệ rỗng như hiệu năng vượt trội nếu không có ngữ cảnh dùng."
  },
  food: {
    good: "Câu chữ nên gợi vị, độ giòn/mềm, hậu vị, độ tiện khi mang theo hoặc dùng trong ngày. Nếu healthy thì phải nghe sạch và dễ tin.",
    avoid: "Tránh phóng đại hương vị không có căn cứ hoặc lặp từ ngon một cách vô nghĩa."
  },
  footwear: {
    good: "Câu chữ nên gợi cảm giác lên chân, độ êm, độ vững, khả năng hoàn thiện outfit và bối cảnh đi lại thực tế.",
    avoid: "Tránh chỉ khen đẹp mà không nói form hoặc cảm giác mang."
  },
  bags: {
    good: "Câu chữ nên cho thấy form túi, độ gọn, sức chứa, cảm giác mang lên người và sự chỉn chu của tổng thể.",
    avoid: "Tránh khen sang một cách rỗng, không mô tả dáng túi hoặc trải nghiệm sử dụng."
  },
  accessories: {
    good: "Phải cho thấy phụ kiện đóng vai trò gì trong tổng thể diện mạo: làm outfit gọn hơn, mềm hơn, sắc hơn hay tinh tế hơn.",
    avoid: "Tránh biến phụ kiện thành món đồ vô danh, thiếu cá tính và thiếu ngữ cảnh phối."
  },
  fragrance: {
    good: "Gợi đúng mood mùi hương, bối cảnh dùng và cá tính để lại. Nếu có nốt hương thì phải đọc mềm mại chứ không khô như listing kỹ thuật.",
    avoid: "Tránh lặp note hương đơn thuần hoặc dùng từ quá ảo, quá bay bổng mà không có hình dung cụ thể."
  },
  pet: {
    good: "Đặt trọng tâm vào sự an tâm, độ phù hợp và tiện lợi hằng ngày cho người nuôi lẫn thú cưng.",
    avoid: "Tránh văn quá cảm tính mà thiếu thông tin hữu ích thực tế."
  },
  sports: {
    good: "Câu chữ nên có nhịp chuyển động: linh hoạt, bền, gọn, hữu ích trong lúc tập hoặc mang theo.",
    avoid: "Tránh văn fitness sáo rỗng kiểu bứt phá giới hạn mà không nói được trải nghiệm thật."
  },
  motherBaby: {
    good: "Câu chữ cần tạo cảm giác an tâm: chất liệu an toàn, dễ vệ sinh, phù hợp theo độ tuổi và dễ dùng cho phụ huynh.",
    avoid: "Tránh dùng ngôn ngữ gây sợ hãi hoặc tuyên bố an toàn tuyệt đối không có căn cứ."
  },
  healthCare: {
    good: "Câu chữ nên rõ, mạch lạc, thiên về công năng hỗ trợ theo dõi/chăm sóc thực tế tại nhà.",
    avoid: "Tránh claim điều trị, chẩn đoán hoặc cam kết kết quả tuyệt đối."
  },
  booksStationery: {
    good: "Nêu rõ trải nghiệm dùng: bố cục, chất giấy, cảm giác viết/đọc và tính hữu dụng trong học tập/công việc.",
    avoid: "Tránh văn cảm hứng chung chung mà thiếu giá trị sử dụng cụ thể."
  },
  toysGames: {
    good: "Nhấn vào độ phù hợp độ tuổi, tính tương tác, mức dễ chơi và lợi ích phát triển hoặc kết nối.",
    avoid: "Tránh nói vui/giáo dục một cách chung chung mà không có bối cảnh chơi thực tế."
  },
  autoMoto: {
    good: "Mô tả rõ độ tương thích, độ chắc chắn và hiệu quả sử dụng khi di chuyển thực tế.",
    avoid: "Tránh hứa hẹn quá mức về an toàn hoặc ngôn ngữ khẳng định tuyệt đối."
  },
  phoneTablet: {
    good: "Biến thông số thành trải nghiệm sử dụng hằng ngày: nhìn rõ hơn, pin bền hơn, thao tác mượt hơn.",
    avoid: "Tránh đọc như bảng spec dài hoặc dùng thuật ngữ kỹ thuật dày đặc khó hiểu."
  },
  computerOffice: {
    good: "Câu chữ cần gắn với hiệu suất làm việc: ổn định, tương thích, giảm ma sát thao tác mỗi ngày.",
    avoid: "Tránh buzzword năng suất rỗng mà không có tình huống sử dụng rõ ràng."
  },
  cameraDrone: {
    good: "Nhấn vào kết quả ghi hình thực tế: độ nét, độ ổn định, tính tiện khi quay/chụp và quản lý file.",
    avoid: "Tránh phóng đại chất lượng điện ảnh khi không có mô tả trải nghiệm thực tế đi kèm."
  },
  homeAppliances: {
    good: "Đặt sản phẩm trong nhịp sống gia đình: tiết kiệm thời gian, dễ dùng, dễ vệ sinh và bền trong dùng hằng ngày.",
    avoid: "Tránh nói tiện lợi chung chung mà không chỉ ra tiện ở bước nào trong quy trình dùng."
  },
  toolsHardware: {
    good: "Mô tả thực dụng: lực, độ bền, độ ổn định thao tác và độ tin cậy khi sửa chữa/lắp đặt.",
    avoid: "Tránh nói kiểu chuyên nghiệp tuyệt đối hoặc khuyến khích thao tác thiếu an toàn."
  },
  other: {
    good: "Luôn cố gắng biến mô tả thành trải nghiệm dễ hình dung và đáng tin, không chỉ là lời khen chung chung.",
    avoid: "Tránh câu rỗng, lặp ý và khen không có chi tiết cụ thể."
  }
};
