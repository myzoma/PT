const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// متغيرات البيئة
const PORT = process.env.PORT || 3000;
const BINANCE_API_URL = 'https://api.binance.com/api/v3';

// تخزين مؤقت للأسعار
let priceCache = {};
let lastUpdated = null;
const CACHE_DURATION = 60000; // 1 دقيقة

// وظيفة لجلب جميع أزواج التداول من بينانس
async function getAllTradingPairs() {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/exchangeInfo`);
    return response.data.symbols
      .filter(symbol => symbol.status === 'TRADING')
      .map(symbol => symbol.symbol);
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    return [];
  }
}

// وظيفة لجلب أسعار سبوت لجميع العملات
async function fetchAllSpotPrices() {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/ticker/price`);
    return response.data.reduce((acc, pair) => {
      acc[pair.symbol] = pair.price;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching spot prices:', error);
    return {};
  }
}

// تحديث البيانات المخزنة مؤقتًا
async function updateCache() {
  try {
    const [allPrices, tradingPairs] = await Promise.all([
      fetchAllSpotPrices(),
      getAllTradingPairs()
    ]);
    
    priceCache = {
      prices: allPrices,
      tradingPairs: tradingPairs
    };
    lastUpdated = Date.now();
    console.log('Cache updated at:', new Date(lastUpdated).toISOString());
  } catch (error) {
    console.error('Error updating cache:', error);
  }
}

// نقطة النهاية لجميع أسعار سبوت
app.get('/api/binance/spot-prices', async (req, res) => {
  try {
    // التحقق من التخزين المؤقت
    if (!lastUpdated || (Date.now() - lastUpdated) > CACHE_DURATION) {
      await updateCache();
    }
    
    res.json({
      success: true,
      data: priceCache.prices,
      lastUpdated: new Date(lastUpdated).toISOString()
    });
  } catch (error) {
    console.error('Error in spot-prices endpoint:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch spot prices' });
  }
});

// نقطة النهاية لأسعار عملة محددة
app.get('/api/binance/spot-price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // التحقق من التخزين المؤقت
    if (!lastUpdated || (Date.now() - lastUpdated) > CACHE_DURATION) {
      await updateCache();
    }
    
    if (priceCache.prices[symbol]) {
      res.json({
        success: true,
        symbol,
        price: priceCache.prices[symbol],
        lastUpdated: new Date(lastUpdated).toISOString()
      });
    } else {
      res.status(404).json({ success: false, error: 'Symbol not found' });
    }
  } catch (error) {
    console.error(`Error fetching price for ${req.params.symbol}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch price' });
  }
});

// نقطة النهاية لجميع أزواج التداول
app.get('/api/binance/trading-pairs', async (req, res) => {
  try {
    // التحقق من التخزين المؤقت
    if (!priceCache.tradingPairs) {
      await updateCache();
    }
    
    res.json({
      success: true,
      data: priceCache.tradingPairs,
      count: priceCache.tradingPairs.length,
      lastUpdated: new Date(lastUpdated).toISOString()
    });
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trading pairs' });
  }
});

// بدء الخادم وتحديث البيانات أول مرة
app.listen(PORT, async () => {
  console.log(`Binance Proxy Server running on port ${PORT}`);
  await updateCache();
});
