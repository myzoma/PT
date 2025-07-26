const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// نقطة البداية
app.get('/', (req, res) => {
  res.json({
    message: "Binance Proxy Server",
    endpoints: [
      "/api/binance/exchange-info",
      "/api/binance/spot-prices",
      "/api/binance/spot-price/:symbol"
    ]
  });
});

// نقطة exchangeInfo
app.get('/api/binance/exchange-info', async (req, res) => {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching exchange info:', error);
    res.status(500).json({ error: 'Failed to fetch exchange info' });
  }
});

// باقي نقاط النهاية (ابقها كما هي)
app.get('/api/binance/spot-prices', async (req, res) => {
  // ... الكود الحالي
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
