export default function manifest() {
  return {
    name: '금정코인',
    short_name: '금정코인',
    description: '금정청소년수련관 주말 방과후 아카데미 코인 앱',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F6F0',
    theme_color: '#16324F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
