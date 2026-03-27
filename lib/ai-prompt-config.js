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
  footwear: {
    good: "Câu chữ phải cho thấy cảm giác lên chân, độ êm, độ cân dáng và tính ứng dụng thực tế trong di chuyển hằng ngày hoặc khi phối outfit.",
    avoid: "Tránh chỉ khen đẹp mà không cho thấy trải nghiệm mang hoặc form giày."
  },
  bags: {
    good: "Câu chữ phải mô tả được form túi, độ gọn, sức chứa và cảm giác hoàn thiện tổng thể trang phục khi mang theo.",
    avoid: "Tránh khen sang trọng một cách rỗng, không mô tả hình khối hoặc công năng."
  },
  accessories: {
    good: "Câu chữ phải cho thấy món phụ kiện tạo điểm nhấn thị giác ra sao và nâng cảm giác outfit như thế nào.",
    avoid: "Tránh biến phụ kiện thành món đồ mờ nhạt, không có vai trò thẩm mỹ rõ ràng."
  },
  fragrance: {
    good: "Câu chữ nên gợi ra mood, bầu không khí và cá tính mà mùi hương để lại, đồng thời giữ nhịp mềm mại và có chất thương hiệu.",
    avoid: "Tránh liệt kê nốt hương khô cứng hoặc viết quá bay bổng mà thiếu hình dung cụ thể."
  },
  pet: {
    good: "Câu chữ nên giúp người nuôi cảm thấy yên tâm, đồng thời cho thấy sản phẩm hữu ích và phù hợp với thú cưng trong sinh hoạt thực tế.",
    avoid: "Tránh nói quá cảm tính mà thiếu thông tin hữu ích hoặc lợi ích cụ thể."
  },
  sports: {
    good: "Câu chữ cần có nhịp chuyển động, tạo cảm giác linh hoạt, bền, gọn và hữu ích trong lúc tập hoặc mang theo.",
    avoid: "Tránh văn fitness sáo rỗng kiểu chinh phục giới hạn mà không nói được trải nghiệm thật."
  },
  other: {
    good: "Luôn cố gắng biến mô tả thành trải nghiệm dễ hình dung và đáng tin, không chỉ là lời khen chung chung.",
    avoid: "Tránh câu rỗng, lặp ý và khen không có chi tiết cụ thể."
  }
};
