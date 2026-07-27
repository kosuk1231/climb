import "./globals.css";

export const metadata = {
  title: "2026 서울사회복지사 등반대회 단체신청",
  description: "9월 12일(토) 서대문 안산 · 참가자를 등록하면 카카오 알림톡이 발송됩니다.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
