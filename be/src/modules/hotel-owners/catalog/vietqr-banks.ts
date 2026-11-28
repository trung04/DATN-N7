// Bank identifiers from the VietQR Bank API. Match whole names or codes only.
const bankIdentifiers = [
  ["970415", "ICB", "VietinBank", "Ngân hàng TMCP Công thương Việt Nam"],
  ["970436", "VCB", "Vietcombank", "Ngân hàng TMCP Ngoại Thương Việt Nam"],
  ["970418", "BIDV", "BIDV", "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam"],
  ["970405", "VBA", "Agribank", "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam"],
  ["970448", "OCB", "OCB", "Ngân hàng TMCP Phương Đông"],
  ["970422", "MB", "MBBank", "Ngân hàng TMCP Quân đội"],
  ["970407", "TCB", "Techcombank", "Ngân hàng TMCP Kỹ thương Việt Nam"],
  ["970416", "ACB", "ACB", "Ngân hàng TMCP Á Châu"],
  ["970432", "VPB", "VPBank", "Ngân hàng TMCP Việt Nam Thịnh Vượng"],
  ["970423", "TPB", "TPBank", "Ngân hàng TMCP Tiên Phong"],
  ["970403", "STB", "Sacombank", "Ngân hàng TMCP Sài Gòn Tài Lộc"],
  ["970437", "HDB", "HDBank", "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh"],
  ["970454", "VCCB", "VietCapitalBank", "Ngân hàng TMCP Bản Việt"],
  ["970429", "SCB", "SCB", "Ngân hàng TMCP Sài Gòn"],
  ["970441", "VIB", "VIB", "Ngân hàng TMCP Quốc tế Việt Nam"],
  ["970443", "SHB", "SHB", "Ngân hàng TMCP Sài Gòn - Hà Nội"],
  ["970431", "EIB", "Eximbank", "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam"],
  ["970426", "MSB", "MSB", "Ngân hàng TMCP Hàng Hải"],
  ["546034", "CAKE", "CAKE", "TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank"],
  ["546035", "Ubank", "Ubank", "TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank"],
  ["963388", "TIMO", "Timo", "Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)"],
  ["970400", "SGICB", "SaigonBank", "Ngân hàng TMCP Sài Gòn Công Thương"],
  ["970409", "BAB", "BacABank", "Ngân hàng TMCP Bắc Á"],
  ["971133", "PVDB", "PVcomBank Pay", "Ngân hàng số PVcomBank"],
  ["971025", "momo", "MoMo", "CTCP Dịch Vụ Di Động Trực Tuyến"],
  ["970412", "PVCB", "PVcomBank", "Ngân hàng TMCP Đại Chúng Việt Nam"],
  ["970414", "MBV", "MBV", "Ngân hàng TNHH MTV Việt Nam Hiện Đại"],
  ["970419", "NCB", "NCB", "Ngân hàng TMCP Quốc Dân"],
  ["970424", "SHBVN", "ShinhanBank", "Ngân hàng TNHH MTV Shinhan Việt Nam"],
  ["970425", "ABB", "ABBANK", "Ngân hàng TMCP An Bình"],
  ["970427", "VAB", "VietABank", "Ngân hàng TMCP Việt Á"],
  ["970428", "NAB", "NamABank", "Ngân hàng TMCP Nam Á"],
  ["970430", "PGB", "PGBank", "Ngân hàng TMCP Thịnh vượng và Phát triển"],
  ["970433", "VIETBANK", "VietBank", "Ngân hàng TMCP Việt Nam Thương Tín"],
  ["970438", "BVB", "BaoVietBank", "Ngân hàng TMCP Bảo Việt"],
  ["970440", "SEAB", "SeABank", "Ngân hàng TMCP Đông Nam Á"],
  ["970446", "COOPBANK", "COOPBANK", "Ngân hàng Hợp tác xã Việt Nam"],
  ["970449", "LPB", "LPBank", "Ngân hàng TMCP Lộc Phát Việt Nam"],
  ["970452", "KLB", "KienLongBank", "Ngân hàng TMCP Kiên Long"],
  ["668888", "KBank", "KBank", "Ngân hàng Đại chúng TNHH Kasikornbank"],
  ["971101", "ZALOPAY", "ZaloPay", "Ví điện tử ZaloPay"],
  ["971032", "MVAS", "MVAS", "Trung tâm Dịch vụ số Mobifone – Chi nhánh Tổng Công ty viễn thông Mobifone"],
  ["970434", "IVB", "IndovinaBank", "Ngân hàng TNHH Indovina"],
  ["422589", "CIMB", "CIMB", "Ngân hàng TNHH MTV CIMB Việt Nam"],
  ["970444", "CBB", "CBBank", "Ngân hàng Thương mại trách nhiệm hữu hạn một thành viên Ngoại thương Công nghệ số (Vietcombank Neo Limited)"],
  ["970457", "WVN", "Woori", "Ngân hàng TNHH MTV Woori Việt Nam"],
  ["970462", "KBHN", "KookminHN", "Ngân hàng Kookmin - Chi nhánh Hà Nội"],
  ["970463", "KBHCM", "KookminHCM", "Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh"],
] as const;

const banks = bankIdentifiers.map(([bin, code, shortName, name]) => ({ bin, code, shortName, name }));

export const selectableBanks = banks.filter(({ code }) => !['momo', 'ZALOPAY', 'MVAS'].includes(code))
  .sort((left, right) => left.shortName.localeCompare(right.shortName, 'vi'));

function normalizeBank(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '').replace(/^nganhang/, '');
}

export function resolveBankBin(value: string): string | null {
  const input = normalizeBank(value);
  const matches = banks.filter((bank) => Object.values(bank).some((alias) => normalizeBank(alias) === input));
  return matches.length === 1 ? matches[0].bin : null;
}
