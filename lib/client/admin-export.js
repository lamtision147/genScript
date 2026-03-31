function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildAdminUsersCsv(users = []) {
  const header = [
    "email",
    "ten",
    "vaiTro",
    "ngayTao",
    "soLuongLichSu",
    "soLuongYeuThich",
    "lanHoatDongGanNhat"
  ];

  const rows = users.map((user) => [
    user.email,
    user.name,
    user.isAdmin ? "admin" : "user",
    user.createdAt,
    user.historyCount,
    user.favoriteCount,
    user.lastActivity
  ]);

  return [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
}
