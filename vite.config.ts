import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 깃허브 페이지는 https://아이디.github.io/저장소이름/ 아래에 올라가므로,
// 어느 주소에서든 동작하도록 상대 경로('./')로 만듭니다.
export default defineConfig({
  base: './',
  plugins: [react()],
});
