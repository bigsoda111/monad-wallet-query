const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const NodeCache = require('node-cache');
const mongoose = require('mongoose');

const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存

app.use(cors());
app.use(express.json());

// MongoDB Schema
const walletSchema = new mongoose.Schema({
  address: String,
  rank: Number,
  balance: String,
  activeDays: {
    day: Number,
    week: Number,
    month: Number
  },
  firstTxTime: Date,
  lastTxTime: Date,
  txCount: Number,
  contractCount: Number,
  updatedAt: Date
});

const Wallet = mongoose.model('Wallet', walletSchema);

// 连接MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/monad_wallets')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// 创建provider
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://testnet-rpc.monad.xyz');

// API路由
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
    const balance = await provider.getBalance(address);
    const formattedBalance = ethers.formatEther(balance);

    // 获取交易历史
    const txHistory = await getTransactionHistory(address);
    
    // 计算活跃天数
    const activeDays = await calculateActiveDays(txHistory);
    
    // 获取合约交互次数
    const contractInteractions = await getContractInteractions(address);

    const result = {
      address,
      balance: formattedBalance,
      activeDays,
      firstTxTime: txHistory[0]?.timestamp || null,
      lastTxTime: txHistory[txHistory.length - 1]?.timestamp || null,
      txCount: txHistory.length,
      contractCount: contractInteractions,
      updatedAt: new Date()
    };

    // 保存到数据库
    await Wallet.findOneAndUpdate(
      { address },
      result,
      { upsert: true, new: true }
    );

    // 缓存结果
    cache.set(address, result);

    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/wallets/batch', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid addresses array' });
    }

    // 验证地址
    const validAddresses = addresses.filter(addr => ethers.isAddress(addr));
    if (validAddresses.length === 0) {
      return res.status(400).json({ error: 'No valid addresses provided' });
    }

    // 并行查询所有地址
    const results = await Promise.all(
      validAddresses.map(addr => 
        fetch(`/api/wallet/${addr}`)
          .then(res => res.json())
          .catch(() => ({ address: addr, error: 'Failed to fetch data' }))
      )
    );

    res.json(results);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 辅助函数
async function getTransactionHistory(address) {
  // TODO: 实现交易历史查询
  return [];
}

async function calculateActiveDays(txHistory) {
  // TODO: 实现活跃天数计算
  return {
    day: 0,
    week: 0,
    month: 0
  };
}

async function getContractInteractions(address) {
  // TODO: 实现合约交互统计
  return 0;
}

// 导出处理函数
module.exports = app; 