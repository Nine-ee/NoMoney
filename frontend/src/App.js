import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import CrowdfundingPage from "./pages/CrowdfundingPage";
import WalletPage from "./pages/WalletPage";
import ShopPage from "./pages/ShopPage";
import MyOrdersPage from "./pages/MyOrdersPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import "./App.css";

function App() {
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("请安装MetaMask！");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        localStorage.setItem("connectedAccount", accounts[0]);
        console.log("[钱包] 已连接账户:", accounts[0]);
      }
    } catch (error) {
      if (error.code === 4001) {
        console.log("用户拒绝连接");
      } else {
        console.error("连接钱包失败:", error);
      }
    }
  };

  // 检查是否已连接
  useEffect(() => {
    const savedAccount = localStorage.getItem("connectedAccount");
    if (savedAccount) {
      setAccount(savedAccount);
    }
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
          setAccount(null);
          localStorage.removeItem("connectedAccount");
        } else {
          setAccount(accounts[0]);
          localStorage.setItem("connectedAccount", accounts[0]);
        }
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="App">
        <nav className="navbar">
          <h1 className="logo">Na 众筹</h1>
          <div className="nav-links">
            <NavLink to="/" end>众筹</NavLink>
            <NavLink to="/wallet">钱包</NavLink>
            <NavLink to="/shop">商城</NavLink>
            <NavLink to="/orders">我的订单</NavLink>
            <NavLink to="/dashboard">数据看板</NavLink>
            <NavLink to="/profile">个人中心</NavLink>
          </div>
          <div className="wallet-section">
            {account ? (
              <span className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            ) : (
              <button onClick={connectWallet} className="connect-btn">
                连接钱包
              </button>
            )}
          </div>
        </nav>

        <div className="container">
          <Routes>
            <Route path="/" element={<CrowdfundingPage account={account} />} />
            <Route path="/wallet" element={<WalletPage account={account} />} />
            <Route path="/shop" element={<ShopPage account={account} />} />
            <Route path="/orders" element={<MyOrdersPage account={account} />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage account={account} setAccount={setAccount} />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;