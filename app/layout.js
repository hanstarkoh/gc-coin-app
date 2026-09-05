import './globals.css';

export const metadata = {
  title: '금정코인',
  description: '금정청소년수련관 주말 방과후 아카데미 코인 앱',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
