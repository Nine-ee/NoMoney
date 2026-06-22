import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getCrowdfundingContractReadOnly,
  getCrowdfundingContract,
} from "../utils/contract";

const CrowdfundingPage = ({ account }) => {
  const [goal, setGoal] = useState(0);
  const [raised, setRaised] = useState(0);
  const [investorCount, setInvestorCount] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState("");
  const [earlyBirdLimit, setEarlyBirdLimit] = useState(0);
  const [refundDeadline, setRefundDeadline] = useState(0);
  const [refundWindowOpen, setRefundWindowOpen] = useState(false);

  const loadData = async () => {
    try {
      const contract = getCrowdfundingContractReadOnly();
      
      const goalBig = await contract.getGoal();
      const raisedBig = await contract.getRaisedAmount();
      const count = await contract.getInvestorCount();
      const deadlineBig = await contract.getDeadline();
      const success = await contract.getIsSuccessful();
      const earlyBird = await contract.getEarlyBirdLimit();
      const refundDeadlineBig = await contract.getRefundDeadline();
      const refundOpen = await contract.isRefundWindowOpen();

      setGoal(parseFloat(ethers.utils.formatEther(goalBig)));
      setRaised(parseFloat(ethers.utils.formatEther(raisedBig)));
      setInvestorCount(parseInt(count));
      setDeadline(parseInt(deadlineBig));
      setIsSuccessful(success);
      setEarlyBirdLimit(parseInt(earlyBird));
      setRefundDeadline(parseInt(refundDeadlineBig));
      setRefundWindowOpen(refundOpen);
    } catch (error) {
      console.error("加载数据失败:", error);
    }
  };

  const updateRemainingTime = () => {
    const now = Math.floor(Date.now() / 1000);
    const diff = deadline - now;
    if (diff <= 0) {
      setRemainingTime("众筹已结束");
      return;
    }
    const days = Math.floor(diff / (60 * 60 * 24));
    const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((diff % (60 * 60)) / 60);
    setRemainingTime(`${days}天 ${hours}时 ${minutes}分`);
  };

  // 监听投资事件（实时更新）
  useEffect(() => {
    let contract;
    const setupEventListener = async () => {
      try {
        contract = getCrowdfundingContractReadOnly();
        contract.on("Invested", (investor, amount, isEarlyBird) => {
          console.log(`🔔 新投资: ${ethers.utils.formatEther(amount)} ETH, 早鸟: ${isEarlyBird}`);
          loadData();
          // 更新本地历史记录
          const history = JSON.parse(localStorage.getItem("fundingHistory") || "[]");
          history.push({
            time: new Date().toLocaleString(),
            amount: raised + parseFloat(ethers.utils.formatEther(amount)),
            count: investorCount + 1,
          });
          localStorage.setItem("fundingHistory", JSON.stringify(history));
        });
      } catch (error) {
        console.error("设置事件监听失败:", error);
      }
    };

    setupEventListener();
    return () => {
      if (contract) {
        contract.removeAllListeners("Invested");
      }
    };
  }, [raised, investorCount]);

  const handleInvest = async (ethAmount) => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.invest({
        value: ethers.utils.parseEther(ethAmount),
      });
      await tx.wait(1);
      alert(`✅ 成功投资 ${ethAmount} ETH！`);
      await loadData();
    } catch (error) {
      console.error("投资失败:", error);
      alert("❌ 投资失败，请查看控制台错误信息");
    }
    setIsLoading(false);
  };

  const handleFinalize = async () => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.finalizeCampaign();
      await tx.wait(1);
      alert("✅ 众筹已结束！代币已分发！");
      await loadData();
    } catch (error) {
      console.error("结束众筹失败:", error);
      alert("❌ 操作失败，请查看控制台错误信息");
    }
    setIsLoading(false);
  };

  const handleSetRefundWindow = async () => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.setRefundWindow(7 * 24 * 60 * 60); // 7天
      await tx.wait(1);
      alert("✅ 退款窗口已开启（7天）！");
      await loadData();
    } catch (error) {
      console.error("开启退款窗口失败:", error);
      alert("❌ 操作失败");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = goal > 0 ? (raised / goal) * 100 : 0;

  return (
    <div>
      <div className="card">
        <h2>🎯 XX众筹项目</h2>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          支持我们的创意项目，获得专属代币！
        </p>
        <p style={{ marginBottom: "1rem" }}>
          🦅 早鸟奖励：前 <strong>{earlyBirdLimit}</strong> 名投资者额外获得 <strong>20%</strong> 代币奖励！
        </p>

        <div className="stats">
          <div className="stat-item">
            <div className="number">{raised.toFixed(2)} ETH</div>
            <div className="label">已筹金额</div>
          </div>
          <div className="stat-item">
            <div className="number">{goal.toFixed(2)} ETH</div>
            <div className="label">目标金额</div>
          </div>
          <div className="stat-item">
            <div className="number">{investorCount}</div>
            <div className="label">参与人数</div>
          </div>
          <div className="stat-item">
            <div className="number" style={{ fontSize: "1rem" }}>
              {remainingTime || "加载中..."}
            </div>
            <div className="label">剩余时间</div>
          </div>
        </div>

        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p style={{ textAlign: "center", color: "#6B7280" }}>
          {progress.toFixed(1)}% 完成
          {isSuccessful && " 🎉"}
        </p>
      </div>

      <div className="card">
        <h3>💰 投资</h3>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          1 ETH = 10,000 代币 {earlyBirdLimit > 0 && "| 早鸟额外+20%"}
        </p>
        <div>
          <button
            className="btn"
            onClick={() => handleInvest("0.1")}
            disabled={isLoading || !account || isSuccessful}
          >
            投资 0.1 ETH
          </button>
          <button
            className="btn"
            onClick={() => handleInvest("1")}
            disabled={isLoading || !account || isSuccessful}
          >
            投资 1 ETH
          </button>
          <button
            className="btn"
            onClick={() => handleInvest("5")}
            disabled={isLoading || !account || isSuccessful}
          >
            投资 5 ETH
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleFinalize}
            disabled={isLoading || !account || isSuccessful}
          >
            {isSuccessful ? "✅ 众筹已成功" : "结束众筹"}
          </button>
          {!isSuccessful && deadline < Date.now() / 1000 && (
            <button
              className="btn btn-warning"
              onClick={handleSetRefundWindow}
              disabled={isLoading || !account || refundWindowOpen}
            >
              {refundWindowOpen ? "✅ 退款窗口已开启" : "开启退款窗口"}
            </button>
          )}
        </div>
        {!account && (
          <p style={{ color: "#EF4444", marginTop: "1rem" }}>
            ⚠️ 请先连接钱包
          </p>
        )}
        {isSuccessful && (
          <p style={{ color: "#10B981", marginTop: "1rem" }}>
            🎉 众筹成功！代币已分发！去商城看看吧！
          </p>
        )}
        {!isSuccessful && deadline < Date.now() / 1000 && (
          <p style={{ color: "#F59E0B", marginTop: "1rem" }}>
            ⏰ 众筹已结束，未达到目标。项目方可开启退款窗口。
          </p>
        )}
      </div>
    </div>
  );
};

export default CrowdfundingPage;