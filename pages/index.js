import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [singleAddress, setSingleAddress] = useState('');
  const [batchAddresses, setBatchAddresses] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  const toggleLoading = (show) => {
    setLoading(show);
  };

  const showError = (message) => {
    setError(message);
  };

  const hideError = () => {
    setError('');
  };

  const createTable = (data) => {
    if (!Array.isArray(data)) data = [data];
    return (
      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>地址</th>
              <th>余额</th>
              <th>活跃天数</th>
              <th>首次交易</th>
              <th>最后交易</th>
              <th>交易总数</th>
              <th>合约交互</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => createTableRow(item))}
          </tbody>
        </table>
      </div>
    );
  };

  const createTableRow = (data) => {
    if (data.error) {
      return (
        <tr key={data.address}>
          <td>{data.address}</td>
          <td colSpan="7" className="text-danger">{data.error}</td>
        </tr>
      );
    }

    return (
      <tr key={data.address}>
        <td>{data.address}</td>
        <td>{data.balance}</td>
        <td>
          {data.activeDays.day}天 / {data.activeDays.week}周 / {data.activeDays.month}月
        </td>
        <td>{formatDate(data.firstTxTime)}</td>
        <td>{formatDate(data.lastTxTime)}</td>
        <td>{data.txCount}</td>
        <td>{data.contractCount}</td>
        <td>{formatDate(data.updatedAt)}</td>
      </tr>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const querySingleAddress = async () => {
    if (!singleAddress) {
      showError('请输入钱包地址');
      return;
    }

    toggleLoading(true);
    hideError();

    try {
      const response = await fetch(`/api/wallet/${singleAddress}`);
      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
        return;
      }

      setResults([data]);
    } catch (error) {
      showError('查询失败，请稍后重试');
    } finally {
      toggleLoading(false);
    }
  };

  const queryBatchAddresses = async () => {
    if (!batchAddresses) {
      showError('请输入钱包地址列表');
      return;
    }

    const addresses = batchAddresses.split('\n').map(addr => addr.trim()).filter(addr => addr);
    if (addresses.length === 0) {
      showError('请输入有效的钱包地址');
      return;
    }

    toggleLoading(true);
    hideError();

    try {
      const response = await fetch('/api/wallets/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
        return;
      }

      setResults(data);
    } catch (error) {
      showError('批量查询失败，请稍后重试');
    } finally {
      toggleLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <Head>
        <title>Monad Wallet Data Query</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>

      <h1 className="text-center mb-4">Monad Wallet Data Query</h1>

      <div className="row">
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">单个地址查询</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="输入钱包地址"
                  value={singleAddress}
                  onChange={(e) => setSingleAddress(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={querySingleAddress}
                disabled={loading}
              >
                查询
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">批量地址查询</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder="输入多个钱包地址（每行一个）"
                  value={batchAddresses}
                  onChange={(e) => setBatchAddresses(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={queryBatchAddresses}
                disabled={loading}
              >
                批量查询
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center mb-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">查询结果</h5>
          </div>
          <div className="card-body">
            {createTable(results)}
          </div>
        </div>
      )}
    </div>
  );
} 