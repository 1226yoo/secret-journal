/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // [핵심] Tailwind가 스타일을 적용할 파일들의 경로입니다.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // src 폴더 안의 모든 파일을 감시
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
