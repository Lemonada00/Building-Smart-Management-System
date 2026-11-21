import Link from "next/link";
export function AdminDenied() {
  return (
    <section className="wo-empty">
      <h1>当前身份无法访问管理员工作台</h1>
      <p>请使用当前项目管理员身份登录，或返回可访问的页面。</p>
      <Link className="wo-return" href="/assistant">
        返回智能助手
      </Link>
    </section>
  );
}
