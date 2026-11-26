import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  EmptyState,
  ErrorState,
  Feedback,
  FormField,
  LoadingState,
  PageHeader,
} from "@/components/common";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { repo } from "@/services";
import { currency, errorMessage } from "@/lib/utils";
import { useSession } from "@/stores/session";
import {
  useCatalog,
  useFavorites,
  useMyPreference,
  useMyProfile,
  usePreferenceOptions,
} from "@/hooks/data";
import { DestinationCard, HotelCard } from "./catalog";
import { googleLinkUrl } from "@/services/api/client";
import { QRCodeSVG } from "qrcode.react";
import type { TwoFactorSetup } from "@/types/domain";

const genderLabels: Record<string, string> = {
  FEMALE: "Nữ",
  MALE: "Nam",
  OTHER: "Khác",
  UNDISCLOSED: "Không muốn tiết lộ",
};
const preferenceStyles = [
  { value: "Tiết kiệm", label: "Tiết kiệm" },
  { value: "Cân bằng", label: "Cân bằng" },
  { value: "Thoải mái", label: "Thoải mái" },
  { value: "Nghỉ dưỡng", label: "Nghỉ dưỡng" },
  { value: "CULTURE_AND_FOOD", label: "Văn hóa & ẩm thực" },
];
const preferenceTransports = [
  { value: "Máy bay", label: "Máy bay" },
  { value: "Ô tô", label: "Ô tô" },
  { value: "Tàu hỏa", label: "Tàu hỏa" },
  { value: "Xe máy", label: "Xe máy" },
  { value: "WALKING", label: "Đi bộ" },
];
const includeCurrentOption = (
  options: Array<{ value: string; label: string }>,
  current: string,
) =>
  options.some((option) => option.value === current) || !current
    ? options
    : [{ value: current, label: current }, ...options];
export function ProfilePage() {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const login = useSession((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error } = useMyProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(
    null,
  );
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [twoFactorAction, setTwoFactorAction] = useState<
    "disable" | "regenerate" | null
  >(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error)
    return (
      <div className="container-app section-pad">
        <ErrorState message={errorMessage(error)} />
      </div>
    );

  const beginEdit = () => {
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
    setDateOfBirth(profile?.dateOfBirth ?? "");
    setGender(profile?.gender ?? "");
    setBio(profile?.bio ?? "");
    setEditing(true);
  };

  return (
    <div className="container-app section-pad">
      <PageHeader
        title="Hồ sơ của tôi"
        description="Xem và cập nhật thông tin cá nhân."
      />
      <Card className="max-w-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
          {!editing && (
            <Button size="sm" variant="secondary" onClick={beginEdit}>
              Chỉnh sửa
            </Button>
          )}
        </div>
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                if (name.trim().length < 2)
                  throw new Error("Họ tên cần ít nhất 2 ký tự.");
                const next = await repo.saveProfile(user?.id ?? "", {
                  name: name.trim(),
                  phone: phone.trim() || null,
                  dateOfBirth: dateOfBirth || null,
                  gender: gender
                    ? (gender as "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED")
                    : null,
                  bio: bio.trim() || null,
                });
                login(next);
                await queryClient.invalidateQueries({
                  queryKey: ["my-profile", user?.id],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["tourist", user?.id],
                });
                setEditing(false);
                setMessage("Đã cập nhật hồ sơ.");
              } catch (saveError) {
                setMessage(errorMessage(saveError));
              }
            }}
          >
            <FormField label="Họ tên">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={150}
              />
            </FormField>
            <FormField label="Số điện thoại">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="+84901234567"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ngày sinh">
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </FormField>
              <FormField label="Giới tính">
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Chưa chọn</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="MALE">Nam</option>
                  <option value="OTHER">Khác</option>
                  <option value="UNDISCLOSED">Không muốn tiết lộ</option>
                </select>
              </FormField>
            </div>
            <FormField label="Giới thiệu bản thân" hint="Tối đa 1000 ký tự">
              <textarea
                rows={4}
                maxLength={1000}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </FormField>
            <Feedback
              message={message}
              kind={message.includes("Đã") ? "success" : "error"}
            />
            <div className="flex gap-2">
              <Button>Lưu thay đổi</Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditing(false);
                  setMessage("");
                }}
              >
                Hủy
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Họ tên</dt>
              <dd className="font-medium">
                {profile?.name || "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium">{profile?.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Số điện thoại</dt>
              <dd className="font-medium">
                {profile?.phone || "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày sinh</dt>
              <dd className="font-medium">
                {profile?.dateOfBirth || "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Giới tính</dt>
              <dd className="font-medium">
                {genderLabels[profile?.gender ?? ""] || "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Giới thiệu bản thân</dt>
              <dd className="whitespace-pre-wrap font-medium">
                {profile?.bio || "Chưa cập nhật"}
              </dd>
            </div>
            {profile?.deletionRequestedAt && (
              <div className="text-amber-800">
                Đã gửi yêu cầu xóa tài khoản.
              </div>
            )}
            <Feedback message={message} kind="success" />
          </dl>
        )}
      </Card>
      <Card className="mt-6 max-w-2xl p-6">
        <h2 className="text-lg font-semibold">
          Bảo mật và phương thức đăng nhập
        </h2>
        {searchParams.get("googleLinked") === "1" && (
          <Feedback message="Đã liên kết tài khoản Google." kind="success" />
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">Tài khoản Google</p>
            <p className="text-sm text-slate-500">
              {profile?.googleAccountLinked ? "Đã liên kết" : "Chưa liên kết"}
            </p>
          </div>
          {profile?.googleAccountLinked ? (
            <span className="text-sm font-semibold text-emerald-700">
              Đã liên kết
            </span>
          ) : (
            <Button asChild variant="secondary">
              <a href={googleLinkUrl("/profile?googleLinked=1")}>
                Liên kết Google
              </a>
            </Button>
          )}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                Xác thực 2 bước (2FA)
              </p>
              <p className="text-sm text-slate-500">
                {user?.isTwoFactorEnabled
                  ? "Đang bật bằng ứng dụng xác thực"
                  : "Bảo vệ tài khoản bằng mã TOTP và mã khôi phục"}
              </p>
            </div>
            {user?.isTwoFactorEnabled ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTwoFactorAction("regenerate");
                    setTwoFactorCode("");
                    setSecurityMessage("");
                  }}
                >
                  Tạo lại mã khôi phục
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setTwoFactorAction("disable");
                    setTwoFactorCode("");
                    setSecurityMessage("");
                  }}
                >
                  Tắt 2FA
                </Button>
              </div>
            ) : (
              <Button
                disabled={securityBusy}
                onClick={async () => {
                  setSecurityBusy(true);
                  setSecurityMessage("");
                  setRecoveryCodes([]);
                  try {
                    setTwoFactorSetup(await repo.setupTwoFactor());
                  } catch (cause) {
                    setSecurityMessage(errorMessage(cause));
                  } finally {
                    setSecurityBusy(false);
                  }
                }}
              >
                Bật xác thực 2 bước
              </Button>
            )}
          </div>

          {twoFactorSetup && (
            <div className="mt-5 grid gap-5 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr]">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG
                  value={twoFactorSetup.otpauthUri}
                  size={176}
                  role="img"
                  aria-label="Mã QR thiết lập xác thực 2 bước"
                />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Quét mã bằng ứng dụng xác thực
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Nếu không quét được, nhập khóa thủ công:
                </p>
                <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-sm font-semibold">
                  {twoFactorSetup.secret}
                </code>
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSecurityBusy(true);
                    setSecurityMessage("");
                    try {
                      const result = await repo.confirmTwoFactor(twoFactorCode);
                      setRecoveryCodes(result.recoveryCodes);
                      setTwoFactorSetup(null);
                      setTwoFactorCode("");
                      if (user) login({ ...user, isTwoFactorEnabled: true });
                      await queryClient.invalidateQueries({
                        queryKey: ["my-profile", user?.id],
                      });
                    } catch (cause) {
                      setSecurityMessage(errorMessage(cause));
                    } finally {
                      setSecurityBusy(false);
                    }
                  }}
                >
                  <FormField label="Mã xác thực">
                    <input
                      value={twoFactorCode}
                      onChange={(event) =>
                        setTwoFactorCode(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button disabled={securityBusy}>Xác nhận bật 2FA</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setTwoFactorSetup(null);
                        setTwoFactorCode("");
                      }}
                    >
                      Hủy
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {twoFactorAction && (
            <form
              className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setSecurityBusy(true);
                setSecurityMessage("");
                try {
                  if (twoFactorAction === "disable") {
                    await repo.disableTwoFactor(twoFactorCode);
                    if (user) login({ ...user, isTwoFactorEnabled: false });
                    setSecurityMessage("Đã tắt xác thực 2 bước.");
                  } else {
                    const result =
                      await repo.regenerateTwoFactorRecoveryCodes(
                        twoFactorCode,
                      );
                    setRecoveryCodes(result.recoveryCodes);
                  }
                  setTwoFactorAction(null);
                  setTwoFactorCode("");
                  await queryClient.invalidateQueries({
                    queryKey: ["my-profile", user?.id],
                  });
                } catch (cause) {
                  setSecurityMessage(errorMessage(cause));
                } finally {
                  setSecurityBusy(false);
                }
              }}
            >
              <p className="text-sm font-medium text-slate-800">
                Nhập mã từ ứng dụng xác thực hoặc mã khôi phục để{" "}
                {twoFactorAction === "disable"
                  ? "tắt 2FA"
                  : "tạo bộ mã khôi phục mới"}
                .
              </p>
              <FormField label="Mã xác thực hoặc mã khôi phục">
                <input
                  value={twoFactorCode}
                  onChange={(event) =>
                    setTwoFactorCode(
                      event.target.value.toUpperCase().slice(0, 9),
                    )
                  }
                  autoComplete="one-time-code"
                  required
                />
              </FormField>
              <div className="flex gap-2">
                <Button disabled={securityBusy}>
                  {twoFactorAction === "disable"
                    ? "Xác nhận tắt 2FA"
                    : "Tạo mã mới"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTwoFactorAction(null)}
                >
                  Hủy
                </Button>
              </div>
            </form>
          )}

          {recoveryCodes.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">Lưu mã khôi phục</h3>
              <p className="mt-1 text-sm text-amber-900">
                Các mã này chỉ hiển thị một lần. Mỗi mã chỉ dùng được một lần.
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm font-semibold text-amber-950 sm:grid-cols-4">
                {recoveryCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          )}
          <Feedback
            message={securityMessage}
            kind={securityMessage.startsWith("Đã") ? "success" : "error"}
          />
        </div>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link to="/preferences">Sở thích du lịch</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/bookings">Booking của tôi</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/trips">Chuyến đi</Link>
        </Button>
      </div>
      <div className="mt-10 max-w-2xl border-t border-slate-200 pt-6">
        <h2 className="font-semibold text-slate-900">Yêu cầu xóa tài khoản</h2>
        <p className="mt-2 text-sm text-slate-500">
          Yêu cầu sẽ được ghi nhận và xác minh trước khi xử lý xóa tài khoản.
        </p>
        <Button
          className="mt-4"
          variant="danger"
          onClick={() => setDeleteOpen(true)}
        >
          Gửi yêu cầu xóa
        </Button>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="Xác nhận yêu cầu xóa tài khoản"
          description="Nhập mật khẩu để xác thực yêu cầu."
        >
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await repo.requestDeletion(user?.id ?? "", password);
                setDeleteOpen(false);
                logout();
                navigate("/");
              } catch (requestError) {
                setMessage(errorMessage(requestError));
              }
            }}
          >
            <FormField label="Mật khẩu">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </FormField>
            <Feedback message={message} kind="error" />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
              >
                Hủy
              </Button>
              <Button variant="danger">Gửi yêu cầu</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function PreferencesPage() {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useMyPreference();
  const options = usePreferenceOptions();
  const [edit, setEdit] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [budget, setBudget] = useState(6000000);
  const [style, setStyle] = useState("Cân bằng");
  const [transport, setTransport] = useState("Máy bay");
  const [destinations, setDestinations] = useState("");
  const [message, setMessage] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const startEdit = () => {
    setSelectedCategories(
      (data?.preference?.categories ?? []).map((item) => item.code),
    );
    setSelectedTopics(
      (data?.preference?.topics ?? []).map((item) => item.code),
    );
    setBudget(data?.preference?.budget ?? 6000000);
    setStyle(data?.preference?.style ?? "Cân bằng");
    setTransport(data?.preference?.transport ?? "Máy bay");
    setDestinations((data?.preference?.destinations ?? []).join(", "));
    setMessage("");
    setEdit(true);
  };
  const toggle = (
    code: string,
    selected: string[],
    update: (values: string[]) => void,
  ) => {
    update(
      selected.includes(code)
        ? selected.filter((value) => value !== code)
        : [...selected, code],
    );
  };
  if (isLoading || options.isLoading) return <LoadingState />;
  if (error || options.error)
    return (
      <div className="container-app section-pad">
        <ErrorState message={errorMessage(error ?? options.error)} />
      </div>
    );
  const preference = data?.preference;
  const availableCategories = options.data?.categories ?? [];
  const availableTopics = options.data?.topics ?? [];
  const preferenceCategories = preference?.categories ?? [];
  const preferenceTopics = preference?.topics ?? [];
  const preferenceDestinations = preference?.destinations ?? [];
  return (
    <div className="container-app section-pad">
      <PageHeader
        title="Sở thích du lịch"
        description="Chọn loại địa điểm và chủ đề đang có trong danh mục."
        actions={!edit && <Button onClick={startEdit}>Chỉnh sửa</Button>}
      />
      <Card className="max-w-3xl p-6">
        {edit ? (
          <form
            className="grid gap-5"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await repo.savePreference(user?.id ?? "", {
                  categoryCodes: selectedCategories,
                  topicCodes: selectedTopics,
                  budget,
                  style,
                  transport,
                  destinations: destinations
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                });
                await queryClient.invalidateQueries({
                  queryKey: ["my-preference", user?.id],
                });
                setEdit(false);
                setMessage("Đã lưu sở thích.");
              } catch (cause) {
                setMessage(errorMessage(cause));
              }
            }}
          >
            <fieldset>
              <legend className="mb-3 text-sm font-semibold">
                Loại địa điểm
              </legend>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((item) => (
                  <label
                    key={item.code}
                    className={
                      "cursor-pointer rounded-full border px-3 py-2 text-sm " +
                      (selectedCategories.includes(item.code)
                        ? "border-[#1E3A5F] bg-[#EAF0F6] text-[#1E3A5F]"
                        : "border-slate-200")
                    }
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={selectedCategories.includes(item.code)}
                      onChange={() =>
                        toggle(
                          item.code,
                          selectedCategories,
                          setSelectedCategories,
                        )
                      }
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-semibold">Chủ đề</legend>
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((item) => (
                  <label
                    key={item.code}
                    className={
                      "cursor-pointer rounded-full border px-3 py-2 text-sm " +
                      (selectedTopics.includes(item.code)
                        ? "border-[#1E3A5F] bg-[#EAF0F6] text-[#1E3A5F]"
                        : "border-slate-200")
                    }
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={selectedTopics.includes(item.code)}
                      onChange={() =>
                        toggle(item.code, selectedTopics, setSelectedTopics)
                      }
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ngân sách tham khảo (VND)">
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                />
              </FormField>
              <FormField label="Phong cách">
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                >
                  {includeCurrentOption(preferenceStyles, style).map(
                    (option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>
              <FormField label="Phương tiện">
                <select
                  value={transport}
                  onChange={(event) => setTransport(event.target.value)}
                >
                  {includeCurrentOption(preferenceTransports, transport).map(
                    (option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>
              <FormField
                label="Điểm đến yêu thích"
                hint="Ngăn cách bằng dấu phẩy"
              >
                <input
                  value={destinations}
                  onChange={(event) => setDestinations(event.target.value)}
                />
              </FormField>
            </div>
            <Feedback message={message} kind="error" />
            <div className="flex gap-2">
              <Button>Lưu sở thích</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEdit(false)}
              >
                Hủy
              </Button>
            </div>
          </form>
        ) : preference ? (
          <div className="grid gap-5">
            <div>
              <h2 className="text-sm font-semibold">Loại địa điểm</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {preferenceCategories.map((item) => (
                  <span
                    key={item.code}
                    className="rounded-full bg-[#EAF0F6] px-3 py-1 text-sm text-[#1E3A5F]"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Chủ đề</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {preferenceTopics.map((item) => (
                  <span
                    key={item.code}
                    className="rounded-full bg-[#EAF0F6] px-3 py-1 text-sm text-[#1E3A5F]"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm">
              <strong>Ngân sách:</strong> {currency(preference.budget)}
            </p>
            <p className="text-sm">
              <strong>Phong cách:</strong> {preference.style}
            </p>
            <p className="text-sm">
              <strong>Phương tiện:</strong> {preference.transport}
            </p>
            <p className="text-sm">
              <strong>Điểm đến:</strong>{" "}
              {preferenceDestinations.join(", ") || "Chưa chọn"}
            </p>
            <Feedback message={message} />
            <Button
              variant="danger"
              className="w-fit"
              onClick={() => setClearOpen(true)}
            >
              Xóa toàn bộ sở thích
            </Button>
          </div>
        ) : (
          <EmptyState
            title="Chưa có sở thích"
            description="Thêm vài lựa chọn để nhận gợi ý phù hợp hơn."
            action={<Button onClick={startEdit}>Thêm sở thích</Button>}
          />
        )}
      </Card>
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent
          title="Xóa toàn bộ sở thích?"
          description="Các lựa chọn category và topic sẽ được xóa."
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await repo.clearPreference(user?.id ?? "");
                  await queryClient.invalidateQueries({
                    queryKey: ["my-preference", user?.id],
                  });
                  setClearOpen(false);
                  setMessage("Đã xóa toàn bộ sở thích.");
                } catch (cause) {
                  setMessage(errorMessage(cause));
                }
              }}
            >
              Xóa toàn bộ sở thích
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function FavoritesPage() {
  const { data: favorites, isLoading, error } = useFavorites();
  const { data: catalog } = useCatalog();
  if (isLoading) return <LoadingState />;
  if (error)
    return (
      <div className="container-app section-pad">
        <ErrorState message={errorMessage(error)} />
      </div>
    );
  const destinations =
    catalog?.destinations.filter((item) =>
      favorites?.some(
        (favorite) =>
          favorite.targetType === "PLACE" && favorite.targetId === item.id,
      ),
    ) ?? [];
  const hotels =
    catalog?.hotels.filter((item) =>
      favorites?.some(
        (favorite) =>
          favorite.targetType === "HOTEL" && favorite.targetId === item.id,
      ),
    ) ?? [];
  return (
    <div className="container-app section-pad">
      <PageHeader
        title="Yêu thích"
        description="Những nơi bạn muốn quay lại khi lập kế hoạch."
      />
      {destinations.length + hotels.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((x) => (
            <DestinationCard key={x.id} item={x} />
          ))}
          {hotels.map((x) => (
            <HotelCard
              key={x.id}
              item={x}
              price={Math.min(
                ...(catalog?.rooms
                  .filter((r) => r.hotelId === x.id)
                  .map((r) => r.basePrice) ?? [0]),
              )}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có mục yêu thích"
          description="Khám phá địa điểm hoặc khách sạn rồi nhấn Lưu yêu thích."
          action={
            <Button asChild>
              <Link to="/explore">Khám phá ngay</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
export function RecommendationsPage() {
<<<<<<< feature/tourist-account-preferences-security
  const user = useSession((s) => s.user);
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState("");
  const [usePreference, setUsePreference] = useState(true);
  const [results, setResults] = useState<Awaited<
    ReturnType<typeof repo.recommend>
  > | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const quick = [
    "Du lịch tiết kiệm",
    "Khám phá điểm đến",
    "Du lịch gia đình",
    "Nghỉ dưỡng",
    "Khám phá thiên nhiên",
  ];
  const run = async () => {
    if (!query.trim()) {
      setMessage("Vui lòng mô tả chuyến đi mong muốn.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const items = await repo.recommend(
        query + " " + extra,
        usePreference ? user?.id : undefined,
      );
      setResults(items.filter((item) => item.type !== "restaurant"));
    } catch (error) {
      setMessage(errorMessage(error));
      setResults(null);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="container-app section-pad">
      <PageHeader
        title="Gợi ý du lịch"
        description="Mô tả nhu cầu; công cụ tìm trong danh mục hiện có và giải thích lý do đề xuất."
      />
      <Card className="max-w-4xl p-6">
        <FormField label="Bạn muốn trải nghiệm điều gì?">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ví dụ: Tôi muốn đi Đà Nẵng 3 ngày 2 đêm, thích biển, ẩm thực và những nơi yên tĩnh."
          />
        </FormField>
        <div className="mt-3 flex flex-wrap gap-2">
          {quick.map((x) => (
            <Button
              key={x}
              size="sm"
              variant="secondary"
              onClick={() =>
                setQuery(query ? query + ", " + x.toLowerCase() : x)
              }
            >
              {x}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <FormField
            label="Tiêu chí bổ sung"
            hint="Có thể bổ sung sau khi xem kết quả mà không cần nhập lại."
          >
            <input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Ví dụ: khách sạn gần biển"
            />
          </FormField>
          <Button className="self-end" disabled={loading} onClick={run}>
            {loading ? "Đang tìm..." : "Nhận gợi ý"}
          </Button>
        </div>
        {user?.role === "tourist" && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input
              className="!m-0 !h-4 !w-4 !min-h-0"
              type="checkbox"
              checked={usePreference}
              onChange={(e) => setUsePreference(e.target.checked)}
            />
            Sử dụng sở thích đã lưu
          </label>
        )}
        <div className="mt-4">
          <Feedback message={message} kind="error" />
        </div>
      </Card>
      {loading && (
        <LoadingState label="Đang tìm kết quả phù hợp trong danh mục..." />
      )}
      {results && (
        <div className="mt-9">
          <p className="mb-4 text-sm text-amber-800">
            Gợi ý theo quy tắc lọc/chấm điểm; không phải AI thật.
          </p>
          {results.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((x) => (
                <Card className="p-5" key={x.type + x.id}>
                  <span className="text-xs font-semibold uppercase text-[#1E3A5F]">
                    {x.type === "hotel" ? "Khách sạn" : "Địa điểm"}
                  </span>
                  <h2 className="mt-2 text-lg font-semibold">{x.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {x.city} · {currency(x.price)}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">{x.reason}</p>
                  <div className="mt-4">
                    <Link
                      className="text-sm font-semibold text-[#1E3A5F] hover:underline"
                      to={
                        x.type === "hotel"
                          ? "/hotels/" + x.id
                          : "/explore/" + x.id
                      }
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có kết quả phù hợp"
              description="Thử thay đổi điểm đến hoặc sở thích."
            />
          )}
        </div>
      )}
    </div>
  );
=======
  const user = useSession(s => s.user)
  const [query, setQuery] = useState('')
  const [extra, setExtra] = useState('')
  const [usePreference, setUsePreference] = useState(true)
  const [results, setResults] = useState<Awaited<ReturnType<typeof repo.recommend>> | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const quick = ['Du lịch tiết kiệm', 'Khám phá điểm đến', 'Du lịch gia đình', 'Nghỉ dưỡng', 'Khám phá thiên nhiên']
  const navigate = useNavigate()
  const run = async () => {
    if (!isMock && !user) { navigate('/dang-nhap?returnTo=' + encodeURIComponent('/ai/recommendations')); return }
    if (!isMock && user?.role !== 'tourist') { setMessage('Vui lòng dùng tài khoản du khách để nhận gợi ý.'); return }
    if (!query.trim()) { setMessage('Vui lòng mô tả chuyến đi mong muốn.'); return } setLoading(true); setMessage(''); try { const items = await repo.recommend(query + ' ' + extra, usePreference ? user?.id : undefined); setResults(items.filter(item => item.type !== 'restaurant')) } catch (error) { setMessage(errorMessage(error)); setResults(null) } finally { setLoading(false) } }
  return <div className="container-app section-pad"><PageHeader title="Gợi ý du lịch" description="Mô tả nhu cầu; công cụ tìm trong danh mục hiện có và giải thích lý do đề xuất." /><Card className="max-w-4xl p-6"><FormField label="Bạn muốn trải nghiệm điều gì?"><textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Ví dụ: Tôi muốn đi Đà Nẵng 3 ngày 2 đêm, thích biển, ẩm thực và những nơi yên tĩnh." /></FormField><div className="mt-3 flex flex-wrap gap-2">{quick.map(x => <Button key={x} size="sm" variant="secondary" onClick={() => setQuery(query ? query + ', ' + x.toLowerCase() : x)}>{x}</Button>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"><FormField label="Tiêu chí bổ sung" hint="Có thể bổ sung sau khi xem kết quả mà không cần nhập lại."><input value={extra} onChange={e => setExtra(e.target.value)} placeholder="Ví dụ: khách sạn gần biển" /></FormField><Button className="self-end" disabled={loading} onClick={run}>{loading ? 'Đang tìm...' : 'Nhận gợi ý'}</Button></div>{user?.role === 'tourist' && <label className="mt-4 flex items-center gap-2 text-sm text-slate-600"><input className="!m-0 !h-4 !w-4 !min-h-0" type="checkbox" checked={usePreference} onChange={e => setUsePreference(e.target.checked)} />Sử dụng sở thích đã lưu</label>}<div className="mt-4"><Feedback message={message} kind="error" /></div></Card>{loading && <LoadingState label="Đang tìm kết quả phù hợp trong danh mục..." />}{results && <div className="mt-9">{isMock && <p className="mb-4 text-sm text-amber-800">Gợi ý dùng dữ liệu minh họa.</p>}{results.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.map(x => <Card className="p-5" key={x.type + x.id}><span className="text-xs font-semibold uppercase text-[#1E3A5F]">{x.type === 'hotel' ? 'Khách sạn' : 'Địa điểm'}</span><h2 className="mt-2 text-lg font-semibold">{x.name}</h2><p className="mt-1 text-sm text-slate-500">{x.city}{x.price !== null && <> · {currency(x.price)}</>}</p><p className="mt-3 text-sm text-slate-600">{x.reason}</p><div className="mt-4"><Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to={x.type === 'hotel' ? '/hotels/' + x.id : '/explore/' + x.id}>Xem chi tiết →</Link></div></Card>)}</div> : <EmptyState title="Chưa có kết quả phù hợp" description="Thử thay đổi điểm đến hoặc sở thích." />}</div>}</div>
>>>>>>> dev
}
