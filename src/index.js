require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const NodeCache = require('node-cache');
const mongoose = require('mongoose');

const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Monad RPC配置
const RPC_URL = "https://testnet-rpc.monad.xyz";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// MongoDB模型
const WalletSchema = new mongoose.Schema({
  address: { type: String, unique: true },
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

const Wallet = mongoose.model('Wallet', WalletSchema);

// 连接MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/monad_wallets')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API路由
app.get('/api/query/:address', async (req, res) => {
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
    const currentBlock = await provider.getBlockNumber();
    const dayBlocks = 86400; // 一天的区块数
    const weekBlocks = dayBlocks * 7;
    const monthBlocks = dayBlocks * 30;

    // 获取交易历史（这里需要实现具体的交易历史查询逻辑）
    const txHistory = await getTransactionHistory(address, currentBlock - monthBlocks, currentBlock);

    // 计算活跃天数
    const activeDays = {
      day: calculateActiveDays(txHistory, dayBlocks),
      week: calculateActiveDays(txHistory, weekBlocks),
      month: calculateActiveDays(txHistory, monthBlocks)
    };

    // 获取合约交互次数
    const contractCount = await getContractInteractions(address);

    const walletData = {
      address,
      balance: formattedBalance,
      activeDays,
      firstTxTime: txHistory[0]?.timestamp || null,
      lastTxTime: txHistory[txHistory.length - 1]?.timestamp || null,
      txCount: txHistory.length,
      contractCount,
      updatedAt: new Date()
    };

    // 保存到数据库
    await Wallet.findOneAndUpdate(
      { address },
      walletData,
      { upsert: true, new: true }
    );

    // 更新缓存
    cache.set(address, walletData);

    res.json(walletData);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/batch-query', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid addresses array' });
    }

    // 验证所有地址
    const validAddresses = addresses.filter(addr => ethers.isAddress(addr));
    if (validAddresses.length === 0) {
      return res.status(400).json({ error: 'No valid addresses provided' });
    }

    // 并行查询所有地址
    const results = await Promise.all(
      validAddresses.map(addr => getWalletData(addr))
    );

    res.json(results);
  } catch (error) {
    console.error('Batch query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 辅助函数
async function getTransactionHistory(address, fromBlock, toBlock) {
  // 这里需要实现具体的交易历史查询逻辑
  // 可以使用eth_getLogs或其他RPC方法
  return [];
}

function calculateActiveDays(txHistory, blockRange) {
  // 实现活跃天数计算逻辑
  return 0;
}

async function getContractInteractions(address) {
  // 实现合约交互次数查询逻辑
  return 0;
}

async function getWalletData(address) {
  // 检查缓存
  const cachedData = cache.get(address);
  if (cachedData) {
    return cachedData;
  }

  // 从数据库获取
  const dbData = await Wallet.findOne({ address });
  if (dbData) {
    cache.set(address, dbData);
    return dbData;
  }

  // 如果数据库中没有，则重新查询
  const response = await fetch(`/api/query/${address}`);
  const data = await response.json();
  return data;
}

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 