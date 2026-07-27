/** @type {import('next').NextConfig} */
const nextConfig = {
  // googleapis, solapi는 서버(Node)에서만 실행되므로 번들에서 제외합니다.
  serverExternalPackages: ["googleapis", "solapi"],
  // 메인 경로("/")는 안내 페이지(public/event.html)로 연결합니다.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/event.html" }],
    };
  },
};

export default nextConfig;
