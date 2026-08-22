import { redirect } from "next/navigation";

/**
 * Sổ thợ đã GỘP thành tab 2 của màn "Nhân viên & phân quyền".
 *
 * Route này giữ lại và chuyển hướng chứ không xoá: nó từng là mục sidebar nên
 * studio đã bookmark, và các màn khác (trang chi nhánh, cổng nhân viên) còn liên
 * kết tới nó.
 */
export default function CrewRedirectPage() {
  redirect("/dashboard/studio/staff?tab=crew");
}
