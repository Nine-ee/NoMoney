import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getTokenContract, getTokenContractReadOnly } from "../utils/contract";

const ShopPage = ({ account }) => {
  const [tokenBalance, setTokenBalance] = useState("0");
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const products = [
    { id: 1, name: "纪念贴纸", price: 100, image: "🎨", stock: 100 },
    { id: 2, name: "限量T恤", price: 500, image: "👕", stock: 50 },
    { id: 3, name: "帆布包", price: 300, image: "👜", stock: 30 },
  ];

  const loadBalance = async () => {
    if (!account) return;
    try {
      const contract = getTokenContractReadOnly();
      const balance = await contract.balanceOf(account);
      setTokenBalance(balance.toString());
    } catch (error) {
      console.error("加载余额失败:", error);
    }
  };

  const handleRedeem = async (product) => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }

    const balanceNum = parseInt(tokenBalance);
    if (balanceNum < product.price) {
      alert(`❌ 代币不足！需要 ${product.price} XXCT，当前只有 ${balanceNum} XXCT`);
      return;
    }

    setIsLoading(true);
    try {
      const contract = await getTokenContract();
      const signer = await contract.signer;
      const address = await signer.getAddress();
      
      const tx = await contract.transfer(
        address,
        ethers.utils.parseUnits(product.price.toString(), 0)
      );
      const receipt = await tx.wait(1);

      // 记录兑换历史（含交易哈希）
      const newOrder = {
        product: product.name,
        price: product.price,
        txHash: receipt.transactionHash,
        time: new Date().toLocaleString(),
      };
      const newOrders = [newOrder, ...orders];
      setOrders(newOrders);
      localStorage.setItem("orders", JSON.stringify(newOrders));

      alert(`✅ 成功兑换 ${product.name}！交易哈希: ${receipt.transactionHash.slice(0, 16)}...`);
      await loadBalance();
    } catch (error) {
      console.error("兑换失败:", error);
      alert("❌ 兑换失败，请查看控制台错误信息");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const savedOrders = localStorage.getItem("orders");
    if (savedOrders) {
      setOrders(JSON.parse(savedOrders));
    }
    loadBalance();
  }, [account]);

  return (
    <div>
      <div className="card">
        <h2>🛍️ 纪念商城</h2>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          使用 XXCT 代币兑换专属纪念品
        </p>
        {account && (
          <p style={{ background: "#F3F4F6", padding: "0.5rem 1rem", borderRadius: "8px", display: "inline-block" }}>
            💰 代币余额：{parseInt(tokenBalance)} XXCT
          </p>
        )}
      </div>

      <div className="shop-grid">
        {products.map((product) => (
          <div key={product.id} className="shop-item">
            <div style={{ fontSize: "4rem" }}>{product.image}</div>
            <h3>{product.name}</h3>
            <p className="price">{product.price} XXCT</p>
            <p className="stock">库存：{product.stock} 件</p>
            <button
              className="btn"
              onClick={() => handleRedeem(product)}
              disabled={isLoading || !account || parseInt(tokenBalance) < product.price}
            >
              {parseInt(tokenBalance) < product.price ? "代币不足" : "兑换"}
            </button>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h3>📋 最近兑换记录</h3>
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>价格</th>
                <th>交易哈希</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map((order, index) => (
                <tr key={index}>
                  <td>{order.product}</td>
                  <td>{order.price} XXCT</td>
                  <td style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${order.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: "#4F46E5" }}
                    >
                      {order.txHash.slice(0, 12)}...
                    </a>
                  </td>
                  <td>{order.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ShopPage;