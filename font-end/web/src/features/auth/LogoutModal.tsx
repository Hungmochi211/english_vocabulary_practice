import { ConfirmModal } from '@/components/common/CommonUi';

export function LogoutModal({
  open,
  userName,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  userName: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmModal
      open={open}
      title="Xác nhận đăng xuất?"
      description={`Bạn có chắc muốn đăng xuất khỏi tài khoản ${userName}? Toàn bộ tiến độ học tập, chuỗi Streak và lịch ôn SM-2 vẫn được lưu an toàn.`}
      confirmLabel="Đăng xuất ngay"
      cancelLabel="Hủy"
      danger
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
