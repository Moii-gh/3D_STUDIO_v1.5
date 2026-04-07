<div align="center">

# 🧊 3D_STUDIO_v1.5
### A Powerful, Web-Based 3D Visualizer & Studio Environment

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com/)

---

 **3D_STUDIO** — это современная веб-студия для создания и редактирования 3D-сцен прямо в браузере. Разработанная с упором на производительность и эстетику, она сочетает в себе мощь Three.js и гибкость React.

[**🏢 GitHub Repository**](https://github.com/Moii-gh/3D_STUDIO_v1.5)

</div>

---

## 💎 ГЛАВНЫЕ ФИШКИ

### 🛠 Мощный Инструментарий
*   **20+ Примитивов:** От кубов и сфер до звезд, сердец и процедурного текста.
*   **Умная Манипуляция:** Перемещение (Move), Поворот (Rotate), Масштабирование (Scale) с помощью Gizmo-контроллеров.
*   **Snap-to-Grid:** Идеальное выравнивание объектов по сетке одним кликом.
*   **Marquee Selection:** Выделение сразу нескольких объектов "рамкой", как в профессиональных CAD.

### 📁 Профессиональное Управление
*   **Группировка одним кликом:** Объединяйте объекты в иерархические группы (Ctrl+G).
*   **История (Undo/Redo):** Глубокая история действий — до 50 шагов назад.
*   **Проектные файлы:** Сохранение и загрузка целых сцен в формате `.json` с сохранением всей истории правок.

### 🎨 Премиальный UI/UX
*   **Dark-Mode Aesthetics:** Минималистичный интерфейс в стиле киберпанк/брутализм.
*   **Glassmorphism:** Полупрозрачные панели инструментов с эффектом размытия.
*   **Микро-анимации:** Плавные переходы и обратная связь через `framer-motion`.

---

## 🚀 БЫСТРЫЙ СТАРТ

### 1️⃣ Локальный запуск
Убедитесь, что у вас установлен **Node.js**.

```bash
# Клонируйте проект и перейдите в папку
git clone https://github.com/Moii-gh/3D_STUDIO_v1.5
cd 3D_STUDIO_v1.5

# Установите зависимости
npm install

# Запустите в режиме разработки
npm run dev
```

Откройте `http://localhost:3000` в браузере.

### 2️⃣ Сборка
```bash
npm run build
```

---

## 🌐 РАЗВЕРТЫВАНИЕ (RENDER)

Проект полностью настроен для деплоя на **Render.com**. 

1. Создайте новый **Blueprint Service** на Render.
2. Подключите ваш репозиторий.
3. Render автоматически обнаружит `render.yaml` и настроит:
    *   **Environment:** Static Site или Web Service (на ваш выбор).
    *   **Build Command:** `npm install && npm run build`
    *   **Publish Path:** `dist`

---

## 🛠 ТЕХНОЛОГИЧЕСКИЙ СТЕК

| Технология | Назначение |
| :--- | :--- |
| **React 19** | Основа приложения и управление состоянием |
| **Three.js** | 3D движок и рендеринг |
| **R3F / Drei** | Реактивный слой над Three.js |
| **Tailwind 4** | Современная стилистика |
| **Express** | Сервер для обработки роутинга в продакшене |
| **Lucide** | Иконочный пак (Sleek design) |

---

<div align="center">
<br/>
<i>Pushing the boundaries of web-based 3D creation.</i>
</div>
