const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// متغيرات البيئة
const PORT = process.env.PORT || 3000;

// قائمة بخوادم Binance API البديلة
const BINANCE_API_SERVERS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com'
];

// مصادر بيانات احتياطية
const FALLBACK_APIS = {
  coingecko: 'https://api.coingecko.com/api/v3',
  coinmarketcap: 'https://pro-api.coinmarketcap.com/v1'
};

// نظام التخزين المؤقت
let priceCache = {};
let cacheTimestamp = 0;
const CACHE_EXPIRY = 60000; // 1 دقيقة

// دالة محاولة الاتصال بخوادم Binance بالترتيب
async function tryBinanceServers(endpoint, params = {}) {
  for (const server of BINANCE_API_SERVERS) {
    try {
      const url = `${server}/api/v3/${endpoint}`;
      const response = await axios.get(url, { params, timeout: 5000 });
      return response.data;
    } catch (error) {
      console.log(`Failed with ${server}, trying next...`);
    }
  }
  throw new Error('All Binance servers failed');
}

// دالة Fallback لجلب البيانات من مصادر بديلة
async function getFallbackData(endpoint) {
  try {
    // محاولة CoinGecko أولاً
    const cgResponse = await axios.get(`${FALLBACK_APIS.coingecko}/${endpoint}`);
    return cgResponse.data;
  } catch (error) {
    console.log('CoinGecko failed, trying alternatives...');
    // يمكنك إضافة المزيد من مصادر Fallback هنا
    throw error;
  }
}

// نقطة النهاية الرئيسية مع نظام Fallback
app.get('/api/binance/spot-prices', async (req, res) => {
  try {
    // التحقق من التخزين المؤقت أولاً
    if (Date.now() - cacheTimestamp < CACHE_EXPIRY && priceCache.spotPrices) {
      return res.json({
        source: 'cache',
        data: priceCache.spotPrices,
        timestamp: cacheTimestamp
      });
    }

    // المحاولة مع خوادم Binance
    try {
      const data = await tryBinanceServers('ticker/price');
      priceCache.spotPrices = data;
      cacheTimestamp = Date.now();
      return res.json({
        source: 'binance',
        data: data,
        timestamp: cacheTimestamp
      });
    } catch (binanceError) {
      console.log('Binance failed, using fallback...');
      const fallbackData = await getFallbackData('exchanges/binance/tickers');
      
      // تحويل بيانات CoinGecko لتكون مشابهة لبيانات Binance
      const formattedData = fallbackData.tickers.map(ticker => ({
        symbol: ticker.base + ticker.target,
        price: ticker.last
      }));
      
      priceCache.spotPrices = formattedData;
      cacheTimestamp = Date.now();
      return res.json({
        source: 'coingecko-fallback',
        data: formattedData,
        timestamp: cacheTimestamp
      });
    }
  } catch (error) {
    console.error('Final error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prices from all sources',
      details: error.message 
    });
  }
});

// نقطة النهاية لسعر عملة محددة
app.get('/api/binance/spot-price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // المحاولة مع خوادم Binance أولاً
    try {
      const data = await tryBinanceServers('ticker/price', { symbol });
      return res.json({
        source: 'binance',
        data: data
      });
    } catch (binanceError) {
      console.log('Binance failed, using fallback...');
      const fallbackData = await getFallbackData(`simple/price?ids=${symbol.split('USDT')[0].toLowerCase()}&vs_currencies=usd`);
      
      const price = fallbackData[symbol.split('USDT')[0].toLowerCase()].usd;
      return res.json({
        source: 'coingecko-fallback',
        data: {
          symbol: symbol,
          price: price.toString()
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch price',
      details: error.message 
    });
  }
});

// بدء الخادم
app.listen(PORT, () => {
  console.log(`Binance Proxy with Fallback running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log(`- GET /api/binance/spot-prices`);
  console.log(`- GET /api/binance/spot-price/:symbol`);
});
