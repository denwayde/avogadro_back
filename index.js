const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv').config()
const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors()); // Разрешаем запросы с любых доменов
app.use(express.json());

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

    const posts = response?.data?.response?.items;
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
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});