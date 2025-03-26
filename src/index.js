require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');
const NodeCache = require('node-cache');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// 缓存配置
const cache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存

// MongoDB Schema
const walletSchema = new mongoose.Schema({
  address: { type: String, unique: true },
  rank: Number,
  balance: String,
  activeDays: Number,
  transactionTimes: Number,
  transactionCount: Number,
  contractCount: Number,
  updatedAt: { type: Date, default: Date.now }
});

const Wallet = mongoose.model('Wallet', walletSchema);

// API 路由
app.get('/api/wallet/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // 检查缓存
    const cachedData = cache.get(address);
    if (cachedData) {
      return res.json(cachedData);
    }

    // 验证地址
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // 获取余额
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const balance = await provider.getBalance(address);
    const formattedBalance = ethers.formatEther(balance);

    // 获取交易历史
    const transactions = await getTransactionHistory(address);
    const activeDays = calculateActiveDays(transactions);
    const contractInteractions = await getContractInteractions(address);

    const walletData = {
      address,
      rank: 0, // 需要实现排名逻辑
      balance: formattedBalance,
      activeDays,
      transactionTimes: transactions.length,
      transactionCount: transactions.length,
      contractCount: contractInteractions.length,
      updatedAt: new Date()
    };

    // 保存到数据库
    await Wallet.findOneAndUpdate(
      { address },
      walletData,
      { upsert: true, new: true }
    );

    // 缓存数据
    cache.set(address, walletData);

    res.json(walletData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/wallet/batch', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid addresses array' });
    }

    const validAddresses = addresses.filter(addr => ethers.isAddress(addr));
    if (validAddresses.length === 0) {
      return res.status(400).json({ error: 'No valid addresses provided' });
    }

    const results = await Promise.all(
      validAddresses.map(async (address) => {
        try {
          const response = await fetch(`${req.protocol}://${req.get('host')}/api/wallet/${address}`);
          const data = await response.json();
          return data;
        } catch (error) {
          console.error(`Error fetching data for ${address}:`, error);
          return { address, error: 'Failed to fetch data' };
        }
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 