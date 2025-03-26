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

    // 限制批量查询的数量
    if (validAddresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses allowed per batch query' });
    }

    const results = await Promise.all(
      validAddresses.map(async (address) => {
        try {
          // 直接查询数据而不是通过 HTTP 请求
          const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
          const balance = await provider.getBalance(address);
          const formattedBalance = ethers.formatEther(balance);

          const transactions = await getTransactionHistory(address);
          const activeDays = calculateActiveDays(transactions);
          const contractInteractions = await getContractInteractions(address);

          const walletData = {
            address,
            rank: 0,
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

          return walletData;
        } catch (error) {
          console.error(`Error fetching data for ${address}:`, error);
          return { 
            address, 
            error: 'Failed to fetch data',
            details: error.message 
          };
        }
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Batch query error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// 辅助函数
async function getTransactionHistory(address) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    const dayBlocks = 86400; // 一天的区块数
    const fromBlock = currentBlock - (dayBlocks * 30); // 获取最近30天的交易

    // 获取区块历史
    const blocks = [];
    for (let i = fromBlock; i <= currentBlock; i++) {
      const block = await provider.getBlock(i, true);
      if (block) {
        blocks.push(block);
      }
    }

    // 过滤出与地址相关的交易
    const transactions = [];
    for (const block of blocks) {
      for (const tx of block.transactions) {
        if (tx.from.toLowerCase() === address.toLowerCase() || 
            (tx.to && tx.to.toLowerCase() === address.toLowerCase())) {
          transactions.push({
            hash: tx.hash,
            timestamp: block.timestamp,
            from: tx.from,
            to: tx.to,
            value: tx.value.toString(),
            blockNumber: block.number
          });
        }
      }
    }

    return transactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}

function calculateActiveDays(transactions) {
  if (!transactions || transactions.length === 0) return 0;
  
  // 获取最早的交易时间
  const earliestTx = Math.min(...transactions.map(tx => tx.timestamp));
  const now = Math.floor(Date.now() / 1000);
  
  // 计算活跃天数
  const days = Math.ceil((now - earliestTx) / (24 * 60 * 60));
  return days;
}

async function getContractInteractions(address) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    const dayBlocks = 86400; // 一天的区块数
    const fromBlock = currentBlock - (dayBlocks * 30); // 获取最近30天的交易

    // 获取区块历史
    const blocks = [];
    for (let i = fromBlock; i <= currentBlock; i++) {
      const block = await provider.getBlock(i, true);
      if (block) {
        blocks.push(block);
      }
    }

    // 过滤出合约交互
    const contractInteractions = [];
    for (const block of blocks) {
      for (const tx of block.transactions) {
        if (tx.to && tx.to.toLowerCase() === address.toLowerCase() && tx.data !== '0x') {
          contractInteractions.push({
            hash: tx.hash,
            timestamp: block.timestamp,
            from: tx.from,
            to: tx.to,
            data: tx.data
          });
        }
      }
    }

    return contractInteractions;
  } catch (error) {
    console.error('Error fetching contract interactions:', error);
    return [];
  }
}

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 