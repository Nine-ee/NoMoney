import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getTokenContract, getTokenContractReadOnly } from "../utils/contract";
import contractAddress from "../contract-address.json";

const { crowdfundingAddress } = contractAddress;

// 默认商品数据
const defaultProducts = [
  { id: 1, name: "纪念贴纸", price: 100, image: "🎨", stock: 100 },
  { id: 2, name: "限量T恤", price: 500, image: "👕", stock: 50 },
  { id: 3, name: "帆布包", price: 300, image: "👜", stock: 30 },
];

const ShopPage = ({ account }) => {
  const [tokenBalance, setTokenBalance] = useState("0");
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState([]);

  // ============ 从 localStorage 加载商品库存 ============
  const loadProducts = () => {
    const savedProducts = localStorage.getItem("products");
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
      console.log("[商城] 从缓存加载商品数据");
    } else {
      setProducts([...defaultProducts]);
      localStorage.setItem("products", JSON.stringify(defaultProducts));
      console.log("[商城] 初始化默认商品数据");
    }
  };

  // ============ 加载代币余额 ============
  const loadBalance = async () => {
    if (!account) return;
    try {
      const contract = getTokenContractReadOnly();
      const balance = await contract.balanceOf(account);
      setTokenBalance(ethers.utils.formatEther(balance));
      console.log("[商城] 代币余额:", ethers.utils.formatEther(balance));
    } catch (error) {
      console.error("[商城] 加载余额失败:", error);
    }
  };

  // ============ 兑换商品 ============
  const handleRedeem = async (product) => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }

    const balanceNum = parseFloat(tokenBalance);
    if (balanceNum < product.price) {
      alert(`代币不足！需要 ${product.price} XXCT，当前只有 ${Math.floor(balanceNum)} XXCT`);
      return;
    }

    if (product.stock <= 0) {
      alert("该商品已售罄！");
      return;
    }

    console.log(`[商城] 开始兑换: ${product.name}, 价格: ${product.price} XXCT`);
    setIsLoading(true);
    try {
      const contract = await getTokenContract();
      const amount = ethers.utils.parseEther(product.price.toString());

      const tx = await contract.transfer(crowdfundingAddress, amount);
      console.log(`[商城] 兑换交易已发送: ${tx.hash}`);
      const receipt = await tx.wait(1);

      // 更新库存（存入 localStorage）
      const updatedProducts = products.map(p => 
        p.id === product.id ? { ...p, stock: p.stock - 1 } : p
      );
      setProducts(updatedProducts);
      localStorage.setItem("products", JSON.stringify(updatedProducts));

      // 记录订单（带账户地址）
      const newOrder = {
        product: product.name,
        price: product.price,
        txHash: receipt.transactionHash,
        time: new Date().toLocaleString(),
        account: account,
        productId: product.id,
      };
      const newOrders = [newOrder, ...orders];
      setOrders(newOrders);
      localStorage.setItem("orders", JSON.stringify(newOrders));

      console.log(`[商城] 兑换成功！${product.name}，交易哈希: ${receipt.transactionHash}`);
      alert(`兑换成功！获得 ${product.name}`);
      await loadBalance();
    } catch (error) {
      console.error("[商城] 兑换失败:", error);
      const msg = error.reason || error.data?.message || error.message;
      const cleanMsg = typeof msg === "string" ? msg.split("(")[0].trim() : "请查看控制台";
      alert("兑换失败: " + cleanMsg);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
    const savedOrders = localStorage.getItem("orders");
    if (savedOrders) {
      setOrders(JSON.parse(savedOrders));
    }
    loadBalance();
  }, [account]);

  return (
    <div>
      <div className="card">
        <h2>纪念商城</h2>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          使用 XXCT 代币兑换专属纪念品
        </p>
        {account && (
          <p style={{ background: "#F3F4F6", padding: "0.5rem 1rem", borderRadius: "8px", display: "inline-block" }}>
            代币余额：{parseFloat(tokenBalance).toFixed(0)} XXCT
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
              disabled={isLoading || !account || parseFloat(tokenBalance) < product.price}
            >
              {parseFloat(tokenBalance) < product.price ? "代币不足" : "兑换"}
            </button>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h3>最近兑换记录</h3>
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