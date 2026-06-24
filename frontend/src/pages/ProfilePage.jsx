import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getProvider,
  getTokenContractReadOnly,
  checkNetwork,
} from "../utils/contract";

const ProfilePage = ({ account, setAccount }) => {
  const [ethBalance, setEthBalance] = useState("0");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({});

  // ============ 加载 ETH 余额和代币余额 ============
  const loadBalances = async () => {
    if (!account) return;
    setIsLoading(true);
    console.log("[钱包] 加载余额中...");
    try {
      // 先检查网络
      await checkNetwork();
      
      const provider = getProvider();
      
      const balance = await provider.getBalance(account);
      setEthBalance(ethers.utils.formatEther(balance));
      console.log("[钱包] ETH 余额:", ethers.utils.formatEther(balance));

      try {
        const tokenContract = getTokenContractReadOnly();
        const tokenBal = await tokenContract.balanceOf(account);
        setTokenBalance(ethers.utils.formatEther(tokenBal));
        console.log("[钱包] 代币余额:", ethers.utils.formatEther(tokenBal));
      } catch (error) {
        console.error("[钱包] 加载代币余额失败:", error);
        setTokenBalance("0");
      }

      const network = await provider.getNetwork();
      setNetworkInfo({
        name: network.name || "未知网络",
        chainId: network.chainId,
      });
      console.log("[钱包] 余额加载完成");
    } catch (error) {
      console.error("[钱包] 加载余额失败:", error);
    }
    setIsLoading(false);
  };

  // ============ 切换账户 - 弹出 MetaMask 账户列表 ============
  const switchAccount = async () => {
    if (!window.ethereum) {
      alert("请安装 MetaMask 钱包！");
      return;
    }
    try {
      console.log("[钱包] 正在切换账户...");
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        localStorage.setItem("connectedAccount", accounts[0]);
        console.log(`[钱包] 已切换到账户: ${accounts[0]}`);
        alert(`已切换到账户: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
        setTimeout(loadBalances, 500);
      }
    } catch (error) {
      if (error.code === 4001) {
        console.log("[钱包] 用户拒绝切换账户");
      } else {
        console.error("[钱包] 切换账户失败:", error);
        alert("切换账户失败，请查看控制台");
      }
    }
  };

  // ============ 断开钱包连接 ============
  const disconnectWallet = () => {
    if (window.ethereum) {
      setAccount(null);
      localStorage.removeItem("connectedAccount");
      console.log("[钱包] 已断开钱包连接");
      alert("已断开钱包连接");
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    if (account) {
      loadBalances();
      const interval = setInterval(loadBalances, 10000);
      return () => clearInterval(interval);
    }
  }, [account]);

  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          setAccount(null);
          localStorage.removeItem("connectedAccount");
        } else {
          setAccount(accounts[0]);
          localStorage.setItem("connectedAccount", accounts[0]);
        }
      };
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, [setAccount]);

  return (
    <div>
      <div className="card">
        <h2>👤 个人中心</h2>
        <p style={{ color: "#6B7280" }}>管理钱包和账户信息</p>
      </div>

      {!account ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔌</div>
          <h3>未连接钱包</h3>
          <p style={{ color: "#6B7280", marginBottom: "1.5rem" }}>
            请点击下方按钮连接 MetaMask 钱包
          </p>
          <button
            className="btn"
            onClick={async () => {
              try {
                const accounts = await window.ethereum.request({
                  method: "eth_requestAccounts",
                });
                if (accounts.length > 0) {
                  setAccount(accounts[0]);
                  localStorage.setItem("connectedAccount", accounts[0]);
                }
              } catch (error) {
                console.error("连接失败:", error);
              }
            }}
          >
            🔗 连接钱包
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ color: "#6B7280", fontSize: "0.9rem" }}>当前账户</p>
                <p style={{ fontFamily: "monospace", fontSize: "1.1rem", wordBreak: "break-all" }}>
                  {account}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ background: "#E5E7EB", padding: "0.2rem 0.8rem", borderRadius: "12px", fontSize: "0.8rem" }}>
                    🆔 {formatAddress(account)}
                  </span>
                  <span style={{ background: "#E5E7EB", padding: "0.2rem 0.8rem", borderRadius: "12px", fontSize: "0.8rem" }}>
                    🌐 {networkInfo.name || "未知"} (Chain ID: {networkInfo.chainId?.toString() || "?"})
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className="btn btn-secondary" onClick={loadBalances} disabled={isLoading}>
                  🔄 刷新余额
                </button>
                <button className="btn btn-success" onClick={switchAccount}>
                  🔀 切换账户
                </button>
                <button className="btn" style={{ background: "#EF4444" }} onClick={disconnectWallet}>
                  🚪 断开连接
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>💰 资产余额</h3>
            <div className="stats">
              <div className="stat-item">
                <div className="number" style={{ color: "#4F46E5" }}>
                  {isLoading ? "加载中..." : parseFloat(ethBalance).toFixed(4)}
                </div>
                <div className="label">ETH 余额</div>
              </div>
              <div className="stat-item">
                <div className="number" style={{ color: "#10B981" }}>
                  {isLoading ? "加载中..." : parseFloat(tokenBalance).toFixed(0)}
                </div>
                <div className="label">XXCT 代币余额</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>📊 代币信息</h3>
            <p><strong>代币名称：</strong>XX众筹代币</p>
            <p><strong>代币符号：</strong>XXCT</p>
            <p><strong>兑换比例：</strong>1 ETH = 10,000 XXCT</p>
            <p><strong>早鸟奖励：</strong>前10名额外+20%</p>
            <p><strong>用途：</strong>在商城兑换纪念商品</p>
          </div>

          <div className="card">
            <h3>⚡ 快速操作</h3>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => window.location.href = "/"}>
                🎯 去众筹
              </button>
              <button className="btn" onClick={() => window.location.href = "/shop"}>
                🛍️ 去商城
              </button>
              <button className="btn btn-success" onClick={() => window.location.href = "/wallet"}>
                👛 查看钱包
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfilePage;