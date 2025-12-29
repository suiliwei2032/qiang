import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      // 监听 js 和 css 文件夹的变化
      include: ['js/**', 'css/**', 'src/**'],
    },
    hmr: {
      overlay: true
    }
  },
  // 确保 js 文件夹被包含在构建中
  publicDir: false,
});
