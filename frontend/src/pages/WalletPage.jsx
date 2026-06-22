import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getProvider,
  getTokenContractReadOnly,
} from "../utils/contract";

const WalletPage = ({ account }) => {
  const [ethBalance, setEthBalance] = useState("0");
  const [tokenBalance, setTokenBalance] = useState("0");

  // 在 WalletPage.jsx 中，loadBalances 函数
  const loadBalances = async () => {
    if (!account) return;

    try {
      const provider = getProvider();
      const balance = await provider.getBalance(account);
      setEthBalance(ethers.utils.formatEther(balance));

      const tokenContract = getTokenContractReadOnly();
      const tokenBal = await tokenContract.balanceOf(account);
      setTokenBalance(tokenBal.toString()); // 这里如果是 0，说明代币确实没 mint 到
    } catch (error) {
      console.error("加载余额失败:", error);
    }
  };

  useEffect(() => {
    loadBalances();
    const interval = setInterval(loadBalances, 5000);
    return () => clearInterval(interval);
  }, [account]);

  return (
    <div>
      <div className="card">
        <h2>👛 我的钱包</h2>
        {account ? (
          <>
            <div style={{ background: "#F3F4F6", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
              <p style={{ color: "#6B7280", fontSize: "0.9rem" }}>地址</p>
              <p style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{account}</p>
            </div>

            <div className="stats">
              <div className="stat-item">
                <div className="number">{parseFloat(ethBalance).toFixed(4)} ETH</div>
                <div className="label">ETH 余额</div>
              </div>
              <div className="stat-item">
                <div className="number">{parseFloat(tokenBalance).toFixed(0)}</div>
                <div className="label">XXCT 代币余额</div>
              </div>
            </div>

            <button className="btn" onClick={loadBalances}>
              🔄 刷新余额
            </button>
          </>
        ) : (
          <p style={{ color: "#EF4444" }}>⚠️ 请先连接钱包</p>
        )}
      </div>

      <div className="card">
        <h3>📊 代币信息</h3>
        <p><strong>代币名称：</strong>XX众筹代币</p>
        <p><strong>代币符号：</strong>XXCT</p>
        <p><strong>兑换比例：</strong>1 ETH = 10,000 XXCT</p>
        <p><strong>早鸟奖励：</strong>前10名额外+20%</p>
        <p><strong>用途：</strong>在商城兑换纪念商品</p>
      </div>
    </div>
  );
};

export default WalletPage;