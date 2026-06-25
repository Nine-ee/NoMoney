import React, { useState, useEffect } from "react";

const MyOrdersPage = ({ account }) => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const savedOrders = localStorage.getItem("orders");
    if (savedOrders) {
      const allOrders = JSON.parse(savedOrders);
      // 只显示当前账户的订单
      if (account) {
        const userOrders = allOrders.filter(order => order.account && order.account.toLowerCase() === account.toLowerCase());
        setOrders(userOrders);
      } else {
        setOrders(allOrders);
      }
    }
  }, [account]);

  return (
    <div>
      <div className="card">
        <h2>📋 我的订单</h2>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          查看所有兑换记录和交易详情
        </p>
        {!account && (
          <p style={{ color: "#EF4444" }}>⚠️ 请先连接钱包查看订单</p>
        )}
      </div>

      <div className="card">
        {orders.length === 0 ? (
          <p style={{ textAlign: "center", color: "#6B7280", padding: "2rem" }}>
            🛒 还没有订单，去商城逛逛吧！
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>商品</th>
                <th>价格 (NaCT)</th>
                <th>交易哈希</th>
                <th>时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{order.product}</td>
                  <td>{order.price}</td>
                  <td style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${order.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: "#4F46E5" }}
                    >
                      {order.txHash.slice(0, 8)}...{order.txHash.slice(-6)}
                    </a>
                  </td>
                  <td>{order.time}</td>
                  <td>
                    <span style={{ 
                      background: "#10B981", 
                      color: "white", 
                      padding: "0.2rem 0.8rem", 
                      borderRadius: "12px",
                      fontSize: "0.8rem"
                    }}>
                      ✅ 已完成
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h3>📊 统计</h3>
          <div className="stats">
            <div className="stat-item">
              <div className="number">{orders.length}</div>
              <div className="label">总订单数</div>
            </div>
            <div className="stat-item">
              <div className="number">
                {orders.reduce((sum, order) => sum + order.price, 0)}
              </div>
              <div className="label">总消费 (NaCT)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;