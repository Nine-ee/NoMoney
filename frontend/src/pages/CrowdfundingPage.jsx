import React, { useState, useEffect, useRef, useCallback } from "react";
import { ethers } from "ethers";
import {
  getCrowdfundingContractReadOnly,
  getCrowdfundingContract,
  checkNetwork,
} from "../utils/contract";

const CrowdfundingPage = ({ account }) => {
  const [goal, setGoal] = useState("0");
  const [raised, setRaised] = useState("0");
  const [investorCount, setInvestorCount] = useState(0);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isWithdrawn, setIsWithdrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState("");
  const [earlyBirdLimit, setEarlyBirdLimit] = useState(0);
  const [earlyBirdRemaining, setEarlyBirdRemaining] = useState(0);
  const [userContribution, setUserContribution] = useState("0");
  const [isEarlyBird, setIsEarlyBird] = useState(false);
  const [canRefund, setCanRefund] = useState(false);
  const [hasRefunded, setHasRefunded] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [ownerAddress, setOwnerAddress] = useState("");

  const timerRef = useRef(null);
  const listenerRef = useRef(null);

  const loadData = useCallback(async () => {
    console.log("[众筹] 加载数据中...");
    try {
      // 先检查网络
      await checkNetwork();
      
      const contract = getCrowdfundingContractReadOnly();

      const info = await contract.getCampaignInfo();
      setGoal(ethers.utils.formatEther(info.target));
      setRaised(ethers.utils.formatEther(info.raised));
      setInvestorCount(Number(info.participantCount));
      setIsSuccessful(info.isSuccessful);
      setIsWithdrawn(await contract.getIsWithdrawn());
      setEarlyBirdLimit(Number(await contract.getEarlyBirdLimit()));
      setEarlyBirdRemaining(Number(info.earlyBirdRemaining));
      setOwnerAddress(await contract.getOwner());

      const [cdRemaining, cdActive] = await contract.getCooldownInfo();
      setCooldownRemaining(Number(cdRemaining));
      setIsCooldownActive(cdActive);

      if (account) {
        const contribution = await contract.s_investors(account);
        setUserContribution(ethers.utils.formatEther(contribution));
        setIsEarlyBird(await contract.s_isEarlyBird(account));
        setHasRefunded(await contract.s_hasRefunded(account));

        const refundInfo = await contract.canUserRefund(account);
        setCanRefund(refundInfo[0]);
        setRefundReason(refundInfo[1]);
      }
      console.log("[众筹] 数据加载完成", { goal: info.target.toString(), raised: info.raised.toString() });
    } catch (error) {
      console.error("[众筹] 加载数据失败:", error);
    }
  }, [account]);

  const updateRemainingTime = useCallback(() => {
    const update = async () => {
      try {
        const contract = getCrowdfundingContractReadOnly();
        const remaining = await contract.getRemainingTime();
        const secs = Number(remaining);
        if (secs <= 0) {
          setRemainingTime("众筹已结束");
          return;
        }
        const days = Math.floor(secs / 86400);
        const hours = Math.floor((secs % 86400) / 3600);
        const minutes = Math.floor((secs % 3600) / 60);
        setRemainingTime(`${days}天 ${hours}时 ${minutes}分`);
      } catch (e) {
        // ignore
      }
    };
    update();
  }, []);

  useEffect(() => {
    loadData();
    updateRemainingTime();
    timerRef.current = setInterval(() => {
      updateRemainingTime();
      loadData();
    }, 15000);
    return () => clearInterval(timerRef.current);
  }, [loadData, updateRemainingTime]);

  useEffect(() => {
    let contract;
    const setupListener = async () => {
      try {
        contract = getCrowdfundingContractReadOnly();
        if (listenerRef.current) {
          contract.off("Invested", listenerRef.current);
        }

        listenerRef.current = async (investor, amount, tokenAmount, isEarlyBirdFlag) => {
          console.log("[众筹] 监听到投资事件:", {
            investor,
            amount: ethers.utils.formatEther(amount),
            tokenAmount: ethers.utils.formatEther(tokenAmount),
            isEarlyBird: isEarlyBirdFlag
          });
          const ethAmount = parseFloat(ethers.utils.formatEther(amount));
          setRaised(prev => (parseFloat(prev) + ethAmount).toFixed(4));
          setInvestorCount(prev => prev + 1);
          if (isEarlyBirdFlag) {
            setEarlyBirdRemaining(prev => Math.max(0, prev - 1));
          }
          if (account && investor.toLowerCase() === account.toLowerCase()) {
            setUserContribution(prev => (parseFloat(prev) + ethAmount).toFixed(4));
            setIsEarlyBird(isEarlyBirdFlag);
          }
          setTimeout(() => loadData(), 500);
        };

        contract.on("Invested", listenerRef.current);
      } catch (error) {
        console.error("设置事件监听失败:", error);
      }
    };

    setupListener();
    return () => {
      if (contract && listenerRef.current) {
        contract.off("Invested", listenerRef.current);
      }
    };
  }, [account, loadData]);

  // ============ 记录众筹历史数据（供数据看板使用） ============
  const recordFundingHistory = async () => {
    try {
      const contract = getCrowdfundingContractReadOnly();
      const info = await contract.getCampaignInfo();
      const raisedVal = parseFloat(ethers.utils.formatEther(info.raised));
      const count = Number(info.participantCount);
      
      const history = JSON.parse(localStorage.getItem("fundingHistory") || "[]");
      const newEntry = {
        time: new Date().toLocaleString(),
        amount: raisedVal,
        count: count,
      };
      history.push(newEntry);
      localStorage.setItem("fundingHistory", JSON.stringify(history));
      console.log("[众筹] 历史数据已记录", newEntry);
    } catch (e) {
      console.error("[众筹] 记录历史数据失败:", e);
    }
  };

  // ============ 投资操作 ============
  const handleInvest = async (ethAmount) => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    console.log(`[众筹] 开始投资 ${ethAmount} ETH...`);
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.invest({
        value: ethers.utils.parseEther(ethAmount),
      });
      console.log(`[众筹] 交易已发送: ${tx.hash}`);
      await tx.wait(1);
      console.log(`[众筹] 投资成功！金额: ${ethAmount} ETH`);
      alert(`投资成功！已投入 ${ethAmount} ETH`);
      await loadData();
      await recordFundingHistory();
    } catch (error) {
      console.error("[众筹] 投资失败:", error);
      const msg = error.reason || error.data?.message || error.message;
      const cleanMsg = typeof msg === "string" ? msg.split("(")[0].trim() : "请查看控制台";
      alert("投资失败: " + cleanMsg);
    }
    setIsLoading(false);
  };

  // ============ 结束众筹 ============
  const handleFinalize = async () => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    console.log("[众筹] 正在结束众筹...");
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.finalizeCampaign();
      await tx.wait(1);
      console.log("[众筹] 众筹已结束");
      alert("众筹已结束！");
      await loadData();
    } catch (error) {
      console.error("[众筹] 结束众筹失败:", error);
      const msg = error.reason || error.data?.message || error.message;
      const cleanMsg = typeof msg === "string" ? msg.split("(")[0].trim() : "请查看控制台";
      alert("操作失败: " + cleanMsg);
    }
    setIsLoading(false);
  };

  // ============ 提前结束众筹（仅所有者） ============
  const handleEndEarly = async () => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    if (account.toLowerCase() !== ownerAddress.toLowerCase()) {
      alert("只有项目所有者才能提前结束众筹！");
      return;
    }
    if (!window.confirm("确定要提前结束众筹吗？")) {
      return;
    }
    console.log("[众筹] 正在提前结束众筹...");
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.endCampaignEarly();
      await tx.wait(1);
      console.log("[众筹] 众筹已提前结束");
      alert("众筹已提前结束！");
      await loadData();
    } catch (error) {
      console.error("[众筹] 提前结束众筹失败:", error);
      const msg = error.reason || error.data?.message || error.message;
      const cleanMsg = typeof msg === "string" ? msg.split("(")[0].trim() : "请查看控制台";
      alert("操作失败: " + cleanMsg);
    }
    setIsLoading(false);
  };

  // ============ 提取资金（仅所有者） ============
  const handleWithdraw = async () => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    console.log("[众筹] 正在提取资金...");
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.withdrawFunds();
      await tx.wait(1);
      console.log("[众筹] 资金提取成功");
      setIsWithdrawn(true); // 乐观更新，立即禁用按钮
      alert("资金提取成功！");
      await loadData();
    } catch (error) {
      console.error("[众筹] 提取资金失败:", error);
      const msg = error.reason || error.data?.message || error.message;
      const cleanMsg = typeof msg === "string" ? msg.split("(")[0].trim() : "请查看控制台";
      alert("提取资金失败: " + cleanMsg);
    }
    setIsLoading(false);
  };

  // ============ 申请退款 ============
  const handleRefund = async () => {
    if (!account) {
      alert("请先连接钱包！");
      return;
    }
    console.log("[众筹] 正在申请退款...");
    setIsLoading(true);
    try {
      const contract = await getCrowdfundingContract();
      const tx = await contract.refund();
      await tx.wait(1);
      console.log("[众筹] 退款成功");
      // 乐观更新：立即隐藏退款按钮，清空投资金额
      setCanRefund(false);
      setHasRefunded(true);
      setUserContribution("0");
      alert("退款成功！ETH 已退回您的钱包");
      await loadData();
    } catch (error) {
      console.error("[众筹] 退款失败:", error);
      const msg = error.reason || error.data?.message || error.message;
      const cleanMsg = typeof msg === "string" ? msg.split("(")[0].trim() : "请查看控制台";
      alert("退款失败: " + cleanMsg);
    }
    setIsLoading(false);
  };

  const progress = parseFloat(goal) > 0 ? (parseFloat(raised) / parseFloat(goal)) * 100 : 0;
  const isEnded = remainingTime === "众筹已结束";

  return (
    <div>
      <div className="card">
        <h2>XX众筹项目</h2>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          支持我们的创意项目，获得专属代币！
        </p>
        <p style={{ marginBottom: "1rem" }}>
          早鸟奖励：前 <strong>{earlyBirdLimit}</strong> 名投资者额外获得代币奖励！
          {earlyBirdRemaining > 0 && <span> （剩余 <strong>{earlyBirdRemaining}</strong> 个名额）</span>}
        </p>
        <p style={{ fontSize: "0.9rem", color: "#6B7280", background: "#F3F4F6", padding: "0.5rem", borderRadius: "8px", wordBreak: "break-all" }}>
          📌 项目发起者: {ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` : "加载中..."}
          {account && account.toLowerCase() === ownerAddress.toLowerCase() && <span style={{ color: "#10B981", marginLeft: "0.5rem" }}>（您是项目所有者）</span>}
        </p>

        <div className="stats">
          <div className="stat-item">
            <div className="number">{parseFloat(raised).toFixed(2)} ETH</div>
            <div className="label">已筹金额</div>
          </div>
          <div className="stat-item">
            <div className="number">{parseFloat(goal).toFixed(2)} ETH</div>
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
          {isSuccessful && " 已达成!"}
        </p>
      </div>

      {account && (
        <div className="card">
          <h3>我的投资</h3>
          <p>投资金额: <strong>{parseFloat(userContribution).toFixed(4)} ETH</strong></p>
          {isEarlyBird && <p style={{ color: "#10B981" }}>您是早鸟投资者!</p>}
          {canRefund && (
            <p style={{ color: "#F59E0B" }}>
              可退款 ({refundReason})
            </p>
          )}
          {isCooldownActive && cooldownRemaining > 0 && (
            <p style={{ color: "#3B82F6" }}>
              冷静期剩余: {Math.floor(cooldownRemaining / 86400)}天 {Math.floor((cooldownRemaining % 86400) / 3600)}时
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h3>投资</h3>
        <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
          1 ETH = 10,000 XXCT | 早鸟额外奖励
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() => handleInvest("0.1")}
            disabled={isLoading || !account || isSuccessful || isEnded}
          >
            投资 0.1 ETH
          </button>
          <button
            className="btn"
            onClick={() => handleInvest("1")}
            disabled={isLoading || !account || isSuccessful || isEnded}
          >
            投资 1 ETH
          </button>
          <button
            className="btn"
            onClick={() => handleInvest("5")}
            disabled={isLoading || !account || isSuccessful || isEnded}
          >
            投资 5 ETH
          </button>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {account && account.toLowerCase() === ownerAddress.toLowerCase() && !isEnded && (
            <button
              className="btn"
              onClick={handleEndEarly}
              disabled={isLoading}
              style={{ background: "#F59E0B" }}
            >
              ⚡ 提前结束众筹
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={handleFinalize}
            disabled={isLoading || !account || !isEnded || isSuccessful}
          >
            {isSuccessful ? "已成功" : "结束众筹"}
          </button>
          {isSuccessful && !isWithdrawn && (
            <button
              className="btn"
              onClick={handleWithdraw}
              disabled={isLoading || !account}
              style={{ background: "#10B981" }}
            >
              提取资金
            </button>
          )}
          {isSuccessful && isWithdrawn && (
            <span style={{ color: "#6B7280", padding: "0.5rem" }}>资金已提取</span>
          )}
          {canRefund && !hasRefunded && (
            <button
              className="btn"
              onClick={handleRefund}
              disabled={isLoading || !account}
              style={{ background: "#F59E0B" }}
            >
              申请退款
            </button>
          )}
          {hasRefunded && (
            <span style={{ color: "#10B981", padding: "0.5rem" }}>已退款</span>
          )}
        </div>

        {!account && (
          <p style={{ color: "#EF4444", marginTop: "1rem" }}>
            请先连接钱包
          </p>
        )}
        {isSuccessful && (
          <p style={{ color: "#10B981", marginTop: "1rem" }}>
            众筹成功！代币已发放！去商城看看吧！
          </p>
        )}
        {isEnded && !isSuccessful && (
          <p style={{ color: "#F59E0B", marginTop: "1rem" }}>
            众筹已结束，未达到目标。投资者可以申请退款。
          </p>
        )}
      </div>
    </div>
  );
};

export default CrowdfundingPage;