const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv').config()
const app = express();
const PORT = process.env.PORT;
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Middleware
app.use(cors()); // Разрешаем запросы с любых доменов
app.use(bodyParser.json()); // Для парсинга JSON в теле запроса


// Инициализация базы данных SQLite с async/await
async function initializeDatabase() {
  return open({
      filename: './avogadro.db',
      driver: sqlite3.Database
  });
}

// Конфиг VK API
const VK_API_VERSION = process.env.VK_API_VERSION;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // Из настроек сообщества
const GROUP_ID = process.env.GROUP_ID; // ID группы (цифры или shortname)

app.get('/', async(req, res)=>{
    try {
        res.json({success: true, data: "Hello worls"})
    } catch (error) {
        console.log(error + "on /")
    }
    
})

// Инициализация приложения
async function initializeApp() {
  const db = await initializeDatabase();

  // Создаем таблицу для заявок, если она не существует
  await db.exec(`CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      course TEXT NOT NULL,
      format TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);


 // Роут для обработки POST запросов с данными формы
 app.post('/api/applications', async (req, res) => {
  try {
      const { fullName, phone, email, course, format } = req.body;

      // Валидация данных
      if (!fullName || !phone || !email || !course || !format) {
          return res.status(400).json({
              success: false,
              message: 'Все поля обязательны для заполнения'
          });
      }

      // Проверка формата email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
          return res.status(400).json({
              success: false,
              message: 'Неверный формат email'
          });
      }

      // Проверка формата телефона
      const phoneRegex = /^(\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
      if (!phoneRegex.test(phone)) {
          return res.status(400).json({
              success: false,
              message: 'Неверный формат телефона. Используйте российский номер'
          });
      }

      // Вставляем данные в базу
      const result = await db.run(
          `INSERT INTO applications (fullName, phone, email, course, format) 
           VALUES (?, ?, ?, ?, ?)`,
          [fullName, phone, email, course, format]
      );

      // Получаем вставленную запись
      const newApplication = await db.get(
          `SELECT * FROM applications WHERE id = ?`,
          [result.lastID]
      );

      res.status(201).json({
          success: true,
          message: 'Заявка успешно создана',
          data: newApplication
      });

  } catch (error) {
      console.error('Ошибка при обработке заявки:', error);
      res.status(500).json({
          success: false,
          message: 'Произошла ошибка при обработке заявки'
      });
  }
});

// Роут для получения всех заявок
app.get('/api/applications', async (req, res) => {
  try {
      const applications = await db.all(
          `SELECT * FROM applications ORDER BY createdAt DESC`
      );
      res.json({
          success: true,
          data: applications
      });
  } catch (error) {
      console.error('Ошибка при получении заявок:', error);
      res.status(500).json({
          success: false,
          message: 'Ошибка при получении заявок'
      });
  }
});

// Роут для удаления всех заявок (только для разработки)
app.delete('/api/applications', async (req, res) => {
  try {
      const result = await db.run(`DELETE FROM applications`);
      res.json({
          success: true,
          message: `Удалено ${result.changes} заявок`
      });
  } catch (error) {
      console.error('Ошибка при удалении заявок:', error);
      res.status(500).json({
          success: false,
          message: 'Ошибка при удалении заявок'
      });
  }
});


// Роут для получения постов
app.get('/api/vk/posts', async (req, res) => {
  try {
    const count = req.query.count || 10; // Число постов (можно передать ?count=5)
    
    const response = await axios.get('https://api.vk.com/method/wall.get', {
      params: {
        owner_id: `-${GROUP_ID}`, // Минус для сообществ
        count,
        access_token: ACCESS_TOKEN,
        v: VK_API_VERSION,
      },
    });

    const posts = response.data.response.items;
    res.json({ success: true, posts});
  } catch (error) {
    console.error('VK API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при получении постов из VK' 
    });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

// Обработка завершения работы
process.on('SIGINT', async () => {
    try {
        await db.close();
        server.close(() => {
            console.log('Сервер и соединение с БД закрыты');
            process.exit(0);
        });
    } catch (err) {
        console.error('Ошибка при завершении работы:', err);
        process.exit(1);
    }
});

return { app, db };
}

// Запуск приложения
initializeApp().catch(err => {
console.error('Ошибка инициализации приложения:', err);
process.exit(1);
});